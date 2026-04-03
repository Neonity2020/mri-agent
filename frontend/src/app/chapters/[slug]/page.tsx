"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import 'katex/dist/katex.min.css';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, BookOpen, Share2, Printer } from 'lucide-react';

export default function ChapterPage() {
  const params = useParams();
  const router = useRouter();
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const slug = decodeURIComponent(params.slug as string);

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
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
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

      {/* Content Area */}
      <main className="max-w-3xl mx-auto px-4 py-16">
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
      </main>

      {/* Simple Footer */}
      <footer className="py-12 border-t border-zinc-100 dark:border-zinc-900 text-center text-xs text-zinc-400">
        © 2026 MRI Learning Agent SaaS • 由自主 AI 引擎驱动的医学物理学习体验
      </footer>
    </div>
  );
}
