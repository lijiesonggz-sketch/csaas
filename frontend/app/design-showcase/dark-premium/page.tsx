import { Hero } from '@/components/showcase/dark-premium/Hero'
import { FeatureGrid } from '@/components/showcase/dark-premium/FeatureGrid'
import { TrustMetrics } from '@/components/showcase/dark-premium/TrustMetrics'
import { CTASection } from '@/components/showcase/dark-premium/CTASection'
import { SOLUTIONS, TESTIMONIALS } from '@/components/showcase/shared/content'
import { Quote, Terminal } from 'lucide-react'

export default function DarkPremiumPage() {
  return (
    <div className="bg-[#09090B] min-h-screen" style={{ fontFamily: 'var(--font-inter), sans-serif' }}>
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#09090B]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-indigo-400" />
            <span className="text-lg font-bold text-white tracking-tight">CSAAS</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-zinc-400 hover:text-white transition-colors">功能</a>
            <a href="#solutions" className="text-sm text-zinc-400 hover:text-white transition-colors">方案</a>
            <a href="#testimonials" className="text-sm text-zinc-400 hover:text-white transition-colors">客户</a>
            <a href="#cta" className="text-sm text-zinc-400 hover:text-white transition-colors">联系</a>
          </div>
          <div className="flex items-center gap-4">
            <a href="/design-showcase" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">返回</a>
            <button className="px-4 py-1.5 text-sm font-medium text-white rounded-lg bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.1] transition-all duration-200">
              登录
            </button>
          </div>
        </div>
      </nav>

      <Hero />
      <div id="features"><FeatureGrid /></div>
      <TrustMetrics />

      {/* Solutions */}
      <section id="solutions" className="relative bg-[#09090B]">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="text-center mb-16">
            <p className="text-sm font-medium text-indigo-400 mb-3 tracking-wide uppercase">Industry Solutions</p>
            <h2 className="text-3xl font-bold text-white">深耕垂直领域合规</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {SOLUTIONS.map((sol) => (
              <div
                key={sol.title}
                className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 hover:border-white/[0.12] transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 border border-white/[0.08] flex items-center justify-center mb-5">
                  <sol.icon className="w-5 h-5 text-cyan-400" />
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
      <section id="testimonials" className="relative bg-[#09090B]">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="text-center mb-16">
            <p className="text-sm font-medium text-indigo-400 mb-3 tracking-wide uppercase">Testimonials</p>
            <h2 className="text-3xl font-bold text-white">受到行业领先企业的信赖</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {TESTIMONIALS.map((t, i) => (
              <div
                key={i}
                className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8"
              >
                <Quote className="w-8 h-8 text-indigo-500/30 mb-4" />
                <p className="text-base text-zinc-300 leading-relaxed mb-6">{t.quote}</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/[0.08] flex items-center justify-center text-indigo-400 text-sm font-bold">
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

      <footer className="border-t border-white/[0.06] bg-[#09090B]">
        <div className="max-w-6xl mx-auto px-6 py-6 flex justify-between items-center">
          <span className="text-xs text-zinc-600">CSAAS — Enterprise AI Compliance Platform</span>
          <a href="/design-showcase" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">返回方案选择</a>
        </div>
      </footer>
    </div>
  )
}
