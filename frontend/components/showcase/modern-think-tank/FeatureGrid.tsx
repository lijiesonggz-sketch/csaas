import { CORE_FEATURES } from '@/components/showcase/shared/content'

export function FeatureGrid() {
  return (
    <section className="bg-white">
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold text-[#7C3AED] uppercase tracking-[0.15em] mb-3">What We Do</p>
          <h2 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-inter), sans-serif' }}>
            智能合规研究与实践
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {CORE_FEATURES.map((feature, i) => (
            <div key={feature.title} className="group flex gap-5">
              <div className="shrink-0">
                <span className="text-3xl font-bold text-gray-200 group-hover:text-[#7C3AED]/30 transition-colors font-mono">
                  {String(i + 1).padStart(2, '0')}
                </span>
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed mb-2">{feature.description}</p>
                <span className="text-xs font-semibold text-[#EA580C]">{feature.metric}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
