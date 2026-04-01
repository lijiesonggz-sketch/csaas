import { CORE_FEATURES } from '@/components/showcase/shared/content'

export function FeatureGrid() {
  return (
    <section className="relative bg-[#06060A]">
      {/* Subtle glow */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-purple-600/10 rounded-full blur-[120px]" />

      <div className="relative max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <p className="text-sm font-medium text-purple-400 mb-3">Neural Capabilities</p>
          <h2 className="text-3xl font-bold text-white" style={{ fontFamily: 'var(--font-inter), sans-serif' }}>
            AI 驱动的合规引擎
          </h2>
          <p className="text-sm text-zinc-500 mt-3 max-w-md mx-auto">
            三模型协同推理，覆盖从标准解析到行动方案的全链路合规自动化
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {CORE_FEATURES.map((feature, i) => (
            <div
              key={feature.title}
              className="group relative rounded-2xl border border-white/[0.06] bg-white/[0.02] p-7 hover:border-purple-500/20 transition-all duration-500 overflow-hidden"
            >
              {/* Holographic shimmer on hover */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-gradient-to-r from-purple-600/5 via-transparent to-cyan-600/5" />

              <div className="relative">
                <div className="flex items-center gap-4 mb-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border border-white/[0.08] ${
                    i === 0 ? 'bg-gradient-to-br from-purple-500/20 to-violet-500/20' :
                    i === 1 ? 'bg-gradient-to-br from-violet-500/20 to-indigo-500/20' :
                    i === 2 ? 'bg-gradient-to-br from-indigo-500/20 to-cyan-500/20' :
                    'bg-gradient-to-br from-cyan-500/20 to-teal-500/20'
                  }`}>
                    <feature.icon className={`w-5 h-5 ${
                      i === 0 ? 'text-purple-400' :
                      i === 1 ? 'text-violet-400' :
                      i === 2 ? 'text-indigo-400' :
                      'text-cyan-400'
                    }`} />
                  </div>
                  <h3 className="text-lg font-semibold text-white">{feature.title}</h3>
                </div>
                <p className="text-sm text-zinc-400 leading-relaxed mb-4">{feature.description}</p>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-2.5 py-1 text-xs font-mono font-medium rounded-lg border ${
                    i % 2 === 0
                      ? 'text-purple-400 bg-purple-500/10 border-purple-500/20'
                      : 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20'
                  }`}>
                    {feature.metric}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
