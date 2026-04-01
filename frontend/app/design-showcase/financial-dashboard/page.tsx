import { KPIRow } from '@/components/showcase/financial-dashboard/KPIRow'
import { ChartSection } from '@/components/showcase/financial-dashboard/ChartSection'
import { DataTable } from '@/components/showcase/financial-dashboard/DataTable'
import { CTASection } from '@/components/showcase/financial-dashboard/CTASection'
import { HERO_CONTENT } from '@/components/showcase/shared/content'
import { ArrowRight, Search, Bell, User } from 'lucide-react'

export default function FinancialDashboardPage() {
  return (
    <div className="theme-financial bg-[#F1F4F9] min-h-screen" style={{ fontFamily: 'var(--font-inter), sans-serif' }}>
      {/* Navigation */}
      <nav className="bg-[#1E3A5F] text-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <span className="text-base font-bold tracking-tight">CSAAS</span>
            <div className="hidden md:flex items-center gap-6">
              <a href="#" className="text-sm font-medium text-blue-200 hover:text-white transition-colors">概览</a>
              <a href="#" className="text-sm font-medium text-white">合规评估</a>
              <a href="#" className="text-sm font-medium text-blue-200 hover:text-white transition-colors">差距分析</a>
              <a href="#" className="text-sm font-medium text-blue-200 hover:text-white transition-colors">雷达</a>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Search className="w-4 h-4 text-blue-300" />
            <Bell className="w-4 h-4 text-blue-300" />
            <User className="w-4 h-4 text-blue-300" />
          </div>
        </div>
      </nav>

      {/* Page Header */}
      <div className="max-w-7xl mx-auto px-6 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">合规评估概览</h1>
            <p className="text-sm text-gray-500 mt-1">实时监控合规状态与风险指标</p>
          </div>
          <div className="flex items-center gap-3">
            <a href="/design-showcase" className="text-sm text-gray-500 hover:text-blue-600 transition-colors">返回</a>
            <button className="bg-[#1E3A5F] text-white px-4 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 hover:bg-[#2B5F9E] transition-colors">
              导出报告
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="max-w-7xl mx-auto px-6 pb-6 space-y-4">
        <KPIRow />
        <ChartSection />
        <DataTable />
      </div>

      <CTASection />

      <footer className="bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <span className="text-xs text-gray-400">CSAAS - 企业级AI合规咨询平台</span>
          <a href="/design-showcase" className="text-xs text-gray-400 hover:text-blue-600 transition-colors">返回方案选择</a>
        </div>
      </footer>
    </div>
  )
}
