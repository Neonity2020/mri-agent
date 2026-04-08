"use client";

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { BookOpen, Upload, Bot, MessageSquare, ArrowRight, Mail, Lock, User } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-zinc-950 dark:to-zinc-900">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-white/80 dark:border-zinc-800/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-white">MRI Learning Agent</h1>
          </div>
          <nav className="flex items-center gap-6">
            <Button variant="ghost" className="text-zinc-700 hover:text-blue-600 dark:text-zinc-300 dark:hover:text-blue-400">
              功能介绍
            </Button>
            <Button variant="ghost" className="text-zinc-700 hover:text-blue-600 dark:text-zinc-300 dark:hover:text-blue-400">
              定价
            </Button>
            <Button variant="ghost" className="text-zinc-700 hover:text-blue-600 dark:text-zinc-300 dark:hover:text-blue-400">
              关于我们
            </Button>
            <Button variant="ghost" className="text-zinc-700 hover:text-blue-600 dark:text-zinc-300 dark:hover:text-blue-400">
              登录
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white">
              注册
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative px-4 pt-24 pb-20">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-sm font-semibold mb-8">
            <Bot className="w-4 h-4" />
            AI 驱动的医学物理学习平台
          </div>
          <h2 className="text-5xl md:text-6xl font-bold text-zinc-900 dark:text-white mb-6 leading-tight">
            体验下一代
            <span className="block bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              MRI 学习方式
            </span>
          </h2>
          <p className="text-xl text-zinc-600 dark:text-zinc-300 max-w-3xl mx-auto mb-12">
            上传医学物理教材，让 AI 将复杂概念转化为交互式学习体验。智能问答、个性化学习计划，让掌握 MRI 原理从未如此简单。
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Button size="lg" className="bg-black hover:bg-zinc-800 text-white text-lg px-8 py-6 rounded-lg shadow-lg">
              <Upload className="w-5 h-5 mr-2" />
              上传 PDF 开始学习
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8 py-6 rounded-lg border-zinc-300 dark:border-zinc-700">
              <MessageSquare className="w-5 h-5 mr-2" />
              演示对话
            </Button>
          </div>

          {/* Feature Cards */}
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <Card className="bg-white/80 backdrop-blur-sm border-zinc-200 dark:bg-zinc-800/80 dark:border-zinc-700">
              <CardHeader className="text-center pb-4">
                <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-3">
                  <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <CardTitle className="text-lg">智能教材解析</CardTitle>
                <CardDescription>
                  自动提取章节结构，智能处理图像和公式，生成结构化的学习内容
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-zinc-200 dark:bg-zinc-800/80 dark:border-zinc-700">
              <CardHeader className="text-center pb-4">
                <div className="w-12 h-12 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-3">
                  <MessageSquare className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <CardTitle className="text-lg">AI 问答助手</CardTitle>
                <CardDescription>
                  基于教材内容的深度问答，随时解答疑问，深入理解复杂概念
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-zinc-200 dark:bg-zinc-800/80 dark:border-zinc-700">
              <CardHeader className="text-center pb-4">
                <div className="w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mx-auto mb-3">
                  <Bot className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <CardTitle className="text-lg">个性化学习计划</CardTitle>
                <CardDescription>
                  根据学习进度智能推荐重点，制定专属学习路径
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Auth Section */}
      <section className="bg-white/50 dark:bg-zinc-800/50 backdrop-blur-sm border-y border-zinc-200 dark:border-zinc-700">
        <div className="max-w-4xl mx-auto px-4 py-16">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-zinc-900 dark:text-white mb-4">
              开启您的学习之旅
            </h3>
            <p className="text-lg text-zinc-600 dark:text-zinc-300">
              注册账户，保存学习进度，享受个性化学习体验
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto">
            {/* Login Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">已有账户？登录</CardTitle>
                <CardDescription>
                  登录后继续您未完成的学习
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <Input
                      type="email"
                      placeholder="邮箱地址"
                      className="pl-10"
                    />
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <Input
                      type="password"
                      placeholder="密码"
                      className="pl-10"
                    />
                  </div>
                </div>
                <Button className="w-full">
                  登录
                </Button>
                <div className="text-center">
                  <Button variant="ghost" size="sm" className="text-zinc-600 dark:text-zinc-300">
                    忘记密码？
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Register Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">新用户？注册</CardTitle>
                <CardDescription>
                  创建账户，立即开始学习
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <Input
                      type="text"
                      placeholder="姓名"
                      className="pl-10"
                    />
                  </div>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <Input
                      type="email"
                      placeholder="邮箱地址"
                      className="pl-10"
                    />
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <Input
                      type="password"
                      placeholder="密码"
                      className="pl-10"
                    />
                  </div>
                </div>
                <Button className="w-full">
                  注册
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="text-center mt-8">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              继续即表示您同意我们的
              <Button variant="link" className="p-0 h-auto text-blue-600 hover:text-blue-700 dark:text-blue-400">
                服务条款
              </Button>
              和
              <Button variant="link" className="p-0 h-auto text-blue-600 hover:text-blue-700 dark:text-blue-400">
                隐私政策
              </Button>
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm border-t border-zinc-200 dark:border-zinc-700 py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-zinc-900 dark:text-white">MRI Learning Agent</span>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-8">
              © 2026 MRI Learning Agent SaaS • 由自主 AI 引擎驱动的医学物理学习体验
            </p>
            <div className="flex flex-wrap justify-center gap-6 text-sm text-zinc-600 dark:text-zinc-400">
              <a href="#" className="hover:text-blue-600 dark:hover:text-blue-400">功能介绍</a>
              <a href="#" className="hover:text-blue-600 dark:hover:text-blue-400">定价方案</a>
              <a href="#" className="hover:text-blue-600 dark:hover:text-blue-400">帮助中心</a>
              <a href="#" className="hover:text-blue-600 dark:hover:text-blue-400">联系我们</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
