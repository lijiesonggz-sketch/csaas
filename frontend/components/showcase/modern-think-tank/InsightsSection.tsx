import { INSIGHTS } from '@/components/showcase/shared/content'
import { ArrowRight, Clock } from 'lucide-react'

export function InsightsSection() {
  return (
    <section className="bg-[#FAFAF9]">
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="flex items-end justify-between mb-12">
          <div>
            <p className="text-xs font-semibold text-[#7C3AED] uppercase tracking-[0.15em] mb-3">Latest Research</p>
            <h2 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-inter), sans-serif' }}>
              最新洞察
            </h2>
          </div>
          <button className="hidden sm:inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
            全部文章 <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {INSIGHTS.map((insight, i) => (
            <article
              key={insight.title}
              className={`group cursor-pointer ${
                i === 0 ? 'md:col-span-2 md:row-span-2' : ''
              }`}
            >
              <div className={`h-full border rounded-md p-6 hover:shadow-sm transition-all duration-200 ${
                i === 0 ? 'bg-white border-gray-200' : 'bg-white border-gray-200'
              }`}>
                <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-sm ${
                  insight.category === '研究报告' ? 'bg-[#7C3AED]/10 text-[#7C3AED]' :
                  insight.category === '白皮书' ? 'bg-[#EA580C]/10 text-[#EA580C]' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {insight.category}
                </span>
                <h3 className={`font-semibold text-gray-900 leading-snug mt-4 mb-3 group-hover:text-[#7C3AED] transition-colors ${
                  i === 0 ? 'text-xl' : 'text-base'
                }`}>
                  {insight.title}
                </h3>
                {i === 0 && (
                  <p className="text-sm text-gray-500 leading-relaxed mb-4">
                    深入分析2024年企业合规管理的成熟度水平，覆盖金融、电信、能源等关键行业，为CIO提供战略决策参考。
                  </p>
                )}
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span>{insight.date}</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {insight.readTime}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
