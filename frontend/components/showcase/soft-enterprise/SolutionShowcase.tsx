import { SOLUTIONS } from '@/components/showcase/shared/content'

export function SolutionShowcase() {
  return (
    <section className="bg-[#F8FAFC]">
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <p className="text-sm font-medium text-blue-600 mb-2">行业方案</p>
          <h2 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-plus-jakarta), sans-serif' }}>
            深耕垂直领域合规
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {SOLUTIONS.map((sol) => (
            <div
              key={sol.title}
              className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ease-out"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-5 border border-blue-100">
                <sol.icon className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{sol.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed mb-5">{sol.description}</p>
              <div className="flex flex-wrap gap-2">
                {sol.frameworks.map((fw) => (
                  <span
                    key={fw}
                    className="inline-flex items-center px-2.5 py-1 bg-gray-50 text-gray-600 text-xs font-medium rounded-lg border border-gray-200"
                  >
                    {fw}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
