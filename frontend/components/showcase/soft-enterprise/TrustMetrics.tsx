import { TRUST_METRICS } from '@/components/showcase/shared/content'
import { AnimatedNumber } from '@/components/showcase/shared/AnimatedNumber'

export function TrustMetrics() {
  return (
    <section className="bg-white border-y border-gray-100">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {TRUST_METRICS.map((metric, index) => (
            <div key={metric.label} className="text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-50 rounded-2xl mb-5 border border-blue-100">
                <metric.icon className="w-6 h-6 text-blue-600" />
              </div>
              <div className="text-4xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'var(--font-plus-jakarta), sans-serif' }}>
                <AnimatedNumber value={metric.value} />
              </div>
              <p className="text-sm text-gray-500">{metric.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
