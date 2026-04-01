import { ArrowRight } from 'lucide-react'

export function CTASection() {
  return (
    <section className="bg-gradient-to-br from-blue-600 to-blue-700">
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center max-w-xl mx-auto">
          <h2
            className="text-3xl font-bold text-white mb-4"
            style={{ fontFamily: 'var(--font-plus-jakarta), sans-serif' }}
          >
            开始合规转型之旅
          </h2>
          <p className="text-blue-100 mb-8">
            联系我们的咨询团队，获取专属合规评估方案和演示
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button className="bg-white text-blue-600 px-8 py-3 text-sm font-semibold rounded-xl shadow-sm hover:shadow-md active:scale-[0.98] transition-all duration-200 ease-out flex items-center gap-2">
              预约专属演示
              <ArrowRight className="w-4 h-4" />
            </button>
            <button className="bg-transparent text-white border border-white/30 px-8 py-3 text-sm font-medium rounded-xl hover:bg-white/10 active:scale-[0.98] transition-all duration-200">
              联系销售团队
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
