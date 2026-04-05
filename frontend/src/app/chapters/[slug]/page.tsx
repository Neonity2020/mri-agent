"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import 'katex/dist/katex.min.css';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, BookOpen, Share2, Printer, PanelRightOpen, PanelRightClose, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';

export default function ChapterPage() {
  const params = useParams();
  const router = useRouter();
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const slug = decodeURIComponent(params.slug as string);

  // PDF sidebar state
  const [showPdf, setShowPdf] = useState(false);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfScale, setPdfScale] = useState(1.5);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfReady, setPdfReady] = useState(false);

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

  // Load PDF when sidebar opens
  const [pageImages, setPageImages] = useState<string[]>([]);

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
        if (!response.ok) throw new Error(`PDF fetch failed: ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const total = pdf.numPages;
        setNumPages(total);
        setCurrentPage(1);

        // Render each page to an image data URL
        const images: string[] = [];
        for (let i = 1; i <= total; i++) {
          if (cancelled) return;
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: pdfScale });

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
  }, [showPdf, slug, pdfScale]);

  const scrollToPage = useCallback((page: number) => {
    setCurrentPage(page);
    const el = document.getElementById(`pdf-page-${page}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const handleZoomIn = () => setPdfScale(s => Math.min(s + 0.25, 3.0));
  const handleZoomOut = () => setPdfScale(s => Math.max(s - 0.25, 0.5));

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
            <Button variant="ghost" size="icon" className="hidden sm:flex rounded-full" onClick={() => setShowPdf(v => !v)} title={showPdf ? '关闭 PDF 侧栏' : '打开 PDF 侧栏'}>
              {showPdf ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="hidden sm:flex rounded-full">
              <Share2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="hidden sm:flex rounded-full" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
            </Button>
            <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-1 hidden sm:block" />
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-4 h-8 text-xs font-semibold" onClick={() => router.push('/')}>
              进入深度对话
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content + Sidebar Layout */}
      <div className="flex min-h-[calc(100vh-3.5rem)]">
        {/* Content Area */}
        <main className={`flex-1 min-w-0 transition-all duration-300 ${showPdf ? 'max-w-[55%]' : 'max-w-3xl mx-auto'}`}>
          {/* Hero Section */}
          <div className="w-full bg-zinc-50 dark:bg-zinc-900/30 border-b border-zinc-200 dark:border-zinc-800 py-12 px-4">
            <div className="max-w-3xl mx-auto">
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
            <article className="prose prose-zinc dark:prose-invert max-w-none
              prose-headings:font-black prose-headings:tracking-tight
              prose-h1:text-3xl prose-h2:text-2xl prose-h2:border-b prose-h2:border-zinc-200 dark:prose-h2:border-zinc-800 prose-h2:pb-2 prose-h2:mt-16
              prose-p:leading-relaxed prose-p:text-zinc-700 dark:prose-p:text-zinc-300
              prose-strong:text-black dark:prose-strong:text-white
              prose-blockquote:border-blue-500 prose-blockquote:bg-blue-50/50 dark:prose-blockquote:bg-blue-900/10 prose-blockquote:rounded-r-xl prose-blockquote:py-1
              prose-img:rounded-2xl prose-img:shadow-xl prose-img:filter-none
              selection:bg-blue-100 dark:selection:bg-blue-900/50">
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
          <aside className="w-[45%] min-w-[300px] max-w-[600px] border-l border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/30 flex flex-col shrink-0 sticky top-14 h-[calc(100vh-3.5rem)]">
            {/* Sidebar Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/80 shrink-0">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-blue-500" />
                <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">原版 PDF</span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomOut}>
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
                <span className="text-[11px] text-zinc-500 w-10 text-center">{Math.round(pdfScale * 100)}%</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomIn}>
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* PDF Pages */}
            <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-3">
              {pdfLoading ? (
                <div className="flex flex-col items-center justify-center h-64 gap-3">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                  <p className="text-xs text-zinc-500">加载 PDF 中...</p>
                </div>
              ) : pdfReady && pageImages.length > 0 ? (
                pageImages.map((src, i) => (
                  <div key={i} className="relative">
                    <img
                      src={src}
                      alt={`Page ${i + 1}`}
                      className="w-full h-auto bg-white rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700"
                    />
                    <div className="absolute bottom-1 right-2 text-[10px] text-zinc-400 bg-white/80 dark:bg-zinc-900/80 px-1.5 py-0.5 rounded">
                      {i + 1} / {numPages}
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-64 gap-3 text-center px-4">
                  <p className="text-sm text-zinc-500">无法加载 PDF</p>
                  <p className="text-xs text-zinc-400">请确认 chapters/ 目录下存在对应的章节文件</p>
                </div>
              )}
            </div>

            {/* Page Navigation */}
            {numPages > 0 && (
              <div className="flex items-center justify-center gap-3 px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/80 shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => scrollToPage(Math.max(1, currentPage - 1))} disabled={currentPage <= 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">
                  {currentPage} / {numPages}
                </span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => scrollToPage(Math.min(numPages, currentPage + 1))} disabled={currentPage >= numPages}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Simple Footer */}
      <footer className="py-12 border-t border-zinc-100 dark:border-zinc-900 text-center text-xs text-zinc-400">
        © 2026 MRI Learning Agent SaaS • 由自主 AI 引擎驱动的医学物理学习体验
      </footer>
    </div>
  );
}
