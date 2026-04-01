import { Shield, Users, Award } from 'lucide-react'

const STATS = [
  { value: '200+', label: '服务企业', sublabel: '覆盖金融、电信、能源等行业', icon: Users },
  { value: '15年+', label: '顾问平均经验', sublabel: '来自四大、知名咨询公司', icon: Award },
  { value: 'ISO 27001', label: '安全认证', sublabel: '通过国际信息安全管理体系认证', icon: Shield },
]

export function TrustMetrics() {
  return (
    <section className="bg-white border-y border-gray-100">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {STATS.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-[#1E3A5F] rounded-sm mb-4">
                <stat.icon className="w-5 h-5 text-white" />
              </div>
              <div className="text-3xl font-bold text-[#1E3A5F] mb-1" style={{ fontFamily: 'var(--font-plus-jakarta), sans-serif' }}>
                {stat.value}
              </div>
              <div className="text-sm font-semibold text-gray-900 mb-1">{stat.label}</div>
              <div className="text-xs text-gray-400">{stat.sublabel}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
