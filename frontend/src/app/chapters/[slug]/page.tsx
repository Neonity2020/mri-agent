"use client";

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import 'katex/dist/katex.min.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, ArrowLeft, BookOpen, Share2, Printer, PanelRightOpen, PanelRightClose, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, MessageSquare, Send, Bot, User, Download } from 'lucide-react';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

export default function ChapterPage() {
  const params = useParams();
  const router = useRouter();
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const slug = decodeURIComponent(params.slug as string);

  const handleDownloadMd = () => {
    const safeTitle = String(slug).replace(/[^\w\u4e00-\u9fff\-]/g, '_').replace(/^_+|_+$/g, '').substring(0, 50);
    const blob = new Blob([`# ${slug}\n\n${content}\n\n---\n*由 MRI Learning Agent 生成 | ${new Date().toLocaleString()}*`], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeTitle.length > 0 ? safeTitle : 'chapter'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Sidebar toggle state
  const [showPdf, setShowPdf] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const hasSidebar = showPdf || showChat;

  // Sidebar widths (px)
  const [pdfWidth, setPdfWidth] = useState(380);
  const [chatWidth, setChatWidth] = useState(380);

  // Resize handle logic
  const resizing = useRef<{ target: 'pdf' | 'chat'; startX: number; startWidth: number } | null>(null);

  const onResizeMouseDown = useCallback((target: 'pdf' | 'chat', e: React.MouseEvent) => {
    e.preventDefault();
    const currentWidth = target === 'pdf' ? pdfWidth : chatWidth;
    resizing.current = { target, startX: e.clientX, startWidth: currentWidth };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [pdfWidth, chatWidth]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!resizing.current) return;
      const { target, startX, startWidth } = resizing.current;
      // Dragging left edge rightward = moving mouse left = negative delta = wider sidebar
      const delta = startX - e.clientX;
      const newWidth = Math.max(280, Math.min(window.innerWidth * 0.5, startWidth + delta));
      if (target === 'pdf') setPdfWidth(newWidth);
      else setChatWidth(newWidth);
    };
    const onMouseUp = () => {
      resizing.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); };
  }, []);

  // --- PDF sidebar state ---
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfZoom, setPdfZoom] = useState(100);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfReady, setPdfReady] = useState(false);
  const [pageImages, setPageImages] = useState<string[]>([]);

  // --- Chat sidebar state ---
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: '0', role: 'assistant', content: `你好！我是 MRI Learning Agent，当前正在阅读「${slug}」章节。有任何疑问都可以问我。` }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // ============================
  // Chapter content fetching
  // ============================
  useEffect(() => {
    const fetchChapter = async () => {
      setLoading(true);
      try {
        const res = await fetch(`http://localhost:8000/api/chapters/${encodeURIComponent(slug)}`);
        if (res.ok) {
          const data = await res.json();
          setContent(data.content);
        } else {
          const errData = await res.json();
          setError(errData.detail || '无法加载章节内容');
        }
      } catch (_err) {
        setError('无法连接到服务器');
      } finally {
        setLoading(false);
      }
    };
    fetchChapter();
  }, [slug]);

  // ============================
  // PDF rendering
  // ============================
  useEffect(() => {
    if (!showPdf) {
      setPageImages([]);
      setPdfReady(false);
      return;
    }

    let cancelled = false;

    const loadPdf = async () => {
      setPdfLoading(true);
      setPageImages([]);
      try {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url
        ).toString();

        const url = `http://localhost:8000/api/chapter-pdf/${encodeURIComponent(slug)}`;
        const response = await fetch(url);
        if (!response.ok) {
          if (response.status === 404) {
             // 优雅处理 404 错误，不在控制台抛出报错堆栈
             // 直接 return 会让 pdfReady 保持为 false，UI 自然展示"无法加载"的回退状态
             return;
          }
          throw new Error(`PDF fetch failed: ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const total = pdf.numPages;
        setNumPages(total);
        setCurrentPage(1);

        const renderScale = 1.5;
        const images: string[] = [];
        for (let i = 1; i <= total; i++) {
          if (cancelled) return;
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: renderScale });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const context = canvas.getContext('2d')!;
          await page.render({ canvasContext: context, viewport, canvas }).promise;
          images.push(canvas.toDataURL('image/png'));
        }

        if (!cancelled) {
          setPageImages(images);
          setPdfReady(true);
        }
      } catch (err) {
        console.error('PDF load error:', err);
        setPdfReady(false);
      } finally {
        if (!cancelled) setPdfLoading(false);
      }
    };

    loadPdf();
    return () => { cancelled = true; };
  }, [showPdf, slug]);

  const scrollToPage = useCallback((page: number) => {
    setCurrentPage(page);
    const el = document.getElementById(`pdf-page-${page}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handleZoomIn = () => setPdfZoom(z => Math.min(z + 25, 300));
  const handleZoomOut = () => setPdfZoom(z => Math.max(z - 25, 50));

  // Drag-to-pan for PDF
  const pdfScrollRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  const onDragMouseDown = useCallback((e: React.MouseEvent) => {
    const el = pdfScrollRef.current;
    if (!el || e.button !== 0) return;
    isDragging.current = true;
    el.style.cursor = 'grabbing';
    dragStart.current = { x: e.clientX, y: e.clientY, scrollLeft: el.scrollLeft, scrollTop: el.scrollTop };
    e.preventDefault();
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const el = pdfScrollRef.current;
      if (!el) return;
      el.scrollLeft = dragStart.current.scrollLeft - (e.clientX - dragStart.current.x);
      el.scrollTop = dragStart.current.scrollTop - (e.clientY - dragStart.current.y);
    };
    const onMouseUp = () => {
      isDragging.current = false;
      if (pdfScrollRef.current) pdfScrollRef.current.style.cursor = 'grab';
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); };
  }, []);

  // ============================
  // Chat logic
  // ============================
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const handleChatSend = async () => {
    const text = chatInput.trim();
    if (!text || chatSending) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: text };
    const tempId = (Date.now() + 1).toString();
    setChatMessages(prev => [...prev, userMsg, { id: tempId, role: 'assistant', content: '思考中...' }]);
    setChatInput('');
    setChatSending(true);

    try {
      const res = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `[当前阅读章节: ${slug}] ${text}` }),
      });

      if (res.ok) {
        const data = await res.json();
        const reply: string = data.reply;
        const cleanReply = reply.replace(/\[EXPORT_MD\]/g, '').trim();
        setChatMessages(prev => prev.map(m => m.id === tempId ? { ...m, content: cleanReply } : m));
      } else {
        setChatMessages(prev => prev.map(m => m.id === tempId ? { ...m, content: '抱歉，服务暂时不可用。' } : m));
      }
    } catch {
      setChatMessages(prev => prev.map(m => m.id === tempId ? { ...m, content: '网络错误，无法连接到引擎。' } : m));
    } finally {
      setChatSending(false);
    }
  };

  // ============================
  // Loading / Error states
  // ============================
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white dark:bg-zinc-950">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
        <p className="text-zinc-500 font-medium animate-pulse">正在从底层知识库中提取并 Web 化章节内容...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white dark:bg-zinc-950 p-6 text-center">
        <div className="bg-red-50 dark:bg-red-950/30 p-4 rounded-xl border border-red-100 dark:border-red-900/30 max-w-md">
          <h2 className="text-red-700 dark:text-red-400 font-bold mb-2">出错了</h2>
          <p className="text-red-600 dark:text-red-500 text-sm">{error}</p>
          <Button variant="outline" className="mt-4 border-red-200 dark:border-red-800" onClick={() => router.push('/')}>
            返回首页
          </Button>
        </div>
      </div>
    );
  }

  // ============================
  // Main render
  // ============================
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans selection:bg-blue-100 dark:selection:bg-blue-900/50">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 w-full border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-full mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push('/')} className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800" />
            <div className="flex items-center gap-2 overflow-hidden">
              <BookOpen className="h-4 w-4 text-blue-500 shrink-0" />
              <span className="text-sm font-semibold truncate max-w-[200px] md:max-w-md">{slug}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* PDF toggle */}
            <Button variant="ghost" size="icon" className={`hidden sm:flex rounded-full ${showPdf ? 'bg-zinc-100 dark:bg-zinc-800' : ''}`} onClick={() => setShowPdf(v => !v)} title={showPdf ? '关闭 PDF 侧栏' : '打开 PDF 侧栏'}>
              <BookOpen className="h-4 w-4" />
            </Button>
            {/* Chat toggle */}
            <Button variant="ghost" size="icon" className={`hidden sm:flex rounded-full ${showChat ? 'bg-zinc-100 dark:bg-zinc-800' : ''}`} onClick={() => setShowChat(v => !v)} title={showChat ? '关闭对话侧栏' : '打开 AI 对话'}>
              <MessageSquare className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="hidden sm:flex rounded-full" onClick={handleDownloadMd} title="下载 Markdown 笔记">
              <Download className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="hidden sm:flex rounded-full">
              <Share2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="hidden sm:flex rounded-full" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
            </Button>
            <div className="h-4 w-px bg-zinc-200 dark:border-zinc-800 mx-1 hidden sm:block" />
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-4 h-8 text-xs font-semibold" onClick={() => router.push('/')}>
              主控制台
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content + Sidebars */}
      <div className="flex min-h-[calc(100vh-3.5rem)]">
        {/* Content Area */}
        <main className={`flex-1 min-w-0 overflow-x-auto transition-all duration-300 ${hasSidebar ? '' : 'max-w-3xl mx-auto'}`}>
          {/* Hero Section */}
          <div className="w-full bg-zinc-50 dark:bg-zinc-900/30 border-b border-zinc-200 dark:border-zinc-800 py-12 px-4">
            <div className={hasSidebar ? 'px-4' : 'max-w-3xl mx-auto'}>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[11px] font-bold uppercase tracking-wider mb-6">
                CHAPTER WEBIFICATION
              </div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tight text-black dark:text-white leading-[1.1]">
                {slug}
              </h1>
              <div className="mt-8 flex items-center gap-4 text-sm text-zinc-500">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center">
                    <span className="text-[10px] font-bold">AI</span>
                  </div>
                  <span>MRI Learning Agent 驱动</span>
                </div>
                <span>•</span>
                <span>基于原版 PDF 智能重组</span>
              </div>
            </div>
          </div>

          <div className="px-4 py-16">
            {/* Vocabulary table styles */}
            <style>{`
              .vocab-table {
                width: 100%;
                border-collapse: separate;
                border-spacing: 0;
                border-radius: 12px;
                overflow: hidden;
                border: 1px solid rgba(161,161,170,0.2);
                margin: 2rem 0;
                font-size: 0.875rem;
                line-height: 1.6;
              }
              .vocab-table thead {
                position: sticky;
                top: 0;
                z-index: 2;
              }
              .vocab-table thead tr {
                background: linear-gradient(135deg, #1e3a5f 0%, #1e293b 100%);
              }
              .vocab-table thead th {
                padding: 14px 16px;
                text-align: left;
                font-weight: 700;
                color: #e2e8f0;
                font-size: 0.8rem;
                letter-spacing: 0.05em;
                text-transform: uppercase;
                border-bottom: 2px solid rgba(59,130,246,0.3);
              }
              .vocab-table thead th:first-child {
                width: 140px;
                min-width: 100px;
              }
              .vocab-table thead th:nth-child(2) {
                width: 280px;
                min-width: 180px;
              }
              .vocab-table tbody tr {
                transition: background-color 0.15s ease;
              }
              .vocab-table tbody tr:nth-child(odd) {
                background-color: rgba(248,250,252,0.6);
              }
              .vocab-table tbody tr:nth-child(even) {
                background-color: rgba(241,245,249,0.4);
              }
              .vocab-table tbody tr:hover {
                background-color: rgba(219,234,254,0.5);
              }
              .vocab-table tbody td {
                padding: 10px 16px;
                border-bottom: 1px solid rgba(226,232,240,0.6);
                vertical-align: top;
                color: #334155;
              }
              .vocab-table tbody td:first-child {
                font-family: 'SF Mono', 'Fira Code', monospace;
                font-size: 0.82rem;
                color: #1e40af;
                white-space: nowrap;
              }
              .vocab-table tbody td:nth-child(2) {
                font-style: italic;
                color: #64748b;
                font-size: 0.82rem;
              }
              .vocab-table tbody tr:last-child td {
                border-bottom: none;
              }
              @media (prefers-color-scheme: dark) {
                .vocab-table {
                  border-color: rgba(63,63,70,0.5);
                }
                .vocab-table thead tr {
                  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
                }
                .vocab-table thead th {
                  color: #94a3b8;
                  border-bottom-color: rgba(59,130,246,0.2);
                }
                .vocab-table tbody tr:nth-child(odd) {
                  background-color: rgba(30,41,59,0.4);
                }
                .vocab-table tbody tr:nth-child(even) {
                  background-color: rgba(15,23,42,0.3);
                }
                .vocab-table tbody tr:hover {
                  background-color: rgba(30,58,95,0.4);
                }
                .vocab-table tbody td {
                  border-bottom-color: rgba(63,63,70,0.4);
                  color: #cbd5e1;
                }
                .vocab-table tbody td:first-child {
                  color: #60a5fa;
                }
                .vocab-table tbody td:nth-child(2) {
                  color: #94a3b8;
                }
              }
            `}</style>
            <article className={`prose prose-zinc dark:prose-invert max-w-none ${hasSidebar ? 'prose-sm' : ''} prose-headings:font-black prose-headings:tracking-tight prose-h1:text-3xl prose-h2:text-2xl prose-h2:border-b prose-h2:border-zinc-200 dark:prose-h2:border-zinc-800 prose-h2:pb-2 prose-h2:mt-16 prose-p:leading-relaxed prose-p:text-zinc-700 dark:prose-p:text-zinc-300 prose-strong:text-black dark:prose-strong:text-white prose-blockquote:border-blue-500 prose-blockquote:bg-blue-50/50 dark:prose-blockquote:bg-blue-900/10 prose-blockquote:rounded-r-xl prose-blockquote:py-1 prose-img:rounded-2xl prose-img:shadow-xl prose-img:filter-none selection:bg-blue-100 dark:selection:bg-blue-900/50`}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex, rehypeRaw]}
              >
                {content}
              </ReactMarkdown>
            </article>

            {/* Navigation Footer */}
            <div className="mt-24 pt-8 border-t border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="text-sm text-zinc-500">
                阅读完本章后，建议返回主界面针对疑难点进行定向提问。
              </div>
              <div className="flex items-center gap-3">
                 <Button variant="outline" className="rounded-full" onClick={() => router.push('/')}>
                   主控制台
                 </Button>
                 <Button className="bg-black dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-full px-6" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                   回到顶部
                 </Button>
              </div>
            </div>
          </div>
        </main>

        {/* PDF Sidebar */}
        {showPdf && (
          <aside
            className="border-l border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/30 flex flex-col shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] relative"
            style={{ width: pdfWidth }}
          >
            {/* Resize handle */}
            <div
              className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-400/30 active:bg-blue-400/50 transition-colors z-10"
              onMouseDown={e => onResizeMouseDown('pdf', e)}
            />
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/80 shrink-0">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-blue-500" />
                <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">原版 PDF</span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomOut}>
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
                <span className="text-[11px] text-zinc-500 w-10 text-center">{pdfZoom}%</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomIn}>
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div
              ref={pdfScrollRef}
              onMouseDown={onDragMouseDown}
              className="flex-1 overflow-auto min-h-0 p-4 space-y-3 select-none cursor-grab"
            >
              {pdfLoading ? (
                <div className="flex flex-col items-center justify-center h-64 gap-3">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                  <p className="text-xs text-zinc-500">加载 PDF 中...</p>
                </div>
              ) : pdfReady && pageImages.length > 0 ? (
                <div
                  className="space-y-3"
                  style={{
                    display: 'inline-block',
                    minWidth: `${pdfZoom}%`,
                  }}
                >
                {pageImages.map((src, i) => (
                  <div key={i} className="relative">
                    <img src={src} alt={`Page ${i + 1}`} className="w-full h-auto bg-white rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700" />
                    <div className="absolute bottom-1 right-2 text-[10px] text-zinc-400 bg-white/80 dark:bg-zinc-900/80 px-1.5 py-0.5 rounded">
                      {i + 1} / {numPages}
                    </div>
                  </div>
                ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 gap-3 text-center px-4">
                  <p className="text-sm text-zinc-500">无法加载 PDF</p>
                  <p className="text-xs text-zinc-400">请确认 chapters/ 目录下存在对应的章节文件</p>
                </div>
              )}
            </div>

            {numPages > 0 && (
              <div className="flex items-center justify-center gap-3 px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/80 shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => scrollToPage(Math.max(1, currentPage - 1))} disabled={currentPage <= 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">{currentPage} / {numPages}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => scrollToPage(Math.min(numPages, currentPage + 1))} disabled={currentPage >= numPages}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </aside>
        )}

        {/* Chat Sidebar */}
        {showChat && (
          <aside
            className="border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-col shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] relative"
            style={{ width: chatWidth }}
          >
            {/* Resize handle */}
            <div
              className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-400/30 active:bg-blue-400/50 transition-colors z-10"
              onMouseDown={e => onResizeMouseDown('chat', e)}
            />
            {/* Chat Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/80 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Bot className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">AI 对话</span>
              </div>
              <span className="text-[10px] text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">{slug}</span>
            </div>

            {/* Chat Messages */}
            <div ref={chatScrollRef} className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4">
              {chatMessages.map(m => (
                <div key={m.id} className={`flex gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {m.role === 'assistant' && (
                    <div className="w-6 h-6 rounded-md border border-zinc-200 dark:border-zinc-800 flex items-center justify-center bg-white dark:bg-zinc-900 shrink-0 mt-0.5">
                      <Bot className="w-3.5 h-3.5 text-zinc-500" />
                    </div>
                  )}
                  <div className={`max-w-[85%] text-[13px] leading-relaxed ${m.role === 'user' ? 'bg-zinc-100 dark:bg-zinc-800 rounded-2xl px-3 py-1.5 text-zinc-900 dark:text-zinc-100' : 'text-zinc-700 dark:text-zinc-300'}`}>
                    {m.role === 'user' ? (
                      <p>{m.content}</p>
                    ) : (
                      <div className="prose prose-sm dark:prose-invert prose-zinc max-w-none text-zinc-700 dark:text-zinc-300 [&>p:last-child]:mb-0 [&>p:first-child]:mt-0">
                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                          {m.content}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                  {m.role === 'user' && (
                    <div className="w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
                      <User className="w-3.5 h-3.5 text-zinc-500" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Chat Input */}
            <div className="px-3 py-3 border-t border-zinc-200 dark:border-zinc-800 shrink-0">
              <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 px-3 py-1.5">
                <Input
                  placeholder="针对本章提问..."
                  className="flex-1 border-0 shadow-none focus-visible:ring-0 bg-transparent px-0 text-sm"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleChatSend()}
                  disabled={chatSending}
                />
                <Button size="icon" onClick={handleChatSend} disabled={!chatInput.trim() || chatSending} variant="ghost" className="h-7 w-7 text-zinc-500 hover:text-black dark:hover:text-white shrink-0">
                  {chatSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-[10px] text-zinc-400 text-center mt-1.5">回答基于已上传的 PDF 教材内容</p>
            </div>
          </aside>
        )}
      </div>

      {/* Footer */}
      <footer className="py-12 border-t border-zinc-100 dark:border-zinc-900 text-center text-xs text-zinc-400">
        © 2026 MRI Learning Agent SaaS • 由自主 AI 引擎驱动的医学物理学习体验
      </footer>
    </div>
  );
}
