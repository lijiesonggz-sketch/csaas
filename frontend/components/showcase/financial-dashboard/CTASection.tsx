import { ArrowRight } from 'lucide-react'

export function CTASection() {
  return (
    <section className="bg-[#1E3A5F]">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">获取完整合规评估报告</h2>
            <p className="text-blue-200 text-sm">详细覆盖50+合规框架的差距分析与改进建议</p>
          </div>
          <button className="bg-white text-[#1E3A5F] px-6 py-3 text-sm font-semibold rounded-lg hover:bg-blue-50 transition-colors duration-200 flex items-center gap-2 whitespace-nowrap">
            免费获取报告
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  )
}
