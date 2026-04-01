export function AIShowcase() {
  return (
    <section className="relative bg-[#06060A]">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/20 to-transparent" />

      <div className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <p className="text-sm font-medium text-cyan-400 mb-3">Architecture</p>
          <h2 className="text-3xl font-bold text-white" style={{ fontFamily: 'var(--font-inter), sans-serif' }}>
            三模型神经协同架构
          </h2>
        </div>

        {/* Architecture diagram */}
        <div className="relative max-w-3xl mx-auto">
          {/* Central node */}
          <div className="flex justify-center mb-8">
            <div className="relative px-8 py-4 rounded-2xl border border-purple-500/20 bg-purple-500/5">
              <div className="text-center">
                <div className="text-sm font-semibold text-white mb-1">CSAAS Neural Engine</div>
                <div className="text-xs text-purple-400 font-mono">Multi-Model Orchestrator</div>
              </div>
              {/* Glow */}
              <div className="absolute inset-0 rounded-2xl bg-purple-500/5 blur-xl" />
            </div>
          </div>

          {/* Three model nodes */}
          <div className="grid grid-cols-3 gap-4">
            {[
              {
                name: 'GPT-4o',
                role: '标准解析引擎',
                desc: '深度理解标准条款，提取关键合规控制点',
                color: 'purple',
                specs: ['114 控制点', '99.2% 准确率'],
              },
              {
                name: 'Claude',
                role: '差距分析引擎',
                desc: '智能比对现状与标准，定位合规差距',
                color: 'violet',
                specs: ['实时分析', '自动报告'],
              },
              {
                name: '通义千问',
                role: '方案生成引擎',
                desc: '基于差距自动生成实施路径和优先级',
                color: 'cyan',
                specs: ['智能排序', '60% 提效'],
              },
            ].map((model) => (
              <div
                key={model.name}
                className={`rounded-2xl border border-${model.color}-500/15 bg-${model.color}-500/[0.03] p-5 text-center`}
                style={{
                  borderColor: `color-mix(in srgb, ${model.color === 'purple' ? '#a855f7' : model.color === 'violet' ? '#8b5cf6' : '#06b6d4'} 15%, transparent)`,
                  backgroundColor: `color-mix(in srgb, ${model.color === 'purple' ? '#a855f7' : model.color === 'violet' ? '#8b5cf6' : '#06b6d4'} 3%, transparent)`,
                }}
              >
                <div className="text-lg font-bold text-white mb-1 font-mono">{model.name}</div>
                <div className={`text-xs font-medium mb-3 ${
                  model.color === 'purple' ? 'text-purple-400' :
                  model.color === 'violet' ? 'text-violet-400' :
                  'text-cyan-400'
                }`}>{model.role}</div>
                <p className="text-xs text-zinc-500 leading-relaxed mb-4">{model.desc}</p>
                <div className="flex flex-col gap-1.5">
                  {model.specs.map((spec) => (
                    <span
                      key={spec}
                      className={`inline-flex items-center justify-center px-2 py-0.5 text-xs font-mono rounded-md border ${
                        model.color === 'purple' ? 'text-purple-400 border-purple-500/15 bg-purple-500/5' :
                        model.color === 'violet' ? 'text-violet-400 border-violet-500/15 bg-violet-500/5' :
                        'text-cyan-400 border-cyan-500/15 bg-cyan-500/5'
                      }`}
                    >
                      {spec}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Connecting lines - decorative dots */}
          <div className="flex justify-center gap-2 mt-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="w-1 h-1 rounded-full bg-purple-500/30" />
            ))}
          </div>
          <p className="text-center text-xs text-zinc-600 mt-3">模型结果交叉验证，确保分析准确性与一致性</p>
        </div>
      </div>
    </section>
  )
}
