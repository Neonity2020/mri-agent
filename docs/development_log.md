# MRI Learning Agent - Development Log

## Version 1.0.0 (Initial RAG & Webification Beta)

### Key Achievements & Bug Fixes

#### 1. RAG Vector Database (Pinecone) Authorization Issue 
- **Bug**: The RAG engine encountered `401 Unauthorized (Malformed Domain)` errors during the upload and embedding phase.
- **Root Cause**: The `RagEngine` singleton class was caching a stale Pinecone index handle during startup. If the backend index was deleted and recreated (e.g., via `delete_index.py`), the cached handle continued to point to the deleted index environment URL.
- **Fix**: Refactored `process_full_document` in `rag_engine.py` to always explicitly call `_ensure_index()` and regenerate a fresh index handle immediately prior to pushing vectors to the cloud.

#### 2. Model Availability and Embedding Dimension Errors
- **Bug**: `text-embedding-004` and various Flash pipelines (`gemini-1.5-flash`, `gemini-2.0-flash`) were returning `404 Not Found` for the specific GCP project/API key.
- **Fix**: 
  - Migrated the embedding model to `models/gemini-embedding-001`.
  - Corrected the Pinecone index dimension parameter from `768` (old default) to `3072`, accurately aligning with the output vectors of `gemini-embedding-001`.
  - Migrated the primary LLM pipeline from `gemini-1.5-flash` to `gemini-2.5-flash`, restoring system stability for all RAG responses and webification tasks.

#### 3. Bilingual Table of Contents (TOC) Extraction
- **Bug**: The LLM-based translation tool responsible for creating the bilingual TOC failed silently due to LLM 404 errors, resulting in the backend returning a truncated (`[]`) TOC.
- **Root Cause**: The source PDF layout already contained built-in Chinese titles. 
- **Fix**: Eliminated the redundant LLM translation phase during the upload endpoint. `main.py` now leverages PyMuPDF (`fitz`) to directly parse the internal PDF document index schema, generating the TOC structure instantaneously and reliably.

#### 4. Image Extraction Colorspace Inversion (Negative Images)
- **Bug**: Photographs extracted from the PDF (such as portraits of Nobel Laureates) were rendering as black-and-white photographic negatives (color inversion).
- **Root Cause**: PyMuPDF extracted raw image bytes stored as `Separation(DeviceCMYK, Black)` channels. In PDF mapping, 0 represents white (no ink) and 255 represents black (full ink density). When directly saved without mapping, PNG interpreted the luminance in reverse (0=black, 255=white).
- **Fix**: Updated `pdf_parser.py` to intercept `Separation` and `CMYK` colorspaces during the image byte stream extraction. Forced PyMuPDF to convert the images to `csGRAY` via the `Pixmap` class before saving to PNG, resolving the luminance scale natively.

#### 5. Image Grid Rendering in Webified Chapters
- **Bug**: Sets of sub-figures (e.g., Figure 1.5 a, b, c, d, e, f) were stretching vertically in a single towering stack when transformed into standard Markdown.
- **Fix**: 
  - Upgraded the `webify_chapter` prompt rules to instruct Gemini to wrap multi-part figures from the same source page into an HTML table-based grid layout.
  - Added the `rehype-raw` plugin to the frontend `ReactMarkdown` renderer within the slug page to allow HTML layout components injected by the LLM to render successfully inside the Tailwind typography prose section. All dark mode `prose-invert` CSS filters were neutralized specifically for images (`prose-img:filter-none`) to prevent inadvertent CSS inversions.

#### 6. TypeScript Interface Fixes
- **Bug**: React state compiler threw `Cannot find name 'setMessages'` due to scoping irregularities in `chat-interface.tsx`.
- **Fix**: Re-typed the `setMessages` and explicit React hooks. Removed unused visual components (e.g., `ScrollArea`, `LayoutDashboard`) and replaced blanket `any` type definitions with strict interfaces for calendar and table dynamics.
