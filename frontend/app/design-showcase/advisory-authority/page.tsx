import { Hero } from '@/components/showcase/advisory-authority/Hero'
import { FeatureGrid } from '@/components/showcase/advisory-authority/FeatureGrid'
import { TrustMetrics } from '@/components/showcase/advisory-authority/TrustMetrics'
import { CTASection } from '@/components/showcase/advisory-authority/CTASection'
import { SOLUTIONS, TESTIMONIALS } from '@/components/showcase/shared/content'
import { Quote } from 'lucide-react'

export default function AdvisoryAuthorityPage() {
  return (
    <div className="bg-[#FEFDFB] min-h-screen" style={{ fontFamily: 'var(--font-plus-jakarta), sans-serif' }}>
      {/* Navigation */}
      <nav className="bg-[#FEFDFB] border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold text-[#1E3A5F]" style={{ fontFamily: 'var(--font-plus-jakarta), sans-serif' }}>
              CSAAS
            </span>
            <span className="hidden sm:inline text-[10px] text-gray-400 border border-gray-200 px-2 py-0.5 rounded-sm">
              Advisory
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-gray-600 hover:text-[#1E3A5F] transition-colors">服务</a>
            <a href="#metrics" className="text-sm font-medium text-gray-600 hover:text-[#1E3A5F] transition-colors">资质</a>
            <a href="#solutions" className="text-sm font-medium text-gray-600 hover:text-[#1E3A5F] transition-colors">行业</a>
            <a href="#cta" className="text-sm font-medium text-gray-600 hover:text-[#1E3A5F] transition-colors">咨询</a>
          </div>
          <div className="flex items-center gap-4">
            <a href="/design-showcase" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">返回</a>
            <button className="bg-[#1E3A5F] text-white px-5 py-2 text-sm font-semibold rounded-sm hover:bg-[#16304f] transition-colors">
              预约咨询
            </button>
          </div>
        </div>
      </nav>

      <Hero />
      <div id="features"><FeatureGrid /></div>
      <div id="metrics"><TrustMetrics /></div>

      {/* Solutions */}
      <section id="solutions" className="bg-[#FEFDFB]">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold text-[#1E3A5F] uppercase tracking-[0.15em] mb-3">Industry Expertise</p>
            <h2 className="text-2xl font-bold text-[#1E3A5F]" style={{ fontFamily: 'var(--font-plus-jakarta), sans-serif' }}>
              行业深耕
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {SOLUTIONS.map((sol) => (
              <div key={sol.title} className="bg-white border border-gray-200 rounded-sm p-7 hover:shadow-sm transition-shadow">
                <div className="w-10 h-10 bg-[#1E3A5F] rounded-sm flex items-center justify-center mb-5">
                  <sol.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-base font-semibold text-[#1E3A5F] mb-2">{sol.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed mb-5">{sol.description}</p>
                <div className="flex flex-wrap gap-2">
                  {sol.frameworks.map((fw) => (
                    <span key={fw} className="text-xs text-gray-500 bg-gray-50 px-2.5 py-1 rounded-sm border border-gray-200">{fw}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-white border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold text-[#1E3A5F] uppercase tracking-[0.15em] mb-3">Client Trust</p>
            <h2 className="text-2xl font-bold text-[#1E3A5F]">客户信赖</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="border-l-4 border-[#1E3A5F] bg-gray-50 p-7 rounded-r-sm">
                <Quote className="w-6 h-6 text-[#1E3A5F]/20 mb-3" />
                <p className="text-sm text-gray-600 leading-relaxed mb-5">{t.quote}</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#1E3A5F] flex items-center justify-center text-white text-sm font-bold">
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

      <footer className="bg-[#1E3A5F]">
        <div className="max-w-6xl mx-auto px-6 py-6 flex justify-between items-center">
          <span className="text-xs text-white/50">CSAAS — 企业合规战略顾问</span>
          <a href="/design-showcase" className="text-xs text-white/50 hover:text-white/80 transition-colors">返回方案选择</a>
        </div>
      </footer>
    </div>
  )
}
