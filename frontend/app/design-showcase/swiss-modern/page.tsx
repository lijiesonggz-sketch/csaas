import { Hero } from '@/components/showcase/swiss-modern/Hero'
import { FeatureGrid } from '@/components/showcase/swiss-modern/FeatureGrid'
import { TrustMetrics } from '@/components/showcase/swiss-modern/TrustMetrics'
import { CTASection } from '@/components/showcase/swiss-modern/CTASection'
import { SOLUTIONS } from '@/components/showcase/shared/content'

export default function SwissModernPage() {
  return (
    <div className="theme-swiss bg-white min-h-screen" style={{ fontFamily: 'var(--font-inter), sans-serif' }}>
      {/* Navigation - 无圆角、纯黑白、严格对齐 */}
      <nav className="border-b border-gray-200 bg-white sticky top-0 z-50">
        <div className="max-w-[1200px] mx-auto px-8 h-16 flex items-center justify-between">
          <span className="text-lg font-black tracking-tight text-black">CSAAS</span>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-gray-500 hover:text-black transition-colors duration-150">标准解析</a>
            <a href="#metrics" className="text-sm font-medium text-gray-500 hover:text-black transition-colors duration-150">合规评估</a>
            <a href="#solutions" className="text-sm font-medium text-gray-500 hover:text-black transition-colors duration-150">差距分析</a>
            <a href="#cta" className="text-sm font-medium text-gray-500 hover:text-black transition-colors duration-150">行动计划</a>
          </div>
          <div className="flex items-center gap-4">
            <a href="/design-showcase" className="text-sm font-medium text-gray-500 hover:text-black transition-colors duration-150">返回</a>
            <button className="bg-black text-white px-5 py-2 text-sm font-medium hover:bg-gray-800 transition-colors duration-150">
              登录
            </button>
          </div>
        </div>
      </nav>

      <Hero />
      <div id="features"><FeatureGrid /></div>
      <div id="metrics"><TrustMetrics /></div>

      {/* Solutions Section */}
      <section id="solutions" className="bg-gray-50 border-y border-gray-200">
        <div className="max-w-[1200px] mx-auto px-8 py-24">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-gray-400 mb-4">行业解决方案</p>
          <h2 className="text-3xl font-bold tracking-tight text-black mb-16">覆盖核心合规领域</h2>
          <div className="grid grid-cols-12 gap-8">
            {SOLUTIONS.map((sol) => (
              <div key={sol.title} className="col-span-12 md:col-span-4 border border-gray-200 bg-white p-8">
                <sol.icon className="w-6 h-6 text-blue-600 mb-6" strokeWidth={1.5} />
                <h3 className="text-lg font-bold text-black mb-3">{sol.title}</h3>
                <p className="text-sm leading-relaxed text-gray-500 mb-6">{sol.description}</p>
                <div className="flex flex-wrap gap-2">
                  {sol.frameworks.map((fw) => (
                    <span key={fw} className="text-xs font-medium text-gray-400 border border-gray-200 px-2 py-1">
                      {fw}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div id="cta"><CTASection /></div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200">
        <div className="max-w-[1200px] mx-auto px-8 py-8">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">CSAAS - 企业级AI合规咨询平台</span>
            <a href="/design-showcase" className="text-sm text-gray-400 hover:text-black transition-colors duration-150">
              返回方案选择
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
