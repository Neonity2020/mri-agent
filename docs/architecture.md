# MRI Learning Agent SaaS - Technical Architecture

## Core Pipeline Architecture

This documentation outlines the functional pipeline for turning a complex Medical Physics PDF textbook into an interactive learning knowledge base.

### 1. Document Upload & Processing Pipeline

The file upload is handled via a chunked Server-Sent Events (SSE) streaming architecture, ensuring the frontend UI accurately reflects complex backend ingestion tasks:

1.  **File Staging**: The PDF is streamed to `/tmp/mri_agent/`. 
2.  **TOC Extraction**: PyMuPDF scans the PDF metadata to extract the document's built-in Table of Contents, bypassing LLM-translation limits to produce a highly accurate `toc_bilingual.json` mapping.
3.  **Content Chunking**: Text flows are extracted and heuristically split for Gemini model ingestion.
4.  **Vector Compilation**: The backend chunks text sequences and pushes them via `models/gemini-embedding-001` (producing 3072-dimensional arrays) into a centralized Pinecone Vector Index.

### 2. Multi-Modal Webification (Chapter Rendering)

In order to overcome the limitations of dry, text-only Markdown reading limits, the system deploys an active multi-modal reconstruction strategy:

*   **Trigger**: When a user selects a chapter from the sidebar, the backend determines the exact page boundaries using the pre-cached TOC.
*   **Image Harvest**: During text extraction, `pdf_parser.py` extracts original diagrams and photos. It resolves specialized physics layouts (specifically CMYK Ink Black Separation grids) by converting them into standard `csGRAY` Pixmaps so they don't render artificially as negatives.
*   **Prompt Engineering**: The extracted text layer and an explicit metadata map of available images are passed to `gemini-2.5-flash`.
*   **HTML & Markdown Fusion**: The LLM parses the prompt to inject images precisely where the text mentions "Figure 1.5". If multiple sub-images exist for a single figure, it wraps them natively into an `HTML Grid Table`.
*   **Frontend Digest**: The Next.js frontend receives the payload and renders it utilizing `react-markdown` layered with `rehype-raw` (to process the grid configurations) and `rehype-katex` (to handle standard physics equation notation).

### 3. Contextual Chat agent (RAG System)

*   **Retrieval Process**: User questions are embedded and correlated against the `mri-learning-agent` index on Pinecone.
*   **Prompt Assembly**: The top 8 closest chunks are hydrated as excerpts. If the system detects navigational intent ("Outline", "TOC"), it seamlessly merges the absolute `/tmp/mri_agent/toc.txt` data via systemic hard-coded prompts to avoid hallucination loops. 

## Data Persistence & Ephemerality

*   **Volatile Systems**: All PDFs and Webified caches (`web_*.md`, `.png` blobs) are stored in `/tmp/mri_agent`. They do not persist across hard reboots, facilitating an ephemeral SaaS model where source documents aren't hard-disk bound unnecessarily.
*   **Stable Systems**: Knowledge vector dimensions are permanently anchored in Pinecone's cloud infrastructure until expressly flushed securely by `delete_index.py`.
