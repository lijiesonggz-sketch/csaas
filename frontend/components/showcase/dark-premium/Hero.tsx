'use client'

import { ArrowRight, Sparkles } from 'lucide-react'

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-[#09090B]">
      {/* Grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />
      {/* Radial glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[radial-gradient(ellipse,rgba(99,102,241,0.15)_0%,transparent_70%)]" />

      <div className="relative max-w-6xl mx-auto px-6 pt-32 pb-24">
        <div className="max-w-3xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-xs font-medium text-zinc-400">AI-Powered Compliance Platform</span>
          </div>

          <h1
            className="text-5xl md:text-6xl font-bold text-white leading-[1.1] tracking-tight mb-6"
            style={{ fontFamily: 'var(--font-inter), sans-serif' }}
          >
            下一代
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent"> AI 合规</span>
            <br />
            智能平台
          </h1>

          <p className="text-lg text-zinc-400 leading-relaxed mb-10 max-w-xl mx-auto">
            三模型协同架构，为企业提供实时合规评估、智能差距分析与精准行动方案
          </p>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button className="group relative inline-flex items-center gap-2 px-7 py-3 text-sm font-semibold text-white rounded-xl overflow-hidden">
              {/* Gradient border effect */}
              <span className="absolute inset-0 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500 p-[1px]">
                <span className="block h-full w-full rounded-xl bg-[#09090B]" />
              </span>
              <span className="absolute inset-[1px] rounded-[11px] bg-gradient-to-r from-indigo-600/20 via-purple-600/20 to-cyan-600/20 group-hover:from-indigo-600/30 group-hover:via-purple-600/30 group-hover:to-cyan-600/30 transition-all duration-300" />
              <span className="relative flex items-center gap-2">
                预约演示
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200" />
              </span>
            </button>
            <button className="px-7 py-3 text-sm font-medium text-zinc-400 rounded-xl border border-white/10 hover:border-white/20 hover:text-zinc-300 transition-all duration-200">
              查看文档
            </button>
          </div>

          {/* Mini tech stats */}
          <div className="flex items-center justify-center gap-8 mt-16">
            {[
              { value: '99.2%', label: '准确率' },
              { value: '< 200ms', label: '响应时间' },
              { value: '50+', label: '合规框架' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-lg font-bold text-white font-mono">{stat.value}</div>
                <div className="text-xs text-zinc-500 mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Terminal preview */}
        <div className="mt-20 max-w-2xl mx-auto">
          <div className="rounded-xl border border-white/10 bg-white/[0.02] backdrop-blur-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
              <div className="w-3 h-3 rounded-full bg-red-500/60" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
              <div className="w-3 h-3 rounded-full bg-green-500/60" />
              <span className="text-xs text-zinc-500 ml-2 font-mono">csaas-cli — compliance scan</span>
            </div>
            <div className="p-5 font-mono text-sm leading-relaxed">
              <p className="text-zinc-500">$ csaas scan --framework ISO27001 --deep</p>
              <p className="text-emerald-400 mt-2">✓ 标准条款解析完成 — 114 条控制点</p>
              <p className="text-emerald-400">✓ 差距分析完成 — 发现 12 项差距</p>
              <p className="text-amber-400">⚠ 3 项高优先级待处理</p>
              <p className="text-zinc-500 mt-2">
                报告已生成: <span className="text-indigo-400 underline underline-offset-2">gap-analysis-2024.pdf</span>
              </p>
              <p className="text-zinc-600 mt-1">█</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
