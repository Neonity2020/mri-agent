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
    allow_origins=[
        "http://localhost:3000",
        "http://frontend:3000",
        os.environ.get("FRONTEND_URL", ""),
    ],
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

class ExportRequest(BaseModel):
    content: str
    title: str = "MRI学习笔记"

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
from fastapi.responses import FileResponse
# Mount image directory
os.makedirs("/tmp/mri_agent/images", exist_ok=True)
app.mount("/api/images", StaticFiles(directory="/tmp/mri_agent/images"), name="images")

# --- Chapter PDF endpoint ---
# Map chapter titles (zh/en) to split PDF files in chapters/ directory
CHAPTERS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "chapters")

@app.get("/api/chapter-pdf/{chapter_title:path}")
def get_chapter_pdf(chapter_title: str):
    """Serve the split chapter PDF matching the given title (Chinese or English)."""
    import re
    if not os.path.isdir(CHAPTERS_DIR):
        raise HTTPException(status_code=404, detail="章节 PDF 目录不存在。")

    decoded = chapter_title.strip()
    for fname in sorted(os.listdir(CHAPTERS_DIR)):
        if not fname.lower().endswith(".pdf"):
            continue
        # Filenames like "01_1_MRI魅力.pdf" — extract the Chinese title part
        # Pattern: NN_ChapterNumber_ChineseTitle.pdf
        name_no_ext = fname.rsplit(".", 1)[0]
        # Extract Chinese title after the number prefix (e.g. "01_1_MRI魅力" -> "MRI魅力")
        parts = name_no_ext.split("_", 2)
        zh_title = parts[2] if len(parts) >= 3 else name_no_ext

        # Match by Chinese title substring or by full chapter title
        if decoded in zh_title or zh_title in decoded:
            return FileResponse(
                os.path.join(CHAPTERS_DIR, fname),
                media_type="application/pdf",
                filename=fname,
            )

    # Fallback: try matching by chapter number extracted from title
    num_match = re.search(r'(\d+)', decoded)
    if num_match:
        ch_num = int(num_match.group(1))
        for fname in sorted(os.listdir(CHAPTERS_DIR)):
            if not fname.lower().endswith(".pdf"):
                continue
            parts = fname.rsplit(".", 1)[0].split("_")
            if len(parts) >= 2:
                try:
                    file_num = int(parts[1])
                    if file_num == ch_num:
                        return FileResponse(
                            os.path.join(CHAPTERS_DIR, fname),
                            media_type="application/pdf",
                            filename=fname,
                        )
                except ValueError:
                    continue

    raise HTTPException(status_code=404, detail=f"未找到章节 PDF: {chapter_title}")

# Mount exports directory
os.makedirs("/tmp/mri_agent/exports", exist_ok=True)

@app.post("/api/export/markdown")
def export_markdown(request: ExportRequest):
    """Generate a .md file from content and return a download URL."""
    import hashlib, time, re
    try:
        # Sanitize title for filename
        safe_title = re.sub(r'[^\w\u4e00-\u9fff\-]', '_', request.title).strip('_')[:60]
        timestamp = int(time.time())
        filename = f"{safe_title}_{timestamp}.md"
        export_dir = "/tmp/mri_agent/exports"
        file_path = os.path.join(export_dir, filename)
        
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(f"# {request.title}\n\n")
            f.write(request.content)
            f.write(f"\n\n---\n*由 MRI Learning Agent 生成 | {time.strftime('%Y-%m-%d %H:%M:%S')}*\n")
        
        return {
            "download_url": f"/api/exports/download/{filename}",
            "filename": filename
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {e}")

@app.get("/api/exports/download/{filename}")
def download_export(filename: str):
    """Serve a generated markdown file for download."""
    import re
    # Security: only allow safe filenames
    if not re.match(r'^[\w\u4e00-\u9fff\-\.]+$', filename):
        raise HTTPException(status_code=400, detail="Invalid filename.")
    file_path = f"/tmp/mri_agent/exports/{filename}"
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found.")
    from urllib.parse import quote
    encoded_filename = quote(filename)
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f"attachment; filename=\"{filename}\"; filename*=UTF-8''{encoded_filename}",
            "Content-Type": "application/octet-stream",
        }
    )

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
        
        # 2. Format Context (only from high-relevance matches)
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

        has_context = len(context_texts) > 0
        context_str = "\n\n".join(context_texts) if has_context else ""

        # 3. Construct Prompt — strictly grounded in uploaded PDF
        if has_context:
            system_prompt = f"""
You are the MRI Learning Agent. Your role is to help users master MRI principles **strictly based on the uploaded textbook excerpts provided below**.

[TEXTBOOK EXCERPTS]:
{context_str}

## Rules:
1. **ONLY answer using the information from the textbook excerpts above.** Do NOT use any external or pre-trained knowledge that is not supported by these excerpts.
2. If the excerpts do not contain enough information to fully answer the question, clearly state what the excerpts cover and indicate the limitation. Do NOT fabricate or infer content that is not present.
3. **CRITICAL RULE: If the user asks for the book's outline, structure, or table of contents, your translation and terminology MUST strictly correspond to the original English materials provided in the excerpts.**
4. **IMPORTANT: You MUST answer entirely in Simplified Chinese (简体中文).**

**EXPORT RULE: If the user explicitly asks you to generate notes, export, save, or create a file (e.g. "帮我整理笔记", "保存为文件", "导出", "生成笔记文件"), you MUST append the exact marker `[EXPORT_MD]` at the very end of your response (after all content). This tells the frontend to automatically trigger a file download. Do NOT mention this marker to the user; just include it silently at the end.**
"""
            response = rag.llm.invoke([
                SystemMessage(content=system_prompt),
                HumanMessage(content=request.message)
            ])
            return {"reply": response.content}
        else:
            return {"reply": "抱歉，我在您上传的教材中没有找到与该问题相关的内容。请确保已上传包含相关章节的PDF文件，或者尝试换一种方式描述您的问题。\n\n如果您尚未上传教材，请先上传PDF文件，我会基于教材内容为您解答。"}



    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Chat failed: {e}")
