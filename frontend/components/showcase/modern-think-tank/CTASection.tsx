import { ArrowRight } from 'lucide-react'

export function CTASection() {
  return (
    <section className="bg-[#18181B]">
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="max-w-xl mx-auto text-center">
          <h2
            className="text-3xl font-bold text-white mb-4"
            style={{ fontFamily: 'var(--font-inter), sans-serif' }}
          >
            加入我们的研究网络
          </h2>
          <p className="text-gray-400 mb-8">
            成为CSAAS研究社区的一员，获取独家行业洞察、政策解读与合规趋势分析
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto">
            <input
              type="email"
              placeholder="您的企业邮箱"
              className="w-full sm:flex-1 px-4 py-3 text-sm bg-white/10 border border-white/10 rounded-md text-white placeholder-gray-500 focus:outline-none focus:border-[#7C3AED]/50 transition-colors"
            />
            <button className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#7C3AED] text-white px-6 py-3 text-sm font-semibold rounded-md hover:bg-[#6D28D9] transition-colors">
              订阅
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-gray-600 mt-4">已有 2,000+ 企业高管订阅</p>
        </div>
      </div>
    </section>
  )
}
