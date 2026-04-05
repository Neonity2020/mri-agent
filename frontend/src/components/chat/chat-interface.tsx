"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Bot, User, Menu, BrainCircuit, Book, Upload, Loader2, Trash2, ChevronDown, ChevronRight, Calendar as CalendarIcon, X, ExternalLink, Download, Plus, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type Conversation = {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
};

type CalendarWeekPlan = {
  week: number;
  theme: string;
  chapters: string[];
  tips: string;
};

type CalendarData = {
  duration_weeks: number;
  plan: CalendarWeekPlan[];
};

type TocItem = {
  zh: string;
  en: string;
  level: number;
  page?: string | number;
};

const WELCOME_MESSAGE: Message = {
  id: '1',
  role: 'assistant',
  content: '欢迎使用 MRI Learning Agent。今天想复习《MRI from Picture to Proton》的哪个章节呢？'
};

function deriveTitle(messages: Message[]): string {
  const firstUserMsg = messages.find(m => m.role === 'user');
  if (firstUserMsg) {
    const text = firstUserMsg.content.trim();
    return text.length > 20 ? text.slice(0, 20) + '...' : text;
  }
  return '新对话';
}

function createNewConversation(): Conversation {
  return {
    id: Date.now().toString(),
    title: '新对话',
    messages: [{ ...WELCOME_MESSAGE, id: Date.now().toString() }],
    createdAt: Date.now(),
  };
}

