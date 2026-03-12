'use client'

import Link from 'next/link'
import { TrendingUp, Shield, Zap, ArrowRight, CheckCircle, BookOpen, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function Home() {
  const features = [
    {
      icon: <Shield className="w-8 h-8 text-indigo-500" />,
      title: '合规评估',
      description: '基于行业标准，智能评估IT咨询成熟度',
    },
    {
      icon: <Zap className="w-8 h-8 text-purple-500" />,
      title: '智能分析',
      description: '三模型协同架构，提供精准分析报告',
    },
    {
      icon: <TrendingUp className="w-8 h-8 text-indigo-500" />,
      title: '技术雷达',
      description: '实时追踪技术趋势，把握行业动态',
    },
  ]

  const highlights = [
    { icon: <CheckCircle className="w-5 h-5 text-indigo-500" />, text: 'GPT-4 + Claude + 国产模型' },
    { icon: <CheckCircle className="w-5 h-5 text-purple-500" />, text: '智能合规分析' },
    { icon: <CheckCircle className="w-5 h-5 text-indigo-500" />, text: '实时技术雷达' },
  ]

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Hero Section */}
        <Card className="border-0 shadow-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-purple-600 text-white">
          <CardContent className="py-12 px-8">
            <div className="text-center">
              {/* Logo */}
              <div className="flex items-center justify-center gap-3 mb-6">
                <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                  <TrendingUp className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-4xl font-bold tracking-tight">Csaas</h1>
              </div>

              {/* Tagline */}
              <h2 className="text-2xl sm:text-3xl font-medium mb-3 opacity-95">
                AI驱动的IT咨询成熟度评估平台
              </h2>

              {/* Subtitle */}
              <p className="text-lg opacity-80 max-w-lg mx-auto mb-6">
                三模型协同架构 · 智能合规 · 技术雷达
              </p>

              {/* Highlights */}
              <div className="flex flex-wrap justify-center gap-4 mb-8">
                {highlights.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    {item.icon}
                    <span className="text-sm opacity-90">{item.text}</span>
                  </div>
                ))}
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-wrap gap-4 justify-center">
                <Link href="/login">
                  <Button size="lg" variant="secondary" className="gap-2">
                    登录
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                <Link href="/register">
                  <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                    注册账号
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Features Section */}
        <div className="mt-12">
          <h2 className="text-2xl font-semibold text-center mb-8 text-foreground">
            核心功能
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((feature, idx) => (
              <Card key={idx} className="h-full">
                <CardContent className="p-6 text-center">
                  <div className="mb-4 flex justify-center">{feature.icon}</div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Workflow Section */}
        <Card className="mt-12 border-0 shadow-lg">
          <CardContent className="p-8">
            <h2 className="text-2xl font-semibold text-center mb-8 text-foreground">
              评估流程
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              {[
                { icon: <BookOpen className="w-7 h-7" />, title: '上传文档', desc: '上传标准文档' },
                { icon: <BarChart3 className="w-7 h-7" />, title: 'AI解读', desc: '智能分析条款' },
                { icon: <TrendingUp className="w-7 h-7" />, title: '获取报告', desc: '生成评估结果' },
              ].map((step, idx) => (
                <div key={idx} className="text-center relative">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center mx-auto mb-4 shadow-lg">
                    {step.icon}
                  </div>
                  <h3 className="text-lg font-semibold mb-1">{step.title}</h3>
                  <p className="text-muted-foreground text-sm">{step.desc}</p>
                  {idx < 2 && (
                    <div className="hidden sm:block absolute top-8 left-[60%] w-[80%] h-0.5 bg-border" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-sm text-muted-foreground mt-12 opacity-60">
          © 2025 Csaas. All rights reserved.
        </p>
      </div>
    </div>
  )
}
