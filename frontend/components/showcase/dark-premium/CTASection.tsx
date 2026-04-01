import { ArrowRight } from 'lucide-react'

export function CTASection() {
  return (
    <section className="relative bg-[#09090B] overflow-hidden">
      {/* Gradient orb */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-[radial-gradient(ellipse,rgba(99,102,241,0.12)_0%,transparent_70%)]" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="relative max-w-6xl mx-auto px-6 py-24">
        <div className="max-w-xl mx-auto text-center">
          <h2
            className="text-3xl font-bold text-white mb-4"
            style={{ fontFamily: 'var(--font-inter), sans-serif' }}
          >
            开始合规智能化转型
          </h2>
          <p className="text-zinc-400 mb-10">
            联系我们的团队，获取专属合规评估方案和技术演示
          </p>

          {/* Glass form card */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <input
                type="text"
                placeholder="姓名"
                className="w-full px-4 py-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
              />
              <input
                type="text"
                placeholder="公司"
                className="w-full px-4 py-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
              />
            </div>
            <input
              type="email"
              placeholder="企业邮箱"
              className="w-full px-4 py-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-colors mb-6"
            />
            <button className="w-full group relative inline-flex items-center justify-center gap-2 px-7 py-3.5 text-sm font-semibold text-white rounded-xl overflow-hidden">
              <span className="absolute inset-0 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 group-hover:from-indigo-500 group-hover:to-purple-500 transition-all duration-300" />
              <span className="relative flex items-center gap-2">
                预约专属演示
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200" />
              </span>
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
