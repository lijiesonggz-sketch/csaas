import { AnimatedNumber } from '@/components/showcase/shared/AnimatedNumber'
import { TrendingUp, TrendingDown, Shield, AlertTriangle, Target, Clock } from 'lucide-react'

const kpis = [
  { label: '合规评分', value: '87.5', suffix: '分', trend: '+3.2', up: true, icon: Shield, color: 'text-green-600', bg: 'bg-green-50' },
  { label: '风险等级', value: '中低', suffix: '', trend: '改善', up: true, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
  { label: '完成进度', value: '72', suffix: '%', trend: '+8', up: true, icon: Target, color: 'text-blue-600', bg: 'bg-blue-50' },
  { label: '待处理项', value: '14', suffix: '项', trend: '-3', up: false, icon: Clock, color: 'text-red-600', bg: 'bg-red-50' },
]

export function KPIRow() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi) => (
        <div key={kpi.label} className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{kpi.label}</span>
            <div className={`w-8 h-8 ${kpi.bg} rounded flex items-center justify-center`}>
              <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold text-gray-900 tabular-nums">
              <AnimatedNumber value={kpi.value} />
            </span>
            <span className="text-sm text-gray-500">{kpi.suffix}</span>
          </div>
          <div className="flex items-center gap-1 mt-2">
            {kpi.up ? (
              <TrendingUp className="w-3 h-3 text-green-600" />
            ) : (
              <TrendingDown className="w-3 h-3 text-red-500" />
            )}
            <span className={`text-xs font-medium ${kpi.up ? 'text-green-600' : 'text-red-500'}`}>
              {kpi.trend}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
