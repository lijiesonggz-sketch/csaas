import { Shield, Award, CheckCircle2 } from 'lucide-react'

export function Hero() {
  return (
    <section className="bg-[#FEFDFB]">
      <div className="max-w-6xl mx-auto px-6 pt-20 pb-16">
        <div className="max-w-3xl">
          {/* Trust bar */}
          <div className="flex items-center gap-4 mb-8">
            <div className="flex items-center gap-1.5 text-xs font-medium text-[#059669]">
              <CheckCircle2 className="w-4 h-4" />
              ISO 27001 认证
            </div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-[#059669]">
              <Shield className="w-4 h-4" />
              SOC 2 Type II
            </div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-[#059669]">
              <Award className="w-4 h-4" />
              等保三级
            </div>
          </div>

          <h1
            className="text-4xl md:text-5xl font-bold text-[#1E3A5F] leading-[1.2] mb-6"
            style={{ fontFamily: 'var(--font-plus-jakarta), sans-serif' }}
          >
            企业合规战略的
            <br />
            权威顾问伙伴
          </h1>

          <p className="text-base text-gray-600 leading-relaxed mb-8 max-w-xl">
            CSAAS 汇聚资深合规专家与AI技术，为企业提供权威的合规评估、差距分析与战略规划服务。我们帮助CIO及高管团队在复杂监管环境中建立系统化的合规管理体系。
          </p>

          <div className="flex items-center gap-4">
            <button className="bg-[#1E3A5F] text-white px-7 py-3 text-sm font-semibold rounded-sm hover:bg-[#16304f] transition-colors">
              预约咨询
            </button>
            <button className="text-sm font-medium text-[#1E3A5F] hover:text-[#16304f] transition-colors border-b border-[#1E3A5F] pb-0.5">
              查看服务详情
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
