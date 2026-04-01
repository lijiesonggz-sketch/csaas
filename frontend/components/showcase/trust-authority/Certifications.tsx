import { CERTIFICATIONS } from '@/components/showcase/shared/content'

export function Certifications() {
  return (
    <section className="bg-white">
      <div className="max-w-6xl mx-auto px-6 py-20">
        <p className="text-sm font-medium text-blue-600 mb-2">安全合规</p>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          国际权威认证
        </h2>
        <p className="text-sm text-gray-500 mb-12 max-w-lg">
          我们通过多项国际安全标准认证，确保您的数据安全与合规需求得到最高级别保障
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {CERTIFICATIONS.map((cert) => (
            <div
              key={cert.name}
              className="bg-gray-50 border border-gray-200 rounded-lg p-5 text-center hover:border-blue-200 hover:bg-blue-50 transition-colors duration-200"
            >
              <cert.icon className="w-8 h-8 text-blue-600 mx-auto mb-3" />
              <div className="text-sm font-bold text-gray-900 mb-1">{cert.name}</div>
              <div className="text-xs text-gray-500">{cert.description}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