export default function ChatInterface() {
  const router = useRouter();

  // --- Multi-conversation state ---
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    // Will be populated in useEffect after mount
    return [];
  });
  const [activeId, setActiveId] = useState<string>('');
  const [isMounted, setIsMounted] = useState(false);

  // --- UI state ---
  const [input, setInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isTocExpanded, setIsTocExpanded] = useState(true);
  const [toc, setToc] = useState<TocItem[]>([]);

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null);
  const [isGeneratingCalendar, setIsGeneratingCalendar] = useState(false);

  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Derived: current conversation messages
  const activeConversation = conversations.find(c => c.id === activeId);
  const messages = activeConversation?.messages ?? [];

  // --- Conversation operations ---

  const updateCurrentMessages = React.useCallback((updater: (prev: Message[]) => Message[]) => {
    setConversations(prev => prev.map(conv =>
      conv.id === activeId
        ? { ...conv, messages: updater(conv.messages) }
        : conv
    ));
  }, [activeId]);

  const addConversation = React.useCallback(() => {
    const newConv = createNewConversation();
    setConversations(prev => [newConv, ...prev]);
    setActiveId(newConv.id);
  }, []);

  const switchConversation = React.useCallback((id: string) => {
    setActiveId(id);
  }, []);

  const deleteConversation = React.useCallback((id: string) => {
    setConversations(prev => {
      const remaining = prev.filter(c => c.id !== id);
      if (remaining.length === 0) {
        const newConv = createNewConversation();
        setActiveId(newConv.id);
        return [newConv];
      }
      if (id === activeId || !remaining.find(c => c.id === activeId)) {
        setActiveId(remaining[0].id);
      }
      return remaining;
    });
  }, [activeId]);

  // --- Persistence ---

  React.useEffect(() => {
    setIsMounted(true);

    // Try loading new format first
    const savedConvs = localStorage.getItem('mri-agent-conversations');
    const savedActiveId = localStorage.getItem('mri-agent-active-id');

    if (savedConvs) {
      try {
        const parsed = JSON.parse(savedConvs) as Conversation[];
        if (parsed && parsed.length > 0) {
          setConversations(parsed);
          if (savedActiveId && parsed.find(c => c.id === savedActiveId)) {
            setActiveId(savedActiveId);
          } else {
            setActiveId(parsed[0].id);
          }
          return;
        }
      } catch { /* fall through to migration */ }
    }

    // Migration from old single-conversation format
    const oldHistory = localStorage.getItem('mri-agent-chat-history');
    if (oldHistory) {
      try {
        const parsed = JSON.parse(oldHistory) as Message[];
        if (parsed && parsed.length > 0) {
          const migrated: Conversation = {
            id: Date.now().toString(),
            title: deriveTitle(parsed),
            messages: parsed,
            createdAt: Date.now(),
          };
          setConversations([migrated]);
          setActiveId(migrated.id);
          // Clean up old key
          localStorage.removeItem('mri-agent-chat-history');
          return;
        }
      } catch { /* fall through */ }
    }

    // Fresh start
    const fresh = createNewConversation();
    setConversations([fresh]);
    setActiveId(fresh.id);
  }, []);

  React.useEffect(() => {
    if (isMounted) {
      localStorage.setItem('mri-agent-conversations', JSON.stringify(conversations));
      localStorage.setItem('mri-agent-active-id', activeId);
    }
  }, [conversations, activeId, isMounted]);

  // --- Scroll to bottom ---
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // --- Auto-title on first user message ---
  React.useEffect(() => {
    if (!activeConversation) return;
    if (activeConversation.title !== '新对话') return;
    const hasUserMsg = activeConversation.messages.some(m => m.role === 'user');
    if (!hasUserMsg) return;
    const newTitle = deriveTitle(activeConversation.messages);
    setConversations(prev => prev.map(c =>
      c.id === activeConversation.id && c.title === '新对话'
        ? { ...c, title: newTitle }
        : c
    ));
  }, [messages, activeConversation]);

  // --- Fetch TOC ---
  const fetchToc = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/toc");
      if (res.ok) {
        const data = await res.json();
        setToc(data.toc || []);
      }
    } catch {}
  };

  React.useEffect(() => {
    if (isMounted) fetchToc();
  }, [isMounted]);

  // --- Calendar ---
  const openCalendar = async () => {
     if (toc.length === 0) {
        alert("请先完成教材上传，系统才具有为您制定学习规划的结构依据哦！");
        return;
     }
     setIsCalendarOpen(true);
     if (!calendarData) {
        setIsGeneratingCalendar(true);
        try {
           const res = await fetch("http://localhost:8000/api/calendar");
           if (res.ok) {
              const data = await res.json();
              setCalendarData(data.calendar);
           }
        } catch {} finally {
           setIsGeneratingCalendar(false);
        }
     }
  };

  // --- Export ---
  const exportMarkdown = async (content: string, title?: string) => {
    try {
      const exportTitle = title || 'MRI学习笔记';
      const timestamp = new Date().toLocaleString('zh-CN');
      const fullContent = `# ${exportTitle}\n\n${content}\n\n---\n*由 MRI Learning Agent 生成 | ${timestamp}*\n`;

      const blob = new Blob([fullContent], { type: 'text/markdown; charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);

      const safeTitle = exportTitle.replace(/[^\w\u4e00-\u9fff\-]/g, '_').slice(0, 60);
      const ts = Math.floor(Date.now() / 1000);
      const filename = `${safeTitle}_${ts}.md`;

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  // --- File upload ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    const uploadMsgId = `upload-${Date.now()}`;
    updateCurrentMessages(prev => [...prev, { id: uploadMsgId, role: 'assistant', content: `**[系统上传任务] 开始处理《${file.name}》...**` }]);

    try {
        const res = await fetch('http://localhost:8000/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          throw new Error(`Upload failed with status ${res.status}`);
        }

        if (!res.body) {
          throw new Error('Response body is null');
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let done = false;

        let buffer = '';
        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            buffer += decoder.decode(value, { stream: true });
            const parts = buffer.split('\n\n');
            buffer = parts.pop() || '';

            for (const part of parts) {
               const line = part.trim();
               if (line.startsWith('data: ')) {
                  try {
                    const data = JSON.parse(line.replace('data: ', ''));
                    updateCurrentMessages(prev => prev.map(m => m.id === uploadMsgId ? { ...m, content: m.content + "\n\n" + data.message } : m));
                  } catch (e) {
                    console.error("Parse error:", e, line);
                  }
               }
            }
          }
        }
    } catch {
        updateCurrentMessages(prev => prev.filter(m => m.id !== uploadMsgId).concat({
            id: Date.now().toString(),
            role: 'assistant',
            content: "配置错误或网络原因，无法上传该文档。"
        }));
     } finally {
      setIsUploading(false);
      fetchToc();
    }
  };

  // --- Send message ---
  const handleSend = async (manualInput?: string) => {
    const textToSend = typeof manualInput === 'string' ? manualInput : input;
    if (!textToSend.trim()) return;

    const newMessage: Message = { id: Date.now().toString(), role: 'user', content: textToSend };
    updateCurrentMessages(prev => [...prev, newMessage]);
    if (typeof manualInput !== 'string') {
      setInput('');
    }

    // Add temporary loading indicator message
    const tempId = (Date.now() + 1).toString();
    updateCurrentMessages(prev => [...prev, {
        id: tempId,
        role: 'assistant',
        content: "思考中..."
    }]);

    try {
      const res = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: textToSend })
      });

      if (res.ok) {
        const data = await res.json();
        const reply: string = data.reply;

        const hasExportMarker = reply.includes('[EXPORT_MD]');
        const cleanReply = reply.replace(/\[EXPORT_MD\]/g, '').trim();

        updateCurrentMessages(prev => prev.map(msg =>
          msg.id === tempId ? { ...msg, content: cleanReply } : msg
        ));

        if (hasExportMarker) {
          const titleMatch = cleanReply.match(/^#\s+(.+)$/m);
          const exportTitle = titleMatch ? titleMatch[1] : textToSend.slice(0, 40);
          await exportMarkdown(cleanReply, exportTitle);
        }
      } else {
        updateCurrentMessages(prev => prev.map(msg =>
          msg.id === tempId ? { ...msg, content: "抱歉，知识库 API 当前暂时不可用。" } : msg
        ));
      }
    } catch {
      updateCurrentMessages(prev => prev.map(msg =>
        msg.id === tempId ? { ...msg, content: "网络发生错误，无法连接到 MRI 引擎。" } : msg
      ));
    }
  };

  return (
    <div className="flex h-screen w-full bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 overflow-hidden font-sans">

      {/* Sidebar (Notion-style) */}
      <div className="w-64 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex-col hidden md:flex">
        <div className="p-4 flex items-center gap-2 font-semibold text-sm text-zinc-800 dark:text-zinc-200">
          <div className="bg-zinc-200 dark:bg-zinc-800 p-1.5 rounded-md">
            <BrainCircuit className="h-4 w-4" />
          </div>
          <span>MRI Agent</span>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 py-1 scroll-smooth custom-scrollbar">
          <div className="px-3 space-y-1">

            {/* New Conversation Button */}
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 h-8 px-2 text-xs text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white"
              onClick={addConversation}
            >
              <Plus className="h-4 w-4" />
              新建对话
            </Button>

            {/* Conversation List */}
            <div className="space-y-0.5 mt-1 mb-3">
              {conversations.map(conv => (
                <div
                  key={conv.id}
                  className={`group/conv flex items-center gap-1.5 h-8 px-2 rounded-md cursor-pointer transition-colors text-xs ${
                    conv.id === activeId
                      ? 'bg-zinc-200/70 dark:bg-zinc-800/70 text-black dark:text-white font-medium'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50'
                  }`}
                  onClick={() => switchConversation(conv.id)}
                >
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  <span className="truncate flex-1">{conv.title}</span>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      if (window.confirm('确定删除该对话吗？')) {
                        deleteConversation(conv.id);
                      }
                    }}
                    className="opacity-0 group-hover/conv:opacity-100 shrink-0 p-0.5 hover:text-red-500 transition-opacity"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>

            <div className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2 px-2 mt-4 flex items-center justify-between">
              工作区
            </div>
            <Button
               variant="ghost"
               className="w-full justify-start gap-2 h-8 px-2 text-xs text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white"
               onClick={openCalendar}
            >
              <CalendarIcon className="h-4 w-4" />
              生成学习日历
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-2 h-8 px-2 text-xs font-medium text-black dark:text-white bg-zinc-200/50 dark:bg-zinc-800/50">
              <Book className="h-4 w-4" />
              当前章节
            </Button>
            <div className="pt-2 mt-2 border-t border-zinc-200 dark:border-zinc-800">
              <label className="flex items-center justify-start gap-2 h-8 px-2 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 rounded-md cursor-pointer transition-colors mb-1">
                {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                <span className="font-medium">{isUploading ? "解析底层原理..." : "上传新教材 (PDF)"}</span>
                <input type="file" className="hidden" accept="application/pdf" onChange={handleFileUpload} disabled={isUploading} />
              </label>
            </div>

            {/* Dynamic TOC Sidebar */}
            {toc.length > 0 && (
               <div className="pt-4 mt-2">
                 <div
                   className="flex items-center justify-between px-2 mb-2 cursor-pointer group"
                   onClick={() => setIsTocExpanded(!isTocExpanded)}
                 >
                   <div className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors">
                     全书章节目录 (Index)
                   </div>
                   <div className="text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors">
                     {isTocExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                   </div>
                 </div>

                 {isTocExpanded && (
                   <div className="space-y-1 pb-4">
                     {toc.map((item, idx) => (
                       <div
                         key={idx}
                         onClick={() => router.push(`/chapters/${encodeURIComponent(item.en)}`)}
                         className={`group/item flex flex-col px-2 py-1.5 rounded-md hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer ${item.level === 1 ? 'mt-2' : 'ml-2 border-l border-zinc-200 dark:border-zinc-800 pl-3'}`}
                       >
                         <div className="flex items-center justify-between">
                           <div className="text-[12px] font-medium text-zinc-700 dark:text-zinc-300 leading-snug">
                             {item.zh} <span className="text-[10px] text-zinc-400 font-normal ml-1">p.{item.page}</span>
                           </div>
                           <ExternalLink size={10} className="text-zinc-300 opacity-0 group-hover/item:opacity-100 transition-opacity" />
                         </div>
                         <div className="text-[10px] text-zinc-400 truncate mt-0.5 group-hover/item:text-zinc-500 dark:group-hover/item:text-zinc-400 transition-colors">
                           {item.en}
                         </div>
                       </div>
                     ))}
                   </div>
                 )}
               </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative w-full min-w-0 h-full">

         {/* Top nav mobile */}
         <div className="md:hidden flex items-center p-4 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md sticky top-0 z-10 shrink-0">
           <Button variant="ghost" size="icon" className="-ml-2 mr-2 shrink-0">
             <Menu className="h-5 w-5" />
           </Button>
           <span className="font-semibold text-sm">MRI Agent</span>
         </div>

         {/* Chat Messages */}
         <div ref={scrollRef} className="flex-1 w-full overflow-y-auto min-h-0 relative scroll-smooth">
            <div className="flex flex-col space-y-6 p-4 md:p-8 max-w-4xl mx-auto pb-4">
              {messages.map((m) => (
                <div key={m.id} className={`flex gap-4 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>

                  {m.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-md border border-zinc-200 dark:border-zinc-800 flex items-center justify-center bg-white dark:bg-zinc-900 shrink-0 shadow-sm mt-0.5">
                      <Bot className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                    </div>
                  )}

                  <div className={`max-w-[85%] text-sm leading-relaxed ${m.role === 'user' ? 'bg-zinc-100 dark:bg-zinc-800 rounded-2xl px-4 py-2 text-zinc-900 dark:text-zinc-100' : 'text-zinc-800 dark:text-zinc-300 pt-1'}`}>
                    {m.role === 'user' ? (
                      m.content
                    ) : (
                      <>
                        <div className="prose prose-sm dark:prose-invert prose-zinc max-w-none text-zinc-800 dark:text-zinc-300 [&>p:last-child]:mb-0 [&>p:first-child]:mt-0">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                          >
                            {m.content.replace(/\[EXPORT_MD\]/g, '')}
                          </ReactMarkdown>
                        </div>
                        {m.content !== '思考中...' && (
                          <button
                            onClick={() => {
                              const titleMatch = m.content.match(/^#\s+(.+)$/m);
                              const title = titleMatch ? titleMatch[1] : 'MRI学习笔记';
                              exportMarkdown(m.content.replace(/\[EXPORT_MD\]/g, ''), title);
                            }}
                            className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all duration-200 group"
                            title="导出为 Markdown 文件"
                          >
                            <Download size={12} className="group-hover:scale-110 transition-transform" />
                            导出 Markdown
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  {m.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center shrink-0 overflow-hidden shadow-sm mt-0.5">
                      <User className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                    </div>
                  )}
                </div>
              ))}
            </div>
         </div>

         {/* Input Area */}
         <div className="w-full bg-white dark:bg-zinc-950 p-4 md:px-6 md:pb-8 flex justify-center shrink-0">
            <div className="w-full max-w-3xl">
              <Card className="flex items-center overflow-hidden border-zinc-200 dark:border-zinc-800 shadow-sm bg-white dark:bg-zinc-900 p-1.5 rounded-xl">
                 <Input
                   placeholder="向 MRI Agent 提问任意概念..."
                   className="flex-1 border-0 shadow-none focus-visible:ring-0 px-3 text-[15px]"
                   value={input}
                   onChange={e => setInput(e.target.value)}
                   onKeyDown={e => e.key === 'Enter' && handleSend()}
                 />
                 <Button size="icon" onClick={() => handleSend()} disabled={!input.trim()} variant="ghost" className="h-9 w-9 text-zinc-500 hover:text-black dark:hover:text-white rounded-lg transition-colors shrink-0">
                   <Send className="h-4 w-4" />
                 </Button>
              </Card>
              <div className="text-center mt-2 text-[10px] text-zinc-400 dark:text-zinc-500">
                 MRI 学习助手由人工智能驱动，切勿轻信关键医学凭据。
              </div>
            </div>
         </div>

      </div>

      {/* Calendar Modal */}
      {isCalendarOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-white dark:bg-zinc-950 rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh] border border-zinc-200 dark:border-zinc-800">

             <div className="flex items-center justify-between p-5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 shrink-0">
               <div className="flex items-center gap-3">
                 <div className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 p-2 rounded-lg">
                   <CalendarIcon size={20} />
                 </div>
                 <div>
                   <h2 className="font-semibold text-lg text-black dark:text-white tracking-tight">专属学习规划日历</h2>
                   <p className="text-xs text-zinc-500">Agent 基于原版双语目录智能结构化提取生成</p>
                 </div>
               </div>
               <button onClick={() => setIsCalendarOpen(false)} className="text-zinc-400 hover:text-black dark:hover:text-white transition-colors bg-zinc-200/50 dark:bg-zinc-800 p-2 rounded-full">
                 <X size={18} />
               </button>
             </div>

             <div className="flex-1 overflow-y-auto p-6 bg-zinc-50/50 dark:bg-zinc-950/50 custom-scrollbar relative">
                {isGeneratingCalendar ? (
                  <div className="flex flex-col items-center justify-center h-64 space-y-4">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    <p className="text-sm text-zinc-500 font-medium animate-pulse">正在调度 Agent 深层推演多周学习时间线...</p>
                  </div>
                ) : calendarData ? (
                  <div className="relative isolate">
                    {/* Vertical Timeline Line */}
                    <div className="absolute left-[27px] top-4 bottom-4 w-[2px] bg-zinc-200 dark:bg-zinc-800 -z-10"></div>

                    <div className="space-y-8">
                      {calendarData.plan.map((week, i: number) => (
                        <div key={i} className="relative flex gap-6">
                           {/* Timeline Node */}
                           <div className="relative z-10 w-14 h-14 bg-white dark:bg-zinc-900 border-[3px] border-zinc-100 dark:border-zinc-950 rounded-full flex items-center justify-center shadow-sm shrink-0">
                             <div className="w-full h-full border border-zinc-200 dark:border-zinc-800 rounded-full flex flex-col items-center justify-center bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                               <span className="text-[9px] font-bold uppercase -mb-0.5 tracking-wider">Week</span>
                               <span className="text-lg font-black">{week.week}</span>
                             </div>
                           </div>

                           {/* Content Card */}
                           <div className="flex-1 pt-1.5 pb-2">
                             <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm hover:shadow-md transition-all group">
                               <h3 className="text-base font-bold text-black dark:text-white mb-3 group-hover:text-blue-500 transition-colors">{week.theme}</h3>

                               <div className="flex flex-wrap gap-2 mb-4">
                                 {week.chapters.map((ch: string, j: number) => (
                                   <span key={j} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 border border-zinc-200/50 dark:border-zinc-700/50">
                                     <Book size={10} className="text-zinc-400" />
                                     {ch}
                                   </span>
                                 ))}
                               </div>

                               <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-lg p-3">
                                 <p className="text-[12px] text-amber-800 dark:text-amber-400 leading-relaxed font-medium flex gap-2">
                                   <span className="shrink-0 text-amber-500 text-[14px]">💡</span>
                                   {week.tips}
                                 </p>
                               </div>
                             </div>
                           </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-48 text-red-500 text-sm font-medium">日历生成失败，请确认是否成功上传了有效的教材结构文件。</div>
                )}
             </div>

             {/* Modal Footer */}
             {calendarData && !isGeneratingCalendar && (
               <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex justify-between items-center text-xs shrink-0">
                 <span className="text-zinc-500">一共为您整理出了完整的 <b className="text-black dark:text-white">{calendarData.duration_weeks}</b> 周学习规划跨度。</span>
                 <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setIsCalendarOpen(false)}>知道了，去学习</Button>
               </div>
             )}

           </div>
        </div>
      )}

    </div>
  );
}
