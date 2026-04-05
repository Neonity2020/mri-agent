import os
from typing import List, Dict, Any
from pydantic import BaseModel, Field
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from langchain.output_parsers import PydanticOutputParser
from langchain.prompts import PromptTemplate
from pinecone import Pinecone, ServerlessSpec
from app.services.pdf_parser import ConceptCard

class RagEngine:
    _instance = None
    _index_initialized = False

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            cls._instance = super(RagEngine, cls).__new__(cls)
            cls._instance._init_once()
        return cls._instance

    def _init_once(self):
        print("🚀 [RagEngine] Starting initialization...")
        from dotenv import load_dotenv
        load_dotenv()
        
        gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        print(f"🔑 [RagEngine] Gemini Key found: {bool(gemini_key)}")
        
        # Initialize Gemini
        self.llm = ChatGoogleGenerativeAI(temperature=0, model="gemini-2.5-flash", google_api_key=gemini_key)
        self.embeddings = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-001", google_api_key=gemini_key)
        print("🤖 [RagEngine] Gemini & Embeddings models initialized.")

        
        # Initialize Pinecone
        pinecone_api_key = os.getenv("PINECONE_API_KEY")
        self.index_name = os.getenv("PINECONE_INDEX_NAME", "mri-learning-agent")
        print(f"🌲 [RagEngine] Pinecone Index: {self.index_name}")
        
        if pinecone_api_key and pinecone_api_key != "your_pinecone_api_key_here":
            try:
                print("🌲 [RagEngine] Connecting to Pinecone...")
                self.pc = Pinecone(api_key=pinecone_api_key)
                if not RagEngine._index_initialized:
                    self._ensure_index()
                    RagEngine._index_initialized = True
                print("✅ [RagEngine] Pinecone connection successful.")
            except Exception as e:
                print(f"❌ [RagEngine] Failed to initialize Pinecone: {e}")
                self.pc = None
        else:
            self.pc = None
            print("⚠️ [RagEngine] Warning: PINECONE_API_KEY not set or invalid.")
            
    def __init__(self):
        pass
            
    def _ensure_index(self):
        """Ensure the Pinecone index exists."""
        import time
        print(f"🔍 [RagEngine] Checking if index '{self.index_name}' exists...")
        
        existing_indexes = [i.name for i in self.pc.list_indexes()]
        if self.index_name not in existing_indexes:
            print(f"🏗️ [RagEngine] Creating index {self.index_name}...")
            self.pc.create_index(
                name=self.index_name,
                dimension=3072, # gemini-embedding-001 outputs 3072 dims
                metric='cosine',
                spec=ServerlessSpec(
                    cloud='aws',
                    region='us-east-1'
                )
            )
            while not self.pc.describe_index(self.index_name).status['ready']:
                print("⏳ [RagEngine] Waiting for index to be ready...")
                time.sleep(2)
        
        print(f"🛰️ [RagEngine] Index '{self.index_name}' is ready. Connecting...")
        self.index = self.pc.Index(self.index_name)


    def generate_concept_cards(self, text_chunk: str) -> List[ConceptCard]:
        """
        Use LLM to generate concept cards from a text chunk.
        """
        parser = PydanticOutputParser(pydantic_object=ConceptCard)
        
        # Since a chunk might contain multiple concepts, we can ask for a list.
        # For simplicity in this MVP, we extract the primary concept or a list if wrapped in another model.
        class ConceptCardList(BaseModel):
            cards: List[ConceptCard] = Field(description="A list of concept cards extracted from the text")
            
        list_parser = PydanticOutputParser(pydantic_object=ConceptCardList)
        
        prompt = PromptTemplate(
            template="Extract the core MRI physics concepts from the following text and generate study cards.\n{format_instructions}\n\nTEXT:\n{text}\n",
            input_variables=["text"],
            partial_variables={"format_instructions": list_parser.get_format_instructions()}
        )
        
        chain = prompt | self.llm | list_parser
        try:
            result = chain.invoke({"text": text_chunk})
            return result.cards
        except Exception as e:
            print(f"Failed to generate concept cards: {e}")
            return []
            
    def store_cards(self, cards: List[ConceptCard]):
        """Embed and store concept cards in Pinecone."""
        if not self.pc:
            return
            
        vectors = []
        for card in cards:
            # We embed the definition and key points combined
            text_to_embed = f"{card.concept_name}: {card.definition} " + " ".join(card.key_points)
            embedding = self.embeddings.embed_query(text_to_embed)
            
            # Use concept_name as ID (make it safe)
            vector_id = card.concept_name.lower().replace(" ", "-")
            
            # Store metadata
            metadata = card.model_dump()
            
            vectors.append({
                "id": vector_id,
                "values": embedding,
                "metadata": metadata
            })
            
        if vectors:
            self.index.upsert(vectors=vectors)
            print(f"Stored {len(vectors)} concept cards in {self.index_name}.")

    def search_concept(self, query: str, top_k: int = 3, min_score: float = 0.3) -> List[dict]:
        """Search for relevant concept cards using semantic search.

        Args:
            query: The search query string.
            top_k: Maximum number of results to return.
            min_score: Minimum similarity score threshold. Results below this
                       threshold are filtered out to ensure relevance.
        """
        if not self.pc:
            return [{"error": "Vector DB not initialized."}]

        embedding = self.embeddings.embed_query(query)
        try:
            results = self.index.query(
                vector=embedding,
                top_k=top_k,
                include_metadata=True
            )

            # Format the output for the frontend, filtering by minimum score
            matched_cards = []
            for match in results.get("matches", []):
                score = match.get("score", 0)
                if score >= min_score:
                    matched_cards.append({
                        "score": score,
                        "metadata": match.get("metadata")
                    })
            return matched_cards
        except Exception as e:
            print(f"Error searching concepts: {e}")
            return []

    def translate_toc(self, raw_toc: str) -> list:
        """Translate the raw PyMuPDF TOC to a structured bilingual JSON."""
        from langchain.output_parsers import PydanticOutputParser
        from pydantic import BaseModel, Field
        from langchain.prompts import PromptTemplate
        from typing import List
        
        class TOCItem(BaseModel):
            level: int = Field(description="Hierarchy level (1 for main, 2 for sub)")
            en: str = Field(description="Original English title")
            zh: str = Field(description="Translated Chinese title")
            page: int = Field(description="Page number")
            
        class TOCList(BaseModel):
            items: List[TOCItem]
            
        parser = PydanticOutputParser(pydantic_object=TOCList)
        
        # We process a highly abbreviated prompt if there are lots of entries to avoid token output limits.
        prompt = PromptTemplate(
            template="You are an expert medical translator. Translate the following English MRI book Table of Contents lines into Simplified Chinese.\nExtract the exact hierarchy level (by counting indent spaces if needed) and the page numbers.\n{format_instructions}\nRAW TOC LINES:\n{raw_toc}\n\nIMPORTANT: Maintain the array order strictly as provided.",
            input_variables=["raw_toc"],
            partial_variables={"format_instructions": parser.get_format_instructions()}
        )
        chain = prompt | self.llm | parser
        
        try:
            # We take up to 6000 chars to avoid exceeding output token limits on massive books
            result = chain.invoke({"raw_toc": raw_toc[:6000]})
            return [item.model_dump() for item in result.items]
        except Exception as e:
            print(f"TOC LLM translation failed: {e}")
            return []

    def generate_learning_calendar(self) -> dict:
        """Generate a structured JSON learning calendar based on the cached TOC."""
        import os, json
        if not os.path.exists("/tmp/mri_agent/toc_bilingual.json"):
            raise ValueError("No TOC available to generate calendar.")
            
        with open("/tmp/mri_agent/toc_bilingual.json", "r", encoding="utf-8") as f:
            toc = json.load(f)
            
        from langchain.output_parsers import PydanticOutputParser
        from pydantic import BaseModel, Field
        from langchain.prompts import PromptTemplate
        from typing import List
        
        class WeekPlan(BaseModel):
            week: int = Field(description="Week number (e.g. 1)")
            theme: str = Field(description="Core theme of the week in Chinese (e.g. 基础物理篇)")
            chapters: List[str] = Field(description="List of chapters/topics to read this week in Chinese")
            tips: str = Field(description="One short learning tip or goal for this week")

        class Calendar(BaseModel):
            duration_weeks: int = Field(description="Total weeks of the plan (e.g. 8)")
            plan: List[WeekPlan]
            
        parser = PydanticOutputParser(pydantic_object=Calendar)
        prompt = PromptTemplate(
            template="You are a medical professor. Based on the following MRI book Table of Contents, create a structured 4 to 8 week learning calendar for a medical student.\n{format_instructions}\nTOC:\n{toc}\n\nGroup chapters logically into weekly themes. Output strict JSON.",
            input_variables=["toc"],
            partial_variables={"format_instructions": parser.get_format_instructions()}
        )
        chain = prompt | self.llm | parser
        
        # Pass a compressed version of TOC (max 6000 chars) to Gemini
        res = chain.invoke({"toc": str(toc)[:6000]})
        return res.model_dump()

    def generate_chapter_summary(self, chapter_name: str) -> dict:
        """Fetch contexts about a chapter and summarize it into structural notes."""
        if not self.pc:
            raise ValueError("Pinecone disabled or not configured.")
            
        # 1. Retrieve raw content about this chapter
        embed = self.embeddings.embed_query(f"Details and summary of {chapter_name}")
        index = self.pc.Index(self.index_name)
        results = index.query(namespace="document", vector=embed, top_k=10, include_metadata=True)
        
        contexts = [m.get("metadata", {}).get("text", "") for m in results.get("matches", [])]
        combined_text = "\n\n---\n\n".join(contexts)
        
        from langchain.output_parsers import PydanticOutputParser
        from pydantic import BaseModel, Field
        from langchain.prompts import PromptTemplate
        from typing import List
        
        class ChapterNote(BaseModel):
            summary: str = Field(description="A comprehensive overall summary of the topic (in Chinese)")
            core_points: List[str] = Field(description="3-5 specific core learning points (in Chinese)")
            takeaways: List[str] = Field(description="1-3 take-home messages (in Chinese)")
            
        parser = PydanticOutputParser(pydantic_object=ChapterNote)
        prompt = PromptTemplate(
            template="You are an expert radiology tutor. Read the following text excerpts retrieved from the book for the chapter/topic: '{chapter_name}'. \nCreate a structured note containing a summary, core learning points, and take-home messages. If the exact chapter is missing, summarize general foundational concepts based on the excerpts.\n{format_instructions}\n\nEXCERPTS:\n{text}",
            input_variables=["chapter_name", "text"],
            partial_variables={"format_instructions": parser.get_format_instructions()}
        )
        chain = prompt | self.llm | parser
        
        try:
            res = chain.invoke({"chapter_name": chapter_name, "text": combined_text[:12000]})
            return res.model_dump()
        except Exception as e:
            print(f"Chapter summary failed: {e}")
            return {
                "summary": "内容过于深奥或未能检索到足够多的特征区块，暂时无法提炼该章节摘要。",
                "core_points": ["无对应知识点解析"],
                "takeaways": ["请尝试手动输入该章节特定关键词问答"]
            }

    def webify_chapter(self, chapter_name: str, text: str, images: List[Dict[str, Any]] = []) -> str:
        """
        Use LLM to translate and format chapter text into premium Chinese Markdown,
        including original illustrations.
        """
        image_info = "\n".join([f"- Image: {img['filename']} (Original Page: {img['page']})" for img in images])
        
        prompt = PromptTemplate(
            template="""You are an expert medical editor and educator. 
Your task is to take the following raw text extracted from a medical textbook chapter ('{chapter_name}') and transform it into a high-fidelity, beautifully formatted web page in Simplified Chinese.

RECONSTRUCTION RULES:
1. **Maintain Original Hierarchy**: Use logical H1, H2, H3 tags to reflect the book's structure.
2. **Premium Readability**: Preserve paragraphs, lists, and technical emphasis (bold/italics).
3. **Idiomatic Translation**: Translate accurately into Simplified Chinese, keeping standard medical terminology.
4. **Layout Fidelity**: Use beautiful Markdown blocks for sidebars or highlights.
5. **Illustrations**: I have extracted the original images for this chapter. 
   - Available Images for this chapter:
{image_info}
   - INSTRUCTION: Review the text for figure references (e.g., 'Fig 1.2', 'Figure 1-1'). 
   - When you find a reference or a logical placement for an illustration, insert the most relevant image using this syntax: `![Figure Description](IMAGE_URL_PLACEHOLDER/{{filename}})`.
   - IMPORTANT: Only use filenames from the provided "Available Images" list.
   - If a figure reference in the text clearly matches the original page of an image, prioritize that placement.
   - **CRITICAL LAYOUT RULE**: When a single figure reference (e.g., 'Figure 1.5') corresponds to MULTIPLE images from the same page (e.g., pg18_img0.png, pg18_img1.png, pg18_img2.png ...), you MUST render them together in a responsive HTML grid table, NOT as separate stacked images. Use this exact pattern:
     ```html
     <table><tr>
     <td style="text-align:center;padding:4px"><img src="IMAGE_URL_PLACEHOLDER/pg18_img0.png" style="max-width:200px"/><br/><small>(a)</small></td>
     <td style="text-align:center;padding:4px"><img src="IMAGE_URL_PLACEHOLDER/pg18_img1.png" style="max-width:200px"/><br/><small>(b)</small></td>
     </tr></table>
     ```
   - Group images by their original page number. Images with the same page number likely belong to the same figure.
6. **NO META-COMMENTARY**: Do NOT add any remarks about the text being incomplete, truncated, or missing content. Just render what is provided cleanly.

ORIGINAL TEXT:
{text}

WEBIFIED CHINESE MARKDOWN (with images):""",
            input_variables=["chapter_name", "text", "image_info"]
        )
        
        chain = prompt | self.llm
        try:
            res = chain.invoke({"chapter_name": chapter_name, "text": text[:40000], "image_info": image_info})
            return res.content
        except Exception as e:
            print(f"Webify chapter failed: {e}")
            return f"### {chapter_name}\n\n抱歉，由于模型调度异常，暂时无法完成图文 Web 化渲染。"

    def process_full_document(self, text: str, source_name: str = "document"):
        """Fast method to chunk and embed an entire document."""
        if not self.pc:
            raise ValueError("Pinecone disabled or not configured.")
            
        from langchain.text_splitter import RecursiveCharacterTextSplitter
        import uuid
        
        splitter = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=100)
        chunks = splitter.split_text(text)
        
        # Artificial TOC chunk
        toc_chunk = "Book Outline / Table of Contents / 教材大纲 / 目录 / 总结 / Overview: \n" + text[:4000]
        chunks.insert(0, toc_chunk)
        
        vectors = []
        yield {"status": "progress", "message": f"⏳ 准备生成 {len(chunks)} 个认知网格簇..."}
        
        # Process in batches to respect API limits
        batch_size = 100
        for i in range(0, len(chunks), batch_size):
            yield {"status": "progress", "message": f"⏳ 正在计算大模型维度空间张量：批次 [{i} - {min(i+batch_size, len(chunks))}] / {len(chunks)} ..."}
            batch_chunks = chunks[i:i+batch_size]
            batch_embeddings = self.embeddings.embed_documents(batch_chunks)
            
            batch_vectors = []
            for j, emb in enumerate(batch_embeddings):
                chunk_id = f"{source_name}-{i+j}-{uuid.uuid4().hex[:8]}"
                batch_vectors.append({
                    "id": chunk_id,
                    "values": emb,
                    "metadata": {
                        "concept_name": f"{source_name} - Part {i+j}",
                        "definition": batch_chunks[j],
                        "key_points": ["Excerpt from textbook"]
                    }
                })
            vectors.extend(batch_vectors)
            
        yield {"status": "progress", "message": f"⏳ 正在将 {len(vectors)} 个特征向量推入 Pinecone 云端..."}
        # Always fetch a fresh index handle to avoid stale references after restarts/deletes
        self._ensure_index()
        index = self.pc.Index(self.index_name)
        for i in range(0, len(vectors), 100):
            index.upsert(vectors=vectors[i:i+100])
            
        yield {"status": "done", "total": len(chunks)}
