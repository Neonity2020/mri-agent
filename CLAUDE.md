# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MRI Learning Agent SaaS is an AI-powered educational platform that transforms medical physics textbooks into interactive learning experiences. The system ingests PDFs, parses complex layouts, and uses a RAG pipeline powered by Google Gemini to provide semantic search, webified reading experiences, chat interfaces, and study planning.

**Core Value**: Not just an "AI Q&A tool", but an "AI learning companion" that actively guides, tracks progress, and provides personalized learning recommendations.

## Development Commands

### Backend (FastAPI)
```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend (Next.js)
```bash
cd frontend
npm install
npm run dev        # Start dev server on http://localhost:3000
npm run build      # Production build
npm run start      # Run production server
npm run lint       # Run ESLint
```

### Database Utilities
```bash
cd backend
python delete_index.py  # Clear Pinecone vector DB (use with caution)
```

## Architecture

### High-Level Pipeline

```
PDF Upload → TOC Extraction → Content Chunking → Vector Embedding → Pinecone Storage
                    ↓                                          ↓
              /tmp/mri_agent/                        RAG-powered Chat
              (ephemeral storage)                    & Webification
```

### Backend Services

**`app/main.py`**: FastAPI application with SSE-based file upload, API routes

**`app/services/rag_engine.py`**: Core RAG engine
- Orchestrates PDF processing and vector storage
- Generates learning calendars and chapter summaries
- Handles chapter "webification" (LLM-based Markdown+HTML conversion)
- Manages Pinecone index initialization and health checks

**`app/services/pdf_parser.py`**: PDF parsing utilities
- Extracts text, images, and TOC using PyMuPDF (`fitz`)
- **Critical**: Handles CMYK color space conversion to prevent image negatives
- Saves extracted images to `/tmp/mri_agent/images/`

### Frontend Structure

**`src/app/page.tsx`**: Main landing page with file upload

**`src/app/chapters/[slug]/page.tsx`**: Chapter reading view that renders webified Markdown with embedded images

**`src/components/`**: React components
- `chat/`: Chat interface for RAG-powered Q&A
- `ui/`: Base UI components (shadcn/ui)

**Markdown Rendering**: Uses `react-markdown` with:
- `rehype-raw` - for HTML grid layouts (multi-part figures)
- `remark-math` + `rehype-katex` - for physics equations
- Tailwind `@tailwindcss/typography` - for prose styling

## Key Design Decisions

### Ephemeral Storage Model
- All PDFs and webified caches stored in `/tmp/mri_agent/`
- Does not persist across reboots (ephemeral SaaS design)
- Only Pinecone vectors persist in cloud

### Vector Database
- **Provider**: Pinecone
- **Index**: `mri-learning-agent`
- **Dimensions**: 3072 (specific to `models/gemini-embedding-001`)
- **Embedding Model**: `models/gemini-embedding-001` (Google Generative AI)

### LLM Configuration
- **Primary**: `gemini-2.5-flash` (replaces 1.5-flash due to 404 issues)
- Used for: RAG responses, chapter webification, calendar generation

### Image Handling
- PDFs use CMYK color space where 0=white (no ink), 255=black (full ink)
- PyMuPDF `Separation(DeviceCMYK, Black)` channels must be converted to `csGRAY` before PNG export
- Without conversion, images render as photographic negatives
- **Fix location**: `pdf_parser.py` color space detection

### Chapter Webification
- LLM receives extracted text + metadata map of available images
- Prompt instructs Gemini to inject images at "Figure X" references
- Multi-part figures (a, b, c, d, e, f) wrapped in HTML table grids
- Frontend `rehype-raw` must be enabled for HTML rendering

## Known Issues & Solutions

### Pinecone 401 Unauthorized (Malformed Domain)
- **Cause**: Cached index handle points to deleted environment
- **Fix**: `rag_engine.py` calls `_ensure_index()` before every vector push

### Model 404 Errors
- **Cause**: `text-embedding-004` and `gemini-1.5-flash` unavailable for some GCP projects
- **Fix**: Migrated to `gemini-embedding-001` (3072 dims) and `gemini-2.5-flash`

### TypeScript Scope Errors
- **Cause**: React state type irregularities in chat components
- **Fix**: Explicit typing for `setMessages` and React hooks

## Environment Variables

Backend `.env` (in `backend/` directory):
```
PINECONE_API_KEY=your_pinecone_api_key
GEMINI_API_KEY=your_google_gemini_api_key
```

## CORS Configuration

Backend allows `http://localhost:3000` for development. Update `app/main.py` CORSMiddleware for production domains.

## Product Vision (from Chinese spec doc)

The project aims to implement a multi-agent architecture for personalized learning:

- **Orchestrator**: Central coordinator understanding user intent
- **Planner Agent**: Creates personalized learning plans based on user background
- **Chapter Agent**: Provides in-depth chapter explanations
- **Quiz Agent**: Generates practice questions and assessments
- **Progress Tracker**: Tracks learning progress and updates feature lists

Current implementation focuses on the MVP: PDF ingestion + RAG + basic chat. The multi-agent harness is planned for Phase 2.
