from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
import os
import json
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any

try:
    from app.services.rag_engine import RagEngine
except ImportError:
    pass

app = FastAPI(title="MRI Learning Agent API", version="1.0.0")

# Configure CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Global instance
rag_engine = None

@app.on_event("startup")
async def startup_event():
    global rag_engine
    print("🎬 [Startup] Initializing Global RagEngine...")
    try:
        from app.services.rag_engine import RagEngine
        rag_engine = RagEngine()
        print("✅ [Startup] RagEngine ready.")
    except Exception as e:
        print(f"❌ [Startup] RagEngine initialization FAILED: {e}")
        import traceback
        traceback.print_exc()

def get_rag_engine():
    if rag_engine is None:
        raise HTTPException(status_code=503, detail="RAG engine is not initialized or failed to start.")
    return rag_engine

class SearchRequest(BaseModel):
    query: str
    top_k: int = 3

class ChatRequest(BaseModel):
    message: str

@app.get("/")
def read_root():
    return {"message": "Welcome to the MRI Learning Agent API"}

@app.get("/api/health")
def health_check():
    return {"status": "healthy"}

@app.get("/api/toc")
def get_toc():
    import os, json
    path = "/tmp/mri_agent/toc_bilingual.json"
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return {"toc": json.load(f)}
        except Exception:
            return {"toc": []}
    return {"toc": []}

@app.get("/api/calendar")
def get_calendar(rag: "RagEngine" = Depends(get_rag_engine)):
    try:
        import os, json
        cache_path = "/tmp/mri_agent/calendar_cache.json"
        
        # In a real app, invalidate cache on new upload. We do it blindly here for MVP
        if os.path.exists(cache_path):
            with open(cache_path, "r", encoding="utf-8") as f:
                return {"calendar": json.load(f)}
                
        plan = rag.generate_learning_calendar()
        with open(cache_path, "w", encoding="utf-8") as f:
            json.dump(plan, f, ensure_ascii=False)
        return {"calendar": plan}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/chapter_summary")
def get_chapter_summary(chapter: str, rag: "RagEngine" = Depends(get_rag_engine)):
    try:
        import os, json, hashlib
        # Hash cache path so spaces and weird chars don't break the FS
        cache_key = hashlib.md5(chapter.encode('utf-8')).hexdigest()
        cache_path = f"/tmp/mri_agent/chap_{cache_key}.json"
        
        if os.path.exists(cache_path):
            with open(cache_path, "r", encoding="utf-8") as f:
                return json.load(f)
                
        summary = rag.generate_chapter_summary(chapter)
        with open(cache_path, "w", encoding="utf-8") as f:
            json.dump(summary, f, ensure_ascii=False)
        return summary
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/chapters/{chapter_title}")
def get_webified_chapter(chapter_title: str, rag: "RagEngine" = Depends(get_rag_engine)):
    try:
        import os, json, hashlib
        cache_key = hashlib.md5(chapter_title.encode('utf-8')).hexdigest()
        cache_path = f"/tmp/mri_agent/web_{cache_key}_v2.md"
        
        if os.path.exists(cache_path):
            with open(cache_path, "r", encoding="utf-8") as f:
                return {"content": f.read()}
        
        # 1. Find page range from TOC
        toc_path = "/tmp/mri_agent/toc_bilingual.json"
        if not os.path.exists(toc_path):
            raise HTTPException(status_code=404, detail="教材尚未上传，无法获取章节详情。")
            
        with open(toc_path, "r", encoding="utf-8") as f:
            toc = json.load(f)
            
        start_page = -1
        end_page = -1
        target_en_title = chapter_title # The frontend should pass the exact English title or we map it
        
        for i, item in enumerate(toc):
            if item["en"] == target_en_title or item["zh"] == target_en_title:
                start_page = item["page"] - 1 # 0-indexed
                # End page is the next item's start page (at the same or higher level usually)
                if i + 1 < len(toc):
                    end_page = toc[i+1]["page"] - 1
                else:
                    end_page = -1 # End of doc
                break
                
        if start_page == -1:
             raise HTTPException(status_code=404, detail="未找到该章节的目录索引。")
             
        # 2. Extract text range
        from app.services.pdf_parser import PDFParser
        pdf_dir = "/tmp/mri_agent"
        pdf_file = next((f for f in os.listdir(pdf_dir) if f.lower().endswith(".pdf")), None)
        if not pdf_file:
            raise HTTPException(status_code=404, detail="未找到原始 PDF 文件。")
            
        parser = PDFParser(f"{pdf_dir}/{pdf_file}")
        raw_text = parser.extract_text_range(start_page, end_page)
        
        # 3. Extract Images for this range
        image_dir = f"/tmp/mri_agent/images/{cache_key}"
        images_metadata = parser.extract_images_range(start_page, end_page, image_dir)
        
        # 4. Webify via LLM (passing image info)
        webified_md = rag.webify_chapter(chapter_title, raw_text, images_metadata)
        
        # 5. Fix image URLs (from placeholder to actual public API URL)
        actual_base_url = f"http://localhost:8000/api/images/{cache_key}"
        webified_md = webified_md.replace("IMAGE_URL_PLACEHOLDER", actual_base_url)
        
        # 6. Cache and return
        with open(cache_path, "w", encoding="utf-8") as f:
            f.write(webified_md)
            
        return {"content": webified_md}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

