import { ArrowRight } from 'lucide-react'

export function CTASection() {
  return (
    <section className="bg-gray-900">
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="max-w-2xl">
          <h2
            className="text-3xl font-bold text-white mb-4"
            style={{ fontFamily: 'var(--font-inter), sans-serif' }}
          >
            为您的企业量身定制合规战略
          </h2>
          <p className="text-gray-400 mb-8 leading-relaxed">
            我们的咨询团队将深入了解您的业务需求，提供专属的合规评估方案和实施路径。
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <button className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 text-sm font-semibold rounded-lg hover:bg-blue-500 transition-colors duration-200">
              预约咨询
              <ArrowRight className="w-4 h-4" />
            </button>
            <button className="text-sm font-medium text-gray-300 hover:text-white transition-colors">
              下载产品手册 →
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
