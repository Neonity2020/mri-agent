# MRI Learning Agent SaaS

An AI-powered educational platform that transforms medical physics textbooks into interactive learning experiences. The system ingests PDFs, parses complex layouts, and uses a RAG pipeline powered by Google Gemini to provide semantic search, webified reading experiences, chat interfaces, and study planning.

## Features

- **PDF Ingestion & Smart Parsing** — PyMuPDF extracts text, images, and bilingual TOCs with CMYK color space correction
- **RAG Engine** — Gemini embeddings (3072 dims) + Pinecone vector database for semantic retrieval
- **PDF-Grounded Q&A** — Chat responses strictly based on uploaded PDF content, with similarity score filtering and clear fallback messaging
- **Chapter Webification** — Raw PDF pages converted to responsive Markdown with intelligent image placement and LaTeX math support
- **PDF Sidebar Viewer** — Side-by-side original PDF viewing with zoom, drag-to-pan, and page navigation
- **Inline AI Chat** — Chapter-specific AI conversation sidebar with automatic context injection
- **Multi-Conversation Management** — Create, switch, and delete independent chat sessions with auto-naming
- **Resizable Panels** — Drag-to-resize sidebars for comfortable reading
- **Study Calendar** — AI-generated structured learning plans based on the textbook's curriculum
- **Markdown Export** — One-click export of AI responses as `.md` files

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js (App Router), Tailwind CSS, shadcn/ui, Lucide React |
| Markdown | react-markdown, rehype-raw, remark-math, rehype-katex |
| PDF Viewer | pdfjs-dist |
| Backend | FastAPI (Python 3.11+), Uvicorn |
| AI / LLM | Google Gemini 2.5 Flash, Gemini Embeddings |
| Vector DB | Pinecone |
| PDF Processing | PyMuPDF (fitz), Pillow |
| Deployment | Docker Compose, Nginx |

## Local Development

### Prerequisites

- Python 3.11+
- Node.js 20+
- Pinecone account & API key
- Google Gemini API key

### 1. Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env`:
```env
GEMINI_API_KEY=your_google_gemini_api_key
PINECONE_API_KEY=your_pinecone_api_key
```

```bash
uvicorn app.main:app --reload
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

App runs at `http://localhost:3000`.

### 3. Split Textbook (Optional)

To enable per-chapter PDF viewing in the sidebar:

```bash
python split_chapters.py
```

This creates `chapters/` with individual chapter PDFs.

## VPS Deployment (Docker Compose)

### 1. Clone & Configure

```bash
git clone https://github.com/Neonity2020/mri-agent.git
cd mri-agent
cp .env.example .env
nano .env  # Fill in your API keys
```

### 2. Build & Run

```bash
docker compose up -d --build
```

Architecture:
```
VPS (:80)
  └── Nginx (reverse proxy)
        ├── /       → Frontend (Next.js :3000)
        └── /api/   → Backend (FastAPI :8000)
```

### 3. Update

```bash
git pull
docker compose up -d --build
```

## Project Structure

```
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, SSE upload, API routes, CORS
│   │   └── services/
│   │       ├── pdf_parser.py    # PDF parsing, image extraction, CMYK fix
│   │       └── rag_engine.py    # Pinecone, Gemini RAG, chapter webification
│   ├── delete_index.py          # Clear Pinecone vector DB
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx         # Main page with upload
│   │   │   └── chapters/[slug]/ # Chapter reader with PDF + chat sidebars
│   │   └── components/
│   │       └── chat/            # Multi-conversation chat interface
│   └── package.json
├── split_chapters.py            # Split textbook into per-chapter PDFs
├── docker-compose.yml           # Docker Compose config
├── Dockerfile                   # Backend container
├── Dockerfile.frontend          # Frontend container
├── nginx.conf                   # Reverse proxy config
└── CLAUDE.md                    # Project documentation
```