from fastapi.staticfiles import StaticFiles
# Mount image directory
os.makedirs("/tmp/mri_agent/images", exist_ok=True)
app.mount("/api/images", StaticFiles(directory="/tmp/mri_agent/images"), name="images")

@app.post("/api/search")
def search_concepts(request: SearchRequest, rag: "RagEngine" = Depends(get_rag_engine)):
    try:
        results = rag.search_concept(request.query, request.top_k)
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {e}")

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
import os
import shutil

from fastapi.responses import StreamingResponse
import json

@app.post("/api/upload")
async def upload_document(file: UploadFile = File(...), rag: "RagEngine" = Depends(get_rag_engine)):
    async def process_file():
        try:
            # SSE format requires "data: <msg>\n\n"
            def sse_msg(status: str, message: str, **kwargs):
                return f"data: {json.dumps({'status': status, 'message': message, **kwargs})}\n\n"

            yield sse_msg("uploading", f"正在将《{file.filename}》缓冲区保存至服务器临时目录...")


            
            from app.services.pdf_parser import PDFParser
            temp_dir = "/tmp/mri_agent"
            os.makedirs(temp_dir, exist_ok=True)
            file_path = f"{temp_dir}/{file.filename}"
            
            # Use synchronous open but wrap the first yield or use a small buffer
            with open(file_path, "wb") as buffer:
                import shutil
                shutil.copyfileobj(file.file, buffer)
                
            yield sse_msg("parsing", "✅ 文件挂载成功！正在调度 PyMuPDF 引擎，对 PDF 中的复杂排版进行文本光流提取...")
            
            parser = PDFParser(file_path)
            
            # Save the exact, hierarchical TOC to local cache for outline queries
            toc_string = parser.get_structured_toc_string()
            with open("/tmp/mri_agent/toc.txt", "w", encoding="utf-8") as f:
                f.write(toc_string)
                
            yield sse_msg("translating", "✅ 目录索引构建中！正在解析全书双语目录结构...")
            
            # Build bilingual TOC directly from PDF metadata (fast, reliable, no LLM needed)
            # The PDF contains its own TOC with Chinese titles already extracted by PyMuPDF.
            bilingual_toc = []
            try:
                import fitz
                doc = fitz.open(file_path)
                raw_toc = doc.get_toc()
                for item in raw_toc:
                    lvl, title, page = item
                    bilingual_toc.append({
                        "level": lvl,
                        "zh": title,
                        "en": title,  # Use same title for en; LLM translation can be done on-demand later
                        "page": page
                    })
            except Exception as toc_err:
                print(f"TOC extraction failed, falling back to LLM: {toc_err}")
                bilingual_toc = rag.translate_toc(toc_string)
            
            with open("/tmp/mri_agent/toc_bilingual.json", "w", encoding="utf-8") as f:
                import json as pyjson
                pyjson.dump(bilingual_toc, f, ensure_ascii=False)

                
            yield sse_msg("extracting", "✅ 目录翻译完成！正在提取全书文本流并进行语义分段...")
            
            text = parser.extract_text()
            if not text:
                yield sse_msg("error", "❌ 无法从 PDF 中提取有效文字，请检查文档是否被加密或为纯扫描图片。")
                return
                
            yield sse_msg("generating", f"✅ 文本流提取完毕 (共 {len(text)} 字符)。全书已被智能分段，准备提交 Gemini 引擎执行分布式向量编译...")
            
            # Perform high-performance batch embedding over the ENTIRE document and pipeline yields
            total_chunks = 0
            for progress in rag.process_full_document(text, source_name=file.filename):
                if progress["status"] == "done":
                    total_chunks = progress["total"]
                elif progress["status"] == "progress":
                    yield sse_msg("embedding", progress["message"])
            
            yield sse_msg("success", f"🎉 **《{file.filename}》知识网络吞噬完成！**\n\n全书已被切分为 **{total_chunks}** 个向量神经元并上线！现在，无论您向我询问书里的任何章节知识，我都能直接精准命中原文为您做解答！")
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            yield sse_msg("error", f"❌ 严重内部宕机：处理流程被迫中断 -> {str(e)}")
            
    return StreamingResponse(process_file(), media_type="text/event-stream")

