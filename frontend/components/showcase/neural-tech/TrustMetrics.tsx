import { TRUST_METRICS } from '@/components/showcase/shared/content'
import { AnimatedNumber } from '@/components/showcase/shared/AnimatedNumber'

export function TrustMetrics() {
  return (
    <section className="relative bg-[#06060A]">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent" />
      {/* Ambient glow */}
      <div className="absolute bottom-0 left-1/4 w-[500px] h-[300px] bg-violet-600/8 rounded-full blur-[120px]" />

      <div className="relative max-w-6xl mx-auto px-6 py-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {TRUST_METRICS.map((metric, i) => (
            <div key={metric.label} className="text-center group">
              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-5 border border-white/[0.08] ${
                i === 0 ? 'bg-purple-500/10' :
                i === 1 ? 'bg-violet-500/10' :
                'bg-cyan-500/10'
              }`}>
                <metric.icon className={`w-5 h-5 ${
                  i === 0 ? 'text-purple-400' :
                  i === 1 ? 'text-violet-400' :
                  'text-cyan-400'
                }`} />
              </div>
              <div
                className={`text-4xl font-bold mb-2 ${
                  i === 0 ? 'bg-gradient-to-r from-purple-400 to-violet-400' :
                  i === 1 ? 'bg-gradient-to-r from-violet-400 to-indigo-400' :
                  'bg-gradient-to-r from-indigo-400 to-cyan-400'
                } bg-clip-text text-transparent`}
                style={{ fontFamily: 'var(--font-inter), sans-serif' }}
              >
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
