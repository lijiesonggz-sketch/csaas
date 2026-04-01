'use client'

import { ArrowRight, Cpu, Zap } from 'lucide-react'

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-[#06060A]">
      {/* Mesh gradient background */}
      <div className="absolute inset-0">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px]" />
        <div className="absolute top-[10%] right-[-5%] w-[400px] h-[400px] bg-cyan-500/15 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[30%] w-[350px] h-[350px] bg-indigo-600/15 rounded-full blur-[100px]" />
      </div>

      {/* Neural network grid pattern */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative max-w-6xl mx-auto px-6 pt-32 pb-28">
        <div className="max-w-3xl mx-auto text-center">
          {/* AI badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 rounded-full border border-purple-500/20 bg-purple-500/5">
            <Cpu className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-xs font-medium text-purple-300">Triple-Model Neural Architecture</span>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500" />
            </span>
          </div>

          <h1
            className="text-5xl md:text-7xl font-bold leading-[1.05] tracking-tight mb-8"
            style={{ fontFamily: 'var(--font-inter), sans-serif' }}
          >
            <span className="bg-gradient-to-b from-white via-white to-zinc-500 bg-clip-text text-transparent">
              合规智能
            </span>
            <br />
            <span className="bg-gradient-to-r from-purple-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">
              无限可能
            </span>
          </h1>

          <p className="text-lg text-zinc-400 leading-relaxed mb-12 max-w-lg mx-auto">
            基于三模型神经协同架构，重新定义企业合规管理的智能边界
          </p>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button className="group relative inline-flex items-center gap-2 px-8 py-4 text-sm font-semibold text-white rounded-2xl overflow-hidden">
              {/* Animated gradient bg */}
              <span className="absolute inset-0 bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 group-hover:from-purple-500 group-hover:via-violet-500 group-hover:to-indigo-500 transition-all duration-500" />
              <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-r from-purple-600 via-cyan-500 to-purple-600 bg-[length:200%_100%] animate-[shimmer_3s_linear_infinite]" />
              <span className="relative flex items-center gap-2">
                启动智能合规
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
              </span>
            </button>
            <button className="px-8 py-4 text-sm font-medium text-zinc-400 rounded-2xl border border-white/[0.08] hover:border-white/[0.15] hover:text-zinc-200 backdrop-blur-sm transition-all duration-300">
              <span className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                在线体验
              </span>
            </button>
          </div>
        </div>

        {/* AI Processing Visualization */}
        <div className="mt-24 max-w-3xl mx-auto">
          <div className="relative rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-6 overflow-hidden">
            {/* Holographic border effect */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-500/20 via-transparent to-cyan-500/20 opacity-0 hover:opacity-100 transition-opacity duration-700" />

            <div className="relative">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/30 to-cyan-500/30 flex items-center justify-center">
                  <Cpu className="w-4 h-4 text-purple-300" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">Neural Compliance Engine</div>
                  <div className="text-xs text-zinc-500">Triple-model analysis in progress...</div>
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <span className="text-xs text-emerald-400 font-mono">Active</span>
                </div>
              </div>

              {/* Processing pipeline */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { name: 'GPT-4o', status: '条款解析', progress: 100, color: 'from-purple-500 to-violet-500' },
                  { name: 'Claude', status: '差距分析', progress: 87, color: 'from-violet-500 to-indigo-500' },
                  { name: '通义千问', status: '报告生成', progress: 62, color: 'from-indigo-500 to-cyan-500' },
                ].map((model) => (
                  <div key={model.name} className="rounded-xl bg-white/[0.03] border border-white/[0.05] p-4">
                    <div className="text-xs text-zinc-500 mb-1 font-mono">{model.name}</div>
                    <div className="text-sm font-medium text-white mb-3">{model.status}</div>
                    <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${model.color} transition-all duration-1000`}
                        style={{ width: `${model.progress}%` }}
                      />
                    </div>
                    <div className="text-xs text-zinc-600 mt-2 font-mono">{model.progress}%</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
