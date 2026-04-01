import { INSIGHTS } from '@/components/showcase/shared/content'
import { BookOpen, ArrowRight } from 'lucide-react'

export function InsightsSection() {
  return (
    <section className="bg-white">
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="flex items-start justify-between mb-12">
          <div>
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-3">Research & Insights</p>
            <h2 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-inter), sans-serif' }}>
              研究洞察
            </h2>
          </div>
          <button className="hidden sm:inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:text-blue-800 transition-colors">
            查看全部 <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {INSIGHTS.map((insight, i) => (
            <article
              key={insight.title}
              className={`group border rounded-lg p-6 hover:shadow-sm transition-shadow duration-200 ${
                i === 0 ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-center gap-2 mb-4">
                <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${
                  insight.category === '研究报告' ? 'bg-blue-100 text-blue-700' :
                  insight.category === '白皮书' ? 'bg-violet-100 text-violet-700' :
                  'bg-emerald-100 text-emerald-700'
                }`}>
                  {insight.category}
                </span>
                <span className="text-xs text-gray-400">{insight.readTime}</span>
              </div>
              <h3 className="text-base font-semibold text-gray-900 leading-snug mb-3 group-hover:text-blue-700 transition-colors">
                {insight.title}
              </h3>
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <BookOpen className="w-3 h-3" />
                {insight.date}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
