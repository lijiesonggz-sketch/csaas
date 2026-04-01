import { CORE_FEATURES } from '@/components/showcase/shared/content'

export function FeatureGrid() {
  return (
    <section className="relative bg-[#09090B]">
      {/* Subtle top border gradient */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <p className="text-sm font-medium text-indigo-400 mb-3 tracking-wide uppercase">Core Capabilities</p>
          <h2 className="text-3xl font-bold text-white" style={{ fontFamily: 'var(--font-inter), sans-serif' }}>
            全栈合规引擎
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {CORE_FEATURES.map((feature, i) => (
            <div
              key={feature.title}
              className="group relative rounded-2xl border border-white/[0.06] bg-white/[0.02] p-7 hover:border-white/[0.12] hover:bg-white/[0.04] transition-all duration-300"
            >
              {/* Hover glow */}
              <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[radial-gradient(600px_circle_at_var(--mouse-x,50%)_var(--mouse-y,50%),rgba(99,102,241,0.06),transparent_40%)]" />

              <div className="relative">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/[0.08] flex items-center justify-center">
                    <feature.icon className="w-5 h-5 text-indigo-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">{feature.title}</h3>
                </div>
                <p className="text-sm text-zinc-400 leading-relaxed mb-4">{feature.description}</p>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2.5 py-1 text-xs font-mono font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-md">
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
