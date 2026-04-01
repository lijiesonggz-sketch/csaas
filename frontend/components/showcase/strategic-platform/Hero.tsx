import { CORE_FEATURES, CAPABILITIES } from '@/components/showcase/shared/content'
import { ArrowRight } from 'lucide-react'

export function Hero() {
  return (
    <section className="bg-[#F8FAFC]">
      <div className="max-w-6xl mx-auto px-6 pt-20 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 text-xs font-semibold text-[#0F172A] bg-white border border-gray-200 rounded-lg">
              Enterprise Advisory Platform
            </div>
            <h1
              className="text-4xl md:text-5xl font-bold text-[#0F172A] leading-[1.15] tracking-tight mb-6"
              style={{ fontFamily: 'var(--font-inter), sans-serif' }}
            >
              战略合规的
              <br />
              <span className="text-blue-600">智能平台</span>
            </h1>
            <p className="text-base text-gray-500 leading-relaxed mb-8 max-w-md">
              CSAAS 将AI技术与行业洞察相结合，为企业提供从合规评估到战略规划的一站式智能咨询平台。
            </p>
            <div className="flex items-center gap-4">
              <button className="inline-flex items-center gap-2 bg-[#0F172A] text-white px-6 py-2.5 text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors">
                开始使用
                <ArrowRight className="w-4 h-4" />
              </button>
              <button className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                观看演示 →
              </button>
            </div>
          </div>

          {/* Platform preview */}
          <div className="hidden lg:block">
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              {/* Tab bar */}
              <div className="flex items-center gap-1 px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                {['概览', '评估', '报告'].map((tab, i) => (
                  <button
                    key={tab}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                      i === 0 ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              {/* Mini dashboard content */}
              <div className="p-5">
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { label: '合规评分', value: '87/100', trend: '+5' },
                    { label: '待处理', value: '12', trend: '-3' },
                    { label: '框架覆盖', value: '50+', trend: '' },
                  ].map((card) => (
                    <div key={card.label} className="bg-gray-50 rounded-lg p-3">
                      <div className="text-[10px] text-gray-400 mb-1">{card.label}</div>
                      <div className="text-lg font-bold text-[#0F172A] font-mono">{card.value}</div>
                      {card.trend && (
                        <div className={`text-[10px] font-medium ${card.trend.startsWith('+') ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {card.trend}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {/* Progress bars */}
                <div className="space-y-2">
                  {[
                    { label: 'ISO 27001', progress: 85 },
                    { label: '等保三级', progress: 72 },
                    { label: 'GDPR', progress: 60 },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-3">
                      <span className="text-[10px] text-gray-500 w-16">{item.label}</span>
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${item.progress}%` }} />
                      </div>
                      <span className="text-[10px] font-mono text-gray-400">{item.progress}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
