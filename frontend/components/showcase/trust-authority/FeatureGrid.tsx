import { CORE_FEATURES } from '@/components/showcase/shared/content'
import { Badge } from '@/components/ui/badge'

export function FeatureGrid() {
  return (
    <section className="bg-white">
      <div className="max-w-6xl mx-auto px-6 py-20">
        <p className="text-sm font-medium text-blue-600 mb-2">核心能力</p>
        <h2 className="text-2xl font-bold text-gray-900 mb-12">
          全链路合规管理平台
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {CORE_FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow duration-200 border-l-4 border-l-blue-600"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 bg-blue-50 rounded-md flex items-center justify-center">
                  <feature.icon className="w-5 h-5 text-blue-600" />
                </div>
                <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-100 text-xs font-medium">
                  {feature.metric}
                </Badge>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
