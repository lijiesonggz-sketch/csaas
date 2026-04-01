import { ArrowRight } from 'lucide-react'

export function CTASection() {
  return (
    <section className="bg-blue-900">
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="max-w-xl">
          <h2 className="text-3xl font-bold text-white mb-4" style={{ fontFamily: 'var(--font-plus-jakarta), sans-serif' }}>
            预约专属合规评估
          </h2>
          <p className="text-blue-200 mb-8">
            我们的咨询顾问将为您提供一对一的合规评估方案演示
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="您的姓名"
              className="bg-blue-800/50 border border-blue-700 rounded-md px-4 py-3 text-sm text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="公司名称"
              className="bg-blue-800/50 border border-blue-700 rounded-md px-4 py-3 text-sm text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button className="bg-white text-blue-900 px-6 py-3 text-sm font-semibold rounded-md hover:bg-blue-50 transition-colors duration-200 flex items-center justify-center gap-2 whitespace-nowrap">
              预约演示
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
