import { TRUST_METRICS } from '@/components/showcase/shared/content'
import { AnimatedNumber } from '@/components/showcase/shared/AnimatedNumber'

export function TrustMetrics() {
  return (
    <section className="relative bg-[#09090B]">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {TRUST_METRICS.map((metric) => (
            <div key={metric.label} className="text-center group">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.08] mb-5 group-hover:border-indigo-500/30 transition-colors duration-300">
                <metric.icon className="w-5 h-5 text-indigo-400" />
              </div>
              <div className="text-4xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent mb-2" style={{ fontFamily: 'var(--font-inter), sans-serif' }}>
                <AnimatedNumber value={metric.value} />
              </div>
              <p className="text-sm text-zinc-500">{metric.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
