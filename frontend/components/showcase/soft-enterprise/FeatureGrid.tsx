import { CORE_FEATURES } from '@/components/showcase/shared/content'

export function FeatureGrid() {
  return (
    <section className="bg-[#F8FAFC]">
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <p className="text-sm font-medium text-blue-600 mb-2">核心功能</p>
          <h2 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-plus-jakarta), sans-serif' }}>
            全链路智能合规管理
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CORE_FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ease-out group"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 transition-colors duration-200">
                  <feature.icon className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-base font-semibold text-gray-900">{feature.title}</h3>
                    <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                      {feature.metric}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 leading-relaxed">{feature.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
