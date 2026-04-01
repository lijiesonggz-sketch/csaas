import { Hero } from '@/components/showcase/modern-think-tank/Hero'
import { FeatureGrid } from '@/components/showcase/modern-think-tank/FeatureGrid'
import { InsightsSection } from '@/components/showcase/modern-think-tank/InsightsSection'
import { CTASection } from '@/components/showcase/modern-think-tank/CTASection'
import { TRUST_METRICS, SOLUTIONS, TESTIMONIALS } from '@/components/showcase/shared/content'
import { AnimatedNumber } from '@/components/showcase/shared/AnimatedNumber'
import { Quote } from 'lucide-react'

export default function ModernThinkTankPage() {
  return (
    <div className="bg-[#FAFAF9] min-h-screen" style={{ fontFamily: 'var(--font-inter), sans-serif' }}>
      {/* Navigation */}
      <nav className="bg-[#FAFAF9] border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-gray-900 tracking-tight">CSAAS</span>
            <span className="hidden sm:inline text-[10px] text-[#7C3AED] border border-[#7C3AED]/20 px-2 py-0.5 rounded-sm font-medium">
              Think Tank
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">研究</a>
            <a href="#insights" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">洞察</a>
            <a href="#solutions" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">方案</a>
            <a href="#cta" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">订阅</a>
          </div>
          <div className="flex items-center gap-4">
            <a href="/design-showcase" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">返回</a>
            <button className="bg-[#18181B] text-white px-5 py-1.5 text-sm font-semibold rounded-md hover:bg-gray-800 transition-colors">
              登录
            </button>
          </div>
        </div>
      </nav>

      <Hero />
      <div id="features"><FeatureGrid /></div>

      {/* Trust Metrics */}
      <section className="bg-white border-y border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {TRUST_METRICS.map((metric) => (
              <div key={metric.label} className="text-center">
                <div className="inline-flex items-center justify-center w-11 h-11 bg-[#7C3AED]/10 rounded-md mb-4">
                  <metric.icon className="w-5 h-5 text-[#7C3AED]" />
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-1">
                  <AnimatedNumber value={metric.value} />
                </div>
                <p className="text-sm text-gray-500">{metric.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div id="insights"><InsightsSection /></div>

      {/* Solutions */}
      <section id="solutions" className="bg-white">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold text-[#7C3AED] uppercase tracking-[0.15em] mb-3">Practice Areas</p>
            <h2 className="text-2xl font-bold text-gray-900">实践领域</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {SOLUTIONS.map((sol) => (
              <div key={sol.title} className="bg-[#FAFAF9] border border-gray-200 rounded-md p-6 hover:shadow-sm transition-shadow">
                <div className="w-10 h-10 bg-[#7C3AED]/10 rounded-md flex items-center justify-center mb-5">
                  <sol.icon className="w-5 h-5 text-[#7C3AED]" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">{sol.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed mb-4">{sol.description}</p>
                <div className="flex flex-wrap gap-1.5">
                  {sol.frameworks.map((fw) => (
                    <span key={fw} className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded-sm border border-gray-200">{fw}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-[#FAFAF9]">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold text-[#EA580C] uppercase tracking-[0.15em] mb-3">Voices</p>
            <h2 className="text-2xl font-bold text-gray-900">客户之声</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-md p-7">
                <Quote className="w-7 h-7 text-[#7C3AED]/20 mb-3" />
                <p className="text-sm text-gray-600 leading-relaxed mb-5">{t.quote}</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#7C3AED]/10 flex items-center justify-center text-[#7C3AED] text-sm font-bold">
                    {t.author[0]}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{t.author}</div>
                    <div className="text-xs text-gray-400">{t.company}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div id="cta"><CTASection /></div>

      <footer className="bg-[#18181B]">
        <div className="max-w-6xl mx-auto px-6 py-6 flex justify-between items-center">
          <span className="text-xs text-gray-600">CSAAS — 企业智能智库</span>
          <a href="/design-showcase" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">返回方案选择</a>
        </div>
      </footer>
    </div>
  )
}
