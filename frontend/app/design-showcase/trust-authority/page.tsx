import { Hero } from '@/components/showcase/trust-authority/Hero'
import { FeatureGrid } from '@/components/showcase/trust-authority/FeatureGrid'
import { TrustMetrics } from '@/components/showcase/trust-authority/TrustMetrics'
import { Certifications } from '@/components/showcase/trust-authority/Certifications'
import { CTASection } from '@/components/showcase/trust-authority/CTASection'
import { SOLUTIONS, CLIENT_LOGOS } from '@/components/showcase/shared/content'

export default function TrustAuthorityPage() {
  return (
    <div className="theme-trust bg-gray-50 min-h-screen" style={{ fontFamily: 'var(--font-plus-jakarta), sans-serif' }}>
      {/* Navigation - 蓝灰权威风格 */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center">
              <span className="text-white text-xs font-bold">C</span>
            </div>
            <span className="text-lg font-bold text-blue-600">CSAAS</span>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm font-medium text-gray-500 hover:text-blue-600 transition-colors">功能</a>
            <a href="#solutions" className="text-sm font-medium text-gray-500 hover:text-blue-600 transition-colors">解决方案</a>
            <a href="#certs" className="text-sm font-medium text-gray-500 hover:text-blue-600 transition-colors">安全合规</a>
            <a href="#cta" className="text-sm font-medium text-gray-500 hover:text-blue-600 transition-colors">联系我们</a>
          </div>
          <div className="flex items-center gap-3">
            <a href="/design-showcase" className="text-sm font-medium text-gray-500 hover:text-blue-600 transition-colors">返回</a>
            <button className="bg-blue-600 text-white px-5 py-2 text-sm font-semibold rounded-md shadow-sm hover:bg-blue-700 transition-colors">
              登录
            </button>
          </div>
        </div>
      </nav>

      <Hero />
      <div id="metrics"><TrustMetrics /></div>
      <div id="features"><FeatureGrid /></div>

      {/* Solutions */}
      <section id="solutions" className="bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <p className="text-sm font-medium text-blue-600 mb-2">行业方案</p>
          <h2 className="text-2xl font-bold text-gray-900 mb-12">深耕垂直行业合规</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {SOLUTIONS.map((sol) => (
              <div key={sol.title} className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                <div className="w-10 h-10 bg-blue-50 rounded-md flex items-center justify-center mb-4">
                  <sol.icon className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{sol.title}</h3>
                <p className="text-sm text-gray-500 mb-4 leading-relaxed">{sol.description}</p>
                <div className="flex flex-wrap gap-2">
                  {sol.frameworks.map((fw) => (
                    <span key={fw} className="inline-flex items-center px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded border border-blue-100">
                      {fw}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Client Logos */}
      <section className="bg-white border-y border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <p className="text-xs font-medium text-gray-400 text-center mb-6 uppercase tracking-wider">受到行业领先企业信赖</p>
          <div className="flex flex-wrap justify-center gap-8 md:gap-12">
            {CLIENT_LOGOS.map((name) => (
              <div key={name} className="text-sm font-semibold text-gray-300 hover:text-gray-400 transition-colors">{name}</div>
            ))}
          </div>
        </div>
      </section>

      <div id="certs"><Certifications /></div>
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
