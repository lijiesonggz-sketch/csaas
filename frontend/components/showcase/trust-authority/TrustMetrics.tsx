import { TRUST_METRICS } from '@/components/showcase/shared/content'
import { AnimatedNumber } from '@/components/showcase/shared/AnimatedNumber'

export function TrustMetrics() {
  return (
    <section className="bg-gray-50 border-y border-gray-200">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {TRUST_METRICS.map((metric) => (
            <div key={metric.label} className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-4">
                <metric.icon className="w-6 h-6 text-blue-600" />
              </div>
              <div className="text-4xl font-bold text-gray-900 mb-2">
                <AnimatedNumber value={metric.value} />
              </div>
              <p className="text-sm text-gray-500 font-medium">{metric.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
