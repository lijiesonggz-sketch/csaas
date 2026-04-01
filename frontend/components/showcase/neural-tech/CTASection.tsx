import { ArrowRight, Sparkles } from 'lucide-react'

export function CTASection() {
  return (
    <section className="relative bg-[#06060A] overflow-hidden">
      {/* Large gradient orbs */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[500px] h-[500px] bg-purple-600/15 rounded-full blur-[120px]" />
      <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-[100px]" />

      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/20 to-transparent" />

      <div className="relative max-w-6xl mx-auto px-6 py-24">
        <div className="max-w-xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 rounded-full border border-purple-500/20 bg-purple-500/5">
            <Sparkles className="w-3 h-3 text-purple-400" />
            <span className="text-xs text-purple-300">开启合规智能新时代</span>
          </div>

          <h2
            className="text-3xl md:text-4xl font-bold text-white mb-4"
            style={{ fontFamily: 'var(--font-inter), sans-serif' }}
          >
            准备好了吗？
          </h2>
          <p className="text-zinc-400 mb-10">
            加入200+企业客户，体验AI驱动的下一代合规管理
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button className="group relative inline-flex items-center gap-2 px-8 py-4 text-sm font-semibold text-white rounded-2xl overflow-hidden">
              <span className="absolute inset-0 bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 group-hover:from-purple-500 group-hover:via-violet-500 group-hover:to-indigo-500 transition-all duration-500" />
              <span className="relative flex items-center gap-2">
                立即开始
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
              </span>
            </button>
            <button className="px-8 py-4 text-sm font-medium text-zinc-400 rounded-2xl border border-white/[0.08] hover:border-white/20 hover:text-zinc-200 backdrop-blur-sm transition-all duration-300">
              联系技术团队
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
