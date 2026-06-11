'use client'

import Link from 'next/link'
import { TrendingUp, Shield, Zap, ArrowRight, CheckCircle, BookOpen, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function Home() {
  const features = [
    {
      icon: <Shield className="w-8 h-8 text-emerald-600" />,
      title: '合规评估',
      description: '基于行业标准，智能评估IT咨询成熟度',
    },
    {
      icon: <Zap className="w-8 h-8 text-emerald-600" />,
      title: '智能分析',
      description: '三模型协同架构，提供精准分析报告',
    },
    {
      icon: <TrendingUp className="w-8 h-8 text-emerald-600" />,
      title: '技术雷达',
      description: '实时追踪技术趋势，把握行业动态',
    },
  ]

  const highlights = [
    {
      icon: <CheckCircle className="w-5 h-5 text-emerald-600" />,
      text: 'DeepSeek + Claude + 国产模型',
    },
    { icon: <CheckCircle className="w-5 h-5 text-emerald-600" />, text: '智能合规分析' },
    { icon: <CheckCircle className="w-5 h-5 text-emerald-600" />, text: '实时技术雷达' },
  ]

  return (
    <div className="min-h-screen bg-[#FEFDFB] py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Hero Section */}
        <Card className="border border-[#E2E8F0] shadow-sm bg-[#FEFDFB] rounded-sm overflow-hidden">
          <CardContent className="py-16 px-8">
            <div className="text-center">
              {/* Logo */}
              <div className="flex items-center justify-center gap-3 mb-8">
                <div className="w-16 h-16 rounded-sm bg-[#1E3A5F] flex items-center justify-center">
                  <TrendingUp className="w-9 h-9 text-white" />
                </div>
                <h1 className="text-5xl font-bold tracking-tight text-[#1E3A5F] font-[var(--font-plus-jakarta)]">
                  Csaas
                </h1>
              </div>

              {/* Tagline */}
              <h2 className="text-3xl sm:text-4xl font-medium mb-4 text-[#1E3A5F] font-[var(--font-plus-jakarta)]">
                AI驱动的IT咨询成熟度评估平台
              </h2>

              {/* Subtitle */}
              <p className="text-lg text-[#94A3B8] max-w-2xl mx-auto mb-8 font-[var(--font-inter)]">
                三模型协同架构 · 智能合规 · 技术雷达
              </p>

              {/* Highlights */}
              <div className="flex flex-wrap justify-center gap-6 mb-10">
                {highlights.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    {item.icon}
                    <span className="text-base text-[#1E3A5F] font-medium">{item.text}</span>
                  </div>
                ))}
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-wrap gap-4 justify-center">
                <Link href="/login">
                  <Button
                    size="lg"
                    className="gap-2 bg-[#1E3A5F] hover:bg-[#162e4d] text-white rounded-sm px-8"
                  >
                    登录
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                <Link href="/register">
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-[#1E3A5F] text-[#1E3A5F] hover:bg-[#1E3A5F] hover:text-white rounded-sm px-8"
                  >
                    注册账号
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Features Section */}
        <div className="mt-16">
          <h2 className="text-3xl font-semibold text-center mb-10 text-[#1E3A5F] font-[var(--font-plus-jakarta)]">
            核心功能
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature, idx) => (
              <Card
                key={idx}
                className="h-full border border-[#E2E8F0] shadow-sm rounded-sm hover:shadow-md transition-shadow"
              >
                <CardContent className="p-8">
                  <div className="mb-5">{feature.icon}</div>
                  <h3 className="text-xl font-semibold mb-3 text-[#1E3A5F] font-[var(--font-plus-jakarta)]">
                    {feature.title}
                  </h3>
                  <p className="text-[#94A3B8] text-base font-[var(--font-inter)]">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Workflow Section */}
        <Card className="mt-16 border border-[#E2E8F0] shadow-sm rounded-sm">
          <CardContent className="p-10">
            <h2 className="text-3xl font-semibold text-center mb-10 text-[#1E3A5F] font-[var(--font-plus-jakarta)]">
              评估流程
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-10">
              {[
                { icon: <BookOpen className="w-7 h-7" />, title: '上传文档', desc: '上传标准文档' },
                { icon: <BarChart3 className="w-7 h-7" />, title: 'AI解读', desc: '智能分析条款' },
                {
                  icon: <TrendingUp className="w-7 h-7" />,
                  title: '获取报告',
                  desc: '生成评估结果',
                },
              ].map((step, idx) => (
                <div key={idx} className="text-center relative">
                  <div className="w-16 h-16 rounded-sm bg-[#059669] text-white flex items-center justify-center mx-auto mb-5 shadow-sm">
                    {step.icon}
                  </div>
                  <h3 className="text-lg font-semibold mb-2 text-[#1E3A5F] font-[var(--font-plus-jakarta)]">
                    {step.title}
                  </h3>
                  <p className="text-[#94A3B8] text-sm font-[var(--font-inter)]">{step.desc}</p>
                  {idx < 2 && (
                    <div className="hidden sm:block absolute top-8 left-[60%] w-[80%] h-px bg-[#E2E8F0]" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-sm text-[#94A3B8] mt-16 font-[var(--font-inter)]">
          © 2025 Csaas. All rights reserved.
        </p>
      </div>
    </div>
  )
}
