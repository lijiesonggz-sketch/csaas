import { TRUST_METRICS } from '@/components/showcase/shared/content'
import { AnimatedNumber } from '@/components/showcase/shared/AnimatedNumber'

export function TrustMetrics() {
  return (
    <section id="metrics" className="bg-gray-50 border-y border-gray-200">
      <div className="max-w-[1200px] mx-auto px-8 py-24">
        <div className="grid grid-cols-12 gap-8">
          {TRUST_METRICS.map((metric) => (
            <div key={metric.label} className="col-span-12 md:col-span-4 text-center">
              <AnimatedNumber
                value={metric.value}
                className="text-5xl md:text-6xl font-bold tracking-tight text-black"
              />
              <div className="mt-2 text-sm text-gray-400">{metric.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
