import { ArrowRight } from 'lucide-react'

export function CTASection() {
  return (
    <section className="bg-[#1E3A5F]">
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2
              className="text-3xl font-bold text-white mb-4"
              style={{ fontFamily: 'var(--font-plus-jakarta), sans-serif' }}
            >
              与资深顾问对话
            </h2>
            <p className="text-blue-200 leading-relaxed mb-8">
              我们的合规顾问团队拥有平均15年以上的行业经验，曾服务于全球500强企业。预约一次免费咨询，了解我们如何帮助您的组织建立可持续的合规管理体系。
            </p>
            <div className="flex items-center gap-6 text-sm text-blue-300">
              <span>✓ 免费初步评估</span>
              <span>✓ 专属顾问</span>
              <span>✓ 保密协议保障</span>
            </div>
          </div>
          <div className="bg-white rounded-sm p-8">
            <h3 className="text-base font-semibold text-[#1E3A5F] mb-5">预约咨询</h3>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="姓名"
                className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-sm focus:outline-none focus:border-[#1E3A5F] transition-colors"
              />
              <input
                type="text"
                placeholder="公司名称"
                className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-sm focus:outline-none focus:border-[#1E3A5F] transition-colors"
              />
              <input
                type="email"
                placeholder="企业邮箱"
                className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-sm focus:outline-none focus:border-[#1E3A5F] transition-colors"
              />
              <button className="w-full inline-flex items-center justify-center gap-2 bg-[#1E3A5F] text-white px-6 py-3 text-sm font-semibold rounded-sm hover:bg-[#16304f] transition-colors">
                提交预约
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
