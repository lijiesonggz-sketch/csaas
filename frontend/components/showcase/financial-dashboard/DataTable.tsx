import { Badge } from '@/components/ui/badge'

const frameworkData = [
  { name: 'ISO 27001:2022', coverage: 92, gaps: 3, status: '良好' },
  { name: '等保三级', coverage: 78, gaps: 8, status: '待改进' },
  { name: 'GDPR', coverage: 85, gaps: 5, status: '良好' },
  { name: 'SOC 2 Type II', coverage: 88, gaps: 4, status: '良好' },
  { name: 'PCI DSS', coverage: 65, gaps: 12, status: '需关注' },
]

const statusColors: Record<string, string> = {
  '良好': 'bg-green-50 text-green-700 border-green-200',
  '待改进': 'bg-amber-50 text-amber-700 border-amber-200',
  '需关注': 'bg-red-50 text-red-700 border-red-200',
}

export function DataTable() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">合规框架覆盖情况</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">框架名称</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">覆盖率</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">差距项</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">状态</th>
            </tr>
          </thead>
          <tbody>
            {frameworkData.map((row) => (
              <tr key={row.name} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <td className="px-6 py-3 text-sm font-medium text-gray-900">{row.name}</td>
                <td className="px-6 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-gray-100 rounded-full max-w-[120px]">
                      <div
                        className={`h-2 rounded-full ${
                          row.coverage >= 85 ? 'bg-green-500' : row.coverage >= 70 ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${row.coverage}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-600 tabular-nums w-10">{row.coverage}%</span>
                  </div>
                </td>
                <td className="px-6 py-3 text-sm tabular-nums text-gray-600">{row.gaps}</td>
                <td className="px-6 py-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded border ${statusColors[row.status]}`}>
                    {row.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
