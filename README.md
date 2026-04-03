# MRI Learning Agent SaaS

An AI-powered, educational SaaS platform designed specifically to aid in learning complex medical physics, utilizing *MRI from Picture to Proton* as its core knowledge base. The system ingests medical textbook PDFs, parses complex layouts (including images and bilingual Tables of Contents), and uses a RAG (Retrieval-Augmented Generation) pipeline powered by Gemini to provide semantic search, webified reading experiences, chat interfaces, and study planning.

## 🚀 Key Features

*   **PDF Ingestion & Smart Parsing**: Leverages PyMuPDF to extract text, raw tables of contents, and images (handling complex CMYK Separation color inversions accurately).
*   **Bilingual RAG Engine**: Fully automated pipeline to build a vector database (Pinecone) with Gemini embeddings (3072 dimensions).
*   **Chapter Webification**: Converts raw PDF pages into beautifully formatted responsive Markdown chapters, intelligently placing extracted original textbook images back into the text context using an LLM.
*   **Interactive Study Calendar**: AI-generated structured learning plans based on the user's progress and the textbook's curriculum.
*   **Vector-Powered Q&A**: A chat interface that searches the processed textbook chunks to provide pinpoint medical physics explanations without hallucinating out-of-context answers.

## 🛠️ Technology Stack

### Frontend
*   **Framework**: Next.js 14 (App Router)
*   **UI / Styling**: Tailwind CSS, Radix UI, Lucide React
*   **Markdown Rendering**: `react-markdown` with `rehype-raw`, `remark-math`, and `rehype-katex` for rendering complex math equations and HTML image grids.

### Backend
*   **Framework**: FastAPI (Python 3.9+)
*   **AI / LLMs**: Google Gemini 2.5 Flash, Google Generative AI Embeddings (`models/gemini-embedding-001`)
*   **Vector Database**: Pinecone (`mri-learning-agent` index)
*   **PDF Processing**: PyMuPDF (`fitz`), Pillow (PIL)

## 📦 Local Setup & Installation

### 1. Backend Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Create a `.env` file in the `backend/` directory:
```env
PINECONE_API_KEY=your_pinecone_api_key
GEMINI_API_KEY=your_google_gemini_api_key
```

Run the backend server:
```bash
uvicorn app.main:app --reload
```

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The application will be available at `http://localhost:3000`.

## 📂 Project Structure

```
mri_learning_agent_saas/
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI application, upload processes (SSE), API routes
│   │   └── services/
│   │       ├── pdf_parser.py       # PDF parsing, image extraction, CMYK fix
│   │       └── rag_engine.py       # Pinecone integration, Gemini interactions, Webification
│   ├── delete_index.py             # Utility to clear vector DB
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── app/
    │   │   ├── page.tsx
    │   │   └── chapters/[slug]/    # Webified chapter reading view
    │   ├── components/             # React components (Chat Interface, Sidebar, etc.)
    │   └── ...
    ├── tailwind.config.ts
    └── package.json
```
