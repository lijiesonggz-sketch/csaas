import { Hero } from '@/components/showcase/executive-intelligence/Hero'
import { FeatureGrid } from '@/components/showcase/executive-intelligence/FeatureGrid'
import { InsightsSection } from '@/components/showcase/executive-intelligence/InsightsSection'
import { CTASection } from '@/components/showcase/executive-intelligence/CTASection'
import { TRUST_METRICS, SOLUTIONS, TESTIMONIALS } from '@/components/showcase/shared/content'
import { AnimatedNumber } from '@/components/showcase/shared/AnimatedNumber'
import { Quote } from 'lucide-react'

export default function ExecutiveIntelligencePage() {
  return (
    <div className="bg-white min-h-screen" style={{ fontFamily: 'var(--font-inter), sans-serif' }}>
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="text-lg font-bold text-gray-900 tracking-tight">CSAAS</span>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">服务</a>
            <a href="#insights" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">研究</a>
            <a href="#solutions" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">方案</a>
            <a href="#cta" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">联系</a>
          </div>
          <div className="flex items-center gap-4">
            <a href="/design-showcase" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">返回</a>
            <button className="bg-blue-700 text-white px-5 py-1.5 text-sm font-semibold rounded-lg hover:bg-blue-800 transition-colors">
              登录
            </button>
          </div>
        </div>
      </nav>

      <Hero />
      <div id="features"><FeatureGrid /></div>

      {/* Trust Metrics */}
      <section className="bg-white border-y border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {TRUST_METRICS.map((metric) => (
              <div key={metric.label} className="text-center">
                <div className="inline-flex items-center justify-center w-11 h-11 bg-blue-50 rounded-lg mb-4">
                  <metric.icon className="w-5 h-5 text-blue-700" />
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-1" style={{ fontFamily: 'var(--font-inter), sans-serif' }}>
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
      <section id="solutions" className="bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-3">Industry Solutions</p>
            <h2 className="text-2xl font-bold text-gray-900">行业解决方案</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {SOLUTIONS.map((sol) => (
              <div key={sol.title} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-sm transition-shadow">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center mb-4">
                  <sol.icon className="w-5 h-5 text-blue-700" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">{sol.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed mb-4">{sol.description}</p>
                <div className="flex flex-wrap gap-1.5">
                  {sol.frameworks.map((fw) => (
                    <span key={fw} className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">{fw}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-3">Client Testimonials</p>
            <h2 className="text-2xl font-bold text-gray-900">客户评价</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="bg-gray-50 border border-gray-100 rounded-lg p-7">
                <Quote className="w-7 h-7 text-blue-200 mb-3" />
                <p className="text-sm text-gray-600 leading-relaxed mb-5">{t.quote}</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-sm font-bold">
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

      <footer className="bg-white border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-6 flex justify-between items-center">
          <span className="text-xs text-gray-400">CSAAS — 企业智能智库平台</span>
          <a href="/design-showcase" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">返回方案选择</a>
        </div>
      </footer>
    </div>
  )
}
