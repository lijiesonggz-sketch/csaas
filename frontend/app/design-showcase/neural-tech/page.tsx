import { Hero } from '@/components/showcase/neural-tech/Hero'
import { FeatureGrid } from '@/components/showcase/neural-tech/FeatureGrid'
import { AIShowcase } from '@/components/showcase/neural-tech/AIShowcase'
import { TrustMetrics } from '@/components/showcase/neural-tech/TrustMetrics'
import { CTASection } from '@/components/showcase/neural-tech/CTASection'
import { SOLUTIONS, TESTIMONIALS } from '@/components/showcase/shared/content'
import { Cpu, Quote } from 'lucide-react'

export default function NeuralTechPage() {
  return (
    <div className="bg-[#06060A] min-h-screen" style={{ fontFamily: 'var(--font-inter), sans-serif' }}>
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#06060A]/70 backdrop-blur-2xl border-b border-white/[0.04]">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
              <Cpu className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-white tracking-tight">CSAAS</span>
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 text-[10px] font-mono text-purple-400 bg-purple-500/10 border border-purple-500/20 rounded-md">
              AI
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-zinc-500 hover:text-white transition-colors">功能</a>
            <a href="#architecture" className="text-sm text-zinc-500 hover:text-white transition-colors">架构</a>
            <a href="#solutions" className="text-sm text-zinc-500 hover:text-white transition-colors">方案</a>
            <a href="#cta" className="text-sm text-zinc-500 hover:text-white transition-colors">联系</a>
          </div>
          <div className="flex items-center gap-4">
            <a href="/design-showcase" className="text-sm text-zinc-600 hover:text-zinc-400 transition-colors">返回</a>
            <button className="px-4 py-1.5 text-sm font-medium text-white rounded-lg bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 transition-all duration-300">
              开始使用
            </button>
          </div>
        </div>
      </nav>

      <Hero />
      <div id="features"><FeatureGrid /></div>
      <div id="architecture"><AIShowcase /></div>
      <TrustMetrics />

      {/* Solutions */}
      <section id="solutions" className="relative bg-[#06060A]">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent" />
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="text-center mb-16">
            <p className="text-sm font-medium text-cyan-400 mb-3">Industry Solutions</p>
            <h2 className="text-3xl font-bold text-white">垂直行业智能合规</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {SOLUTIONS.map((sol, i) => (
              <div
                key={sol.title}
                className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 hover:border-purple-500/20 transition-all duration-500 overflow-hidden"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border border-white/[0.08] mb-5 ${
                  i === 0 ? 'bg-purple-500/10' :
                  i === 1 ? 'bg-violet-500/10' :
                  'bg-cyan-500/10'
                }`}>
                  <sol.icon className={`w-5 h-5 ${
                    i === 0 ? 'text-purple-400' :
                    i === 1 ? 'text-violet-400' :
                    'text-cyan-400'
                  }`} />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{sol.title}</h3>
                <p className="text-sm text-zinc-500 leading-relaxed mb-5">{sol.description}</p>
                <div className="flex flex-wrap gap-2">
                  {sol.frameworks.map((fw) => (
                    <span
                      key={fw}
                      className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-zinc-400 bg-white/[0.04] border border-white/[0.06] rounded-md"
                    >
                      {fw}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="relative bg-[#06060A]">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/15 to-transparent" />
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="text-center mb-16">
            <p className="text-sm font-medium text-purple-400 mb-3">Trusted By</p>
            <h2 className="text-3xl font-bold text-white">行业领先企业的选择</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {TESTIMONIALS.map((t, i) => (
              <div
                key={i}
                className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8"
              >
                <Quote className="w-8 h-8 text-purple-500/20 mb-4" />
                <p className="text-base text-zinc-300 leading-relaxed mb-6">{t.quote}</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-white/[0.08] flex items-center justify-center text-purple-400 text-sm font-bold">
                    {t.author[0]}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{t.author}</div>
                    <div className="text-xs text-zinc-500">{t.company}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div id="cta"><CTASection /></div>

      <footer className="border-t border-white/[0.04] bg-[#06060A]">
        <div className="max-w-6xl mx-auto px-6 py-6 flex justify-between items-center">
          <span className="text-xs text-zinc-700">CSAAS — Neural Compliance Intelligence</span>
          <a href="/design-showcase" className="text-xs text-zinc-700 hover:text-zinc-400 transition-colors">返回方案选择</a>
        </div>
      </footer>
    </div>
  )
}