@app.post("/api/chat")
def chat_with_agent(request: ChatRequest, rag: "RagEngine" = Depends(get_rag_engine)):
    try:
        from langchain_core.messages import SystemMessage, HumanMessage
        
        # 1. Search Knowledge Base
        results = rag.search_concept(request.message, top_k=8)
        
        # 2. Format Context
        context_texts = []
        for match in results:
            if "metadata" in match:
                meta = match["metadata"]
                context_texts.append(f"Excerpt: {meta.get('definition')}")
                
        # Heuristic to inject absolute TOC if requested
        toc_keywords = ["大纲", "目录", "结构", "章节", "outline", "table of contents", "toc", "规划", "计划", "plan"]
        if any(kw in request.message.lower() for kw in toc_keywords):
            import os
            if os.path.exists("/tmp/mri_agent/toc.txt"):
                with open("/tmp/mri_agent/toc.txt", "r", encoding="utf-8") as f:
                    toc_data = f.read()
                context_texts.insert(0, f"Complete Book Table of Contents:\n{toc_data}")
                
        context_str = "\n\n".join(context_texts) if context_texts else "No specific context found."
        
        # 3. Construct Prompt
        system_prompt = f"""
You are the MRI Learning Agent. Your goal is to help users master MRI principles based on the provided textbook excerpts.
Here are the most relevant excerpts retrieved from the user's uploaded textbook:

[TEXTBOOK EXCERPTS]:
{context_str}

Please answer the user's question.
If the excerpts do not contain the answer, you can use your core medical physics knowledge. 
**CRITICAL RULE 1: DO NOT ever mention that you cannot read the PDF, do not have access to the PDF, or any system limitations.** 
**CRITICAL RULE 2: If the user asks for the book's outline, structure, or table of contents, your translation and terminology MUST strictly correspond to the original English materials provided in the excerpts.**
Just answer the question directly. 
**IMPORTANT: You MUST answer entirely in Simplified Chinese (简体中文).**
"""
        response = rag.llm.invoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=request.message)
        ])
        
        return {"reply": response.content}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Chat failed: {e}")
