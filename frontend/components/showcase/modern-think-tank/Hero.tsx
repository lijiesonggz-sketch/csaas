import { ArrowRight } from 'lucide-react'

export function Hero() {
  return (
    <section className="bg-[#FAFAF9] border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-6 pt-24 pb-20">
        <div className="max-w-2xl">
          {/* Category label */}
          <div className="text-xs font-semibold text-[#7C3AED] uppercase tracking-[0.15em] mb-5">
            Think Tank · Research · Advisory
          </div>

          <h1
            className="text-4xl md:text-5xl font-bold text-gray-900 leading-[1.2] tracking-tight mb-6"
            style={{ fontFamily: 'var(--font-inter), sans-serif' }}
          >
            前沿思考，<br />
            驱动企业<span className="text-[#7C3AED]">智能决策</span>
          </h1>

          <p className="text-lg text-gray-500 leading-relaxed mb-10">
            CSAAS 汇聚行业研究、政策解读与AI技术，为企业高管提供具有战略深度的合规洞察与决策支持。我们不只是工具，更是您的智囊伙伴。
          </p>

          <div className="flex items-center gap-5">
            <button className="inline-flex items-center gap-2 bg-[#18181B] text-white px-6 py-3 text-sm font-semibold rounded-md hover:bg-gray-800 transition-colors">
              探索研究
              <ArrowRight className="w-4 h-4" />
            </button>
            <button className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
              了解咨询业务 →
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
