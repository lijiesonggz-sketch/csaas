import { ArrowRight } from 'lucide-react'

export function CTASection() {
  return (
    <section id="cta" className="bg-black">
      <div className="max-w-[1200px] mx-auto px-8 py-24 md:py-32">
        <div className="grid grid-cols-12 gap-8 items-center">
          <div className="col-span-12 md:col-span-7">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4">
              开始您的合规转型
            </h2>
            <p className="text-base text-gray-400 max-w-md">
              联系我们的咨询团队，获取专属合规评估方案
            </p>
          </div>
          <div className="col-span-12 md:col-span-5 flex justify-start md:justify-end">
            <button className="bg-blue-600 text-white px-8 py-3 text-sm font-medium tracking-wide hover:bg-blue-700 transition-colors duration-150 flex items-center gap-2">
              预约专属演示
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
