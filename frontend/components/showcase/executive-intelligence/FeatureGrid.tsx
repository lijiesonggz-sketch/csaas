import { CORE_FEATURES } from '@/components/showcase/shared/content'

export function FeatureGrid() {
  return (
    <section className="bg-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Left label */}
          <div>
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-3">Core Capabilities</p>
            <h2 className="text-2xl font-bold text-gray-900 mb-4" style={{ fontFamily: 'var(--font-inter), sans-serif' }}>
              智能合规引擎
            </h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              基于三模型协同架构，覆盖从标准解析到行动方案的全链路合规自动化。
            </p>
          </div>

          {/* Right cards */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-5">
            {CORE_FEATURES.map((feature) => (
              <div key={feature.title} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-sm transition-shadow duration-200">
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center mb-4">
                  <feature.icon className="w-4.5 h-4.5 text-blue-700" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed mb-3">{feature.description}</p>
                <span className="text-xs font-semibold text-blue-700">{feature.metric}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
