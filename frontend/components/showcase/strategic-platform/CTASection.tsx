import { ArrowRight } from 'lucide-react'

export function CTASection() {
  return (
    <section className="bg-[#F8FAFC]">
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="bg-white border border-gray-200 rounded-xl p-10 md:p-14 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="max-w-md">
            <h2
              className="text-2xl font-bold text-[#0F172A] mb-3"
              style={{ fontFamily: 'var(--font-inter), sans-serif' }}
            >
              开始使用CSAAS平台
            </h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              注册即可免费体验核心功能，或联系我们的团队获取定制方案
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button className="inline-flex items-center gap-2 bg-[#0F172A] text-white px-6 py-3 text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors">
              免费注册
              <ArrowRight className="w-4 h-4" />
            </button>
            <button className="px-6 py-3 text-sm font-medium text-gray-600 rounded-lg border border-gray-200 hover:bg-white transition-colors">
              联系销售
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
