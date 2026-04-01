import { Hero } from '@/components/showcase/soft-enterprise/Hero'
import { FeatureGrid } from '@/components/showcase/soft-enterprise/FeatureGrid'
import { TrustMetrics } from '@/components/showcase/soft-enterprise/TrustMetrics'
import { SolutionShowcase } from '@/components/showcase/soft-enterprise/SolutionShowcase'
import { CTASection } from '@/components/showcase/soft-enterprise/CTASection'
import { TESTIMONIALS } from '@/components/showcase/shared/content'
import { Quote } from 'lucide-react'

export default function SoftEnterprisePage() {
  return (
    <div className="theme-soft bg-[#F8FAFC] min-h-screen" style={{ fontFamily: 'var(--font-plus-jakarta), sans-serif' }}>
      {/* Navigation - 毛玻璃效果 */}
      <nav className="bg-white/80 backdrop-blur-lg border-b border-gray-200/50 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-plus-jakarta), sans-serif' }}>
            CSAAS
          </span>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">功能</a>
            <a href="#solutions" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">方案</a>
            <a href="#testimonials" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">客户</a>
            <a href="#cta" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">联系我们</a>
          </div>
          <div className="flex items-center gap-4">
            <a href="/design-showcase" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">返回</a>
            <button className="bg-gray-900 text-white px-5 py-2 text-sm font-semibold rounded-xl shadow-sm hover:bg-gray-800 active:scale-[0.98] transition-all duration-200">
              登录
            </button>
          </div>
        </div>
      </nav>

      <Hero />
      <div id="features"><FeatureGrid /></div>
      <TrustMetrics />

      <div id="solutions"><SolutionShowcase /></div>

      {/* Testimonials */}
      <section id="testimonials" className="bg-white">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-center mb-14">
            <p className="text-sm font-medium text-blue-600 mb-2">客户评价</p>
            <h2 className="text-2xl font-bold text-gray-900">受到行业领先企业的信赖</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <div
                key={i}
                className="bg-gray-50 rounded-2xl border border-gray-200/80 p-8 hover:shadow-md transition-shadow duration-200"
              >
                <Quote className="w-8 h-8 text-blue-200 mb-4" />
                <p className="text-base text-gray-700 leading-relaxed mb-6">{t.quote}</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm font-bold">
                    {t.author[0]}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{t.author}</div>
                    <div className="text-xs text-gray-500">{t.company}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div id="cta"><CTASection /></div>

      <footer className="bg-white border-t border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-6 flex justify-between items-center">
          <span className="text-xs text-gray-400">CSAAS - 企业级AI合规咨询平台</span>
          <a href="/design-showcase" className="text-xs text-gray-400 hover:text-blue-600 transition-colors">返回方案选择</a>
        </div>
      </footer>
    </div>
  )
}
