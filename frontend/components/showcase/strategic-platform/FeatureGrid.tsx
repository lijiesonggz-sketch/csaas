import { CAPABILITIES } from '@/components/showcase/shared/content'

export function FeatureGrid() {
  return (
    <section className="bg-white">
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-[0.12em] mb-3">Platform Capabilities</p>
          <h2 className="text-2xl font-bold text-[#0F172A]" style={{ fontFamily: 'var(--font-inter), sans-serif' }}>
            平台能力矩阵
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {CAPABILITIES.map((cap) => (
            <div
              key={cap.title}
              className="group bg-[#F8FAFC] border border-gray-100 rounded-xl p-5 hover:bg-white hover:border-gray-200 hover:shadow-sm transition-all duration-200"
            >
              <div className="flex items-center gap-2 mb-3">
                <cap.icon className="w-4 h-4 text-blue-600" />
                <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                  cap.status === 'active' ? 'bg-emerald-50 text-emerald-600' :
                  cap.status === 'beta' ? 'bg-amber-50 text-amber-600' :
                  'bg-gray-100 text-gray-400'
                }`}>
                  {cap.status === 'active' ? '已上线' : cap.status === 'beta' ? 'Beta' : '即将上线'}
                </span>
              </div>
              <h3 className="text-sm font-semibold text-[#0F172A] mb-1.5">{cap.title}</h3>
              <p className="text-xs text-gray-400 leading-relaxed">{cap.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
