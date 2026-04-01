import { CORE_FEATURES } from '@/components/showcase/shared/content'

export function FeatureGrid() {
  return (
    <section id="features" className="bg-white">
      <div className="max-w-[1200px] mx-auto px-8 py-24">
        <div className="grid grid-cols-12 gap-x-8 gap-y-16">
          {CORE_FEATURES.map((feature) => (
            <div key={feature.title} className="col-span-12 md:col-span-3">
              <feature.icon className="w-5 h-5 text-blue-600 mb-6" strokeWidth={1.5} />
              <h3 className="text-base font-bold text-black mb-3">{feature.title}</h3>
              <p className="text-sm leading-relaxed text-gray-500 mb-4">{feature.description}</p>
              <span className="text-xs font-medium uppercase tracking-[0.15em] text-blue-600">
                {feature.metric}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
