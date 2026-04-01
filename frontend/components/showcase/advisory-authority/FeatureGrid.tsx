import { CORE_FEATURES } from '@/components/showcase/shared/content'

export function FeatureGrid() {
  return (
    <section className="bg-[#FEFDFB]">
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold text-[#1E3A5F] uppercase tracking-[0.15em] mb-3">Professional Services</p>
          <h2 className="text-2xl font-bold text-[#1E3A5F]" style={{ fontFamily: 'var(--font-plus-jakarta), sans-serif' }}>
            专业咨询服务
          </h2>
          <p className="text-sm text-gray-500 mt-3 max-w-lg mx-auto">
            从评估到落地，端到端的专业合规咨询服务
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {CORE_FEATURES.map((feature) => (
            <div key={feature.title} className="flex gap-5 p-6 bg-white border border-gray-200 rounded-sm hover:shadow-sm transition-shadow">
              <div className="shrink-0 w-10 h-10 rounded-sm bg-[#1E3A5F] flex items-center justify-center">
                <feature.icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-[#1E3A5F] mb-1.5">{feature.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed mb-2">{feature.description}</p>
                <span className="text-xs font-semibold text-[#059669]">{feature.metric}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
