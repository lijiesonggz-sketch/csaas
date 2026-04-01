import { ArrowRight, TrendingUp } from 'lucide-react'

export function Hero() {
  return (
    <section className="bg-white border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-6 pt-20 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left: Editorial content */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-100 rounded">
              <TrendingUp className="w-3.5 h-3.5" />
              2024 企业合规成熟度指数发布
            </div>
            <h1
              className="text-4xl md:text-5xl font-bold text-gray-900 leading-[1.15] tracking-tight mb-6"
              style={{ fontFamily: 'var(--font-inter), sans-serif' }}
            >
              企业决策的
              <br />
              <span className="text-blue-700">智能智库</span>
            </h1>
            <p className="text-base text-gray-500 leading-relaxed mb-8 max-w-md">
              CSAAS 为企业CIO及高管团队提供AI驱动的合规评估、战略分析与决策支持，助力企业在复杂监管环境中建立可持续竞争优势。
            </p>
            <div className="flex items-center gap-4">
              <button className="inline-flex items-center gap-2 bg-blue-700 text-white px-6 py-2.5 text-sm font-semibold rounded-lg hover:bg-blue-800 transition-colors duration-200">
                预约咨询
                <ArrowRight className="w-4 h-4" />
              </button>
              <button className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                查看研究报告 →
              </button>
            </div>
          </div>

          {/* Right: Data visualization preview */}
          <div className="hidden lg:block">
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">Compliance Maturity Index</div>
                  <div className="text-sm font-semibold text-gray-900 mt-1">合规成熟度趋势</div>
                </div>
                <div className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                  <TrendingUp className="w-3 h-3" />
                  +23%
                </div>
              </div>
              {/* Simple bar chart */}
              <div className="space-y-3">
                {[
                  { label: '数据安全', value: 85, color: 'bg-blue-600' },
                  { label: '访问控制', value: 72, color: 'bg-blue-500' },
                  { label: '风险管理', value: 68, color: 'bg-blue-400' },
                  { label: '事件响应', value: 54, color: 'bg-blue-300' },
                  { label: '业务连续性', value: 41, color: 'bg-amber-400' },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-600">{item.label}</span>
                      <span className="text-xs font-semibold text-gray-900 font-mono">{item.value}%</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.value}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
