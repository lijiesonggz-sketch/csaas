import { HERO_CONTENT, TRUST_METRICS } from '@/components/showcase/shared/content'
import { AnimatedNumber } from '@/components/showcase/shared/AnimatedNumber'
import { ArrowRight, ShieldCheck } from 'lucide-react'

export function Hero() {
  return (
    <section className="bg-white">
      <div className="max-w-6xl mx-auto px-6 pt-20 pb-16 md:pt-28 md:pb-24">
        {/* Pill Badge */}
        <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-sm font-medium px-4 py-1.5 rounded-full border border-blue-100 mb-8">
          <ShieldCheck className="w-4 h-4" />
          {HERO_CONTENT.badge}
        </div>

        <h1
          className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900 mb-6 leading-tight max-w-2xl"
          style={{ fontFamily: 'var(--font-plus-jakarta), sans-serif' }}
        >
          {HERO_CONTENT.title}
        </h1>
        <p className="text-lg text-gray-500 max-w-xl mb-10 leading-relaxed">
          {HERO_CONTENT.subtitle}
        </p>

        <div className="flex flex-wrap gap-3 mb-14">
          <button className="bg-blue-600 text-white px-6 py-2.5 text-sm font-semibold rounded-xl shadow-sm hover:bg-blue-700 hover:shadow-md active:scale-[0.98] transition-all duration-200 ease-out flex items-center gap-2">
            {HERO_CONTENT.ctaPrimary}
            <ArrowRight className="w-4 h-4" />
          </button>
          <button className="bg-white text-gray-700 border border-gray-200 px-6 py-2.5 text-sm font-medium rounded-xl hover:border-gray-300 hover:bg-gray-50 active:scale-[0.98] transition-all duration-200">
            {HERO_CONTENT.ctaSecondary}
          </button>
        </div>

        {/* Mini Dashboard Preview */}
        <div className="bg-gray-50 rounded-2xl border border-gray-200/80 p-6 max-w-3xl">
          <p className="text-xs font-medium text-gray-400 mb-4 uppercase tracking-wider">平台数据概览</p>
          <div className="grid grid-cols-3 gap-6">
            {TRUST_METRICS.map((metric) => (
              <div key={metric.label} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center shadow-sm">
                  <metric.icon className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-xl font-bold text-gray-900 tabular-nums">
                    <AnimatedNumber value={metric.value} />
                  </div>
                  <div className="text-xs text-gray-500">{metric.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
