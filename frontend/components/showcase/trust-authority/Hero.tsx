import { HERO_CONTENT } from '@/components/showcase/shared/content'
import { ShieldCheck, ArrowRight } from 'lucide-react'

export function Hero() {
  return (
    <section className="bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-6xl mx-auto px-6 py-20 md:py-28">
        {/* Trust Badge */}
        <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 text-sm font-medium px-4 py-2 rounded-md mb-8">
          <ShieldCheck className="w-4 h-4" />
          ISO 27001 认证平台
        </div>

        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900 mb-6 leading-tight" style={{ fontFamily: 'var(--font-plus-jakarta), sans-serif' }}>
          {HERO_CONTENT.title}
        </h1>
        <p className="text-lg text-gray-500 max-w-xl mb-10 leading-relaxed">
          {HERO_CONTENT.subtitle}
        </p>

        <div className="flex flex-wrap gap-4 mb-12">
          <button className="bg-blue-600 text-white px-8 py-3 text-sm font-semibold rounded-md shadow-sm hover:bg-blue-700 transition-colors duration-200 flex items-center gap-2">
            {HERO_CONTENT.ctaPrimary}
            <ArrowRight className="w-4 h-4" />
          </button>
          <button className="bg-white text-blue-600 border border-blue-200 px-8 py-3 text-sm font-semibold rounded-md hover:bg-blue-50 transition-colors duration-200">
            {HERO_CONTENT.ctaSecondary}
          </button>
        </div>

        {/* Security Trust Bar */}
        <div className="flex flex-wrap items-center gap-6 text-sm text-gray-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-green-600" />
            <span>数据加密传输</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-green-600" />
            <span>私有化部署</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-green-600" />
            <span>SOC 2 合规</span>
          </div>
        </div>
      </div>
    </section>
  )
}
