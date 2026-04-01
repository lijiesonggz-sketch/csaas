import Link from 'next/link'
import { ArrowRight, Grid3X3, Shield, BarChart3, Sparkles, Monitor, Cpu, BookOpen, TrendingUp, Building2 } from 'lucide-react'

const themes = [
  {
    id: 'executive-intelligence',
    name: 'Executive Intelligence',
    subtitle: '高管智识',
    description: '编辑式排版+数据可视化+研究报告模块。McKinsey Digital 与 Stripe 的融合，高端智库感与科技感兼具。',
    icon: TrendingUp,
    colors: ['#FFFFFF', '#1E40AF', '#3B82F6', '#F9FAFB'],
    tags: ['智库', '编辑式', '数据驱动'],
    radius: '8px',
    reference: 'McKinsey Digital / Stripe',
    font: 'Inter',
    isNew: true,
  },
  {
    id: 'advisory-authority',
    name: 'Advisory Authority',
    subtitle: '权威顾问',
    description: '暖白底+深蓝导航+安全认证标识+左侧装饰线卡片。最权威的咨询机构感，适合CIO决策层。',
    icon: Building2,
    colors: ['#FEFDFB', '#1E3A5F', '#059669', '#FFFFFF'],
    tags: ['权威', '咨询', '认证'],
    radius: '4px',
    reference: 'BCG / Gartner',
    font: 'Plus Jakarta Sans',
    isNew: true,
  },
  {
    id: 'modern-think-tank',
    name: 'Modern Think Tank',
    subtitle: '现代智库',
    description: '杂志式布局+编号列表+研究洞察模块+紫色点缀。HBR与IDEO风格，思想领导力调性。',
    icon: BookOpen,
    colors: ['#FAFAF9', '#7C3AED', '#EA580C', '#18181B'],
    tags: ['思想领导', '杂志', '洞察'],
    radius: '6px',
    reference: 'HBR / IDEO',
    font: 'Inter',
    isNew: true,
  },
  {
    id: 'strategic-platform',
    name: 'Strategic Platform',
    subtitle: '战略平台',
    description: '清爽仪表板预览+能力矩阵+状态标签+卡片布局。Notion与Accenture的融合，科技感与亲和力兼顾。',
    icon: Sparkles,
    colors: ['#F8FAFC', '#0F172A', '#2563EB', '#10B981'],
    tags: ['平台', '能力矩阵', '清爽'],
    radius: '10px',
    reference: 'Notion / Accenture',
    font: 'Inter',
    isNew: true,
  },
  {
    id: 'dark-premium',
    name: 'Dark Premium',
    subtitle: '深色高端',
    description: '深黑背景、毛玻璃卡片、微光渐变边框、终端预览。强烈的科技高端感。参考 Linear、Vercel。',
    icon: Monitor,
    colors: ['#09090B', '#6366F1', '#A855F7', '#22D3EE'],
    tags: ['深色', '科技', '毛玻璃'],
    radius: '12px',
    reference: 'Linear / Vercel / Raycast',
    font: 'Inter',
  },
  {
    id: 'neural-tech',
    name: 'Neural Tech',
    subtitle: 'AI 原生',
    description: '深色 + mesh渐变 + 全息光效 + AI处理管线可视化。最强科技前沿感。参考 OpenAI、Anthropic。',
    icon: Cpu,
    colors: ['#06060A', '#A855F7', '#8B5CF6', '#06B6D4'],
    tags: ['AI原生', '渐变', '全息'],
    radius: '16px',
    reference: 'OpenAI / Anthropic',
    font: 'Inter',
  },
  {
    id: 'swiss-modern',
    name: 'Swiss Modernism',
    subtitle: '瑞士现代主义',
    description: '严格网格、极简设计、黑白+蓝色强调。无圆角、无阴影、无动画。参考 Stripe、Bloomberg。',
    icon: Grid3X3,
    colors: ['#000000', '#FFFFFF', '#2563EB', '#737373'],
    tags: ['极简', '专业', '克制'],
    radius: '0px',
    reference: 'Stripe / Bloomberg',
    font: 'Inter',
  },
  {
    id: 'trust-authority',
    name: 'Trust & Authority',
    subtitle: '信任权威',
    description: '深蓝色系、安全认证徽章、左侧蓝色装饰线卡片。强调安全与权威。参考 McKinsey、Deloitte。',
    icon: Shield,
    colors: ['#2563EB', '#94A3B8', '#059669', '#F8FAFC'],
    tags: ['权威', '安全', '信任'],
    radius: '6px',
    reference: 'McKinsey / Deloitte',
    font: 'Plus Jakarta Sans',
  },
  {
    id: 'financial-dashboard',
    name: 'Financial Dashboard',
    subtitle: '金融仪表板',
    description: '数据密集布局、KPI卡片、趋势图表、盈亏色彩编码。参考 TradingView、Morningstar。',
    icon: BarChart3,
    colors: ['#1E3A5F', '#16A34A', '#EF4444', '#F1F4F9'],
    tags: ['数据驱动', '量化', '仪表板'],
    radius: '8px',
    reference: 'TradingView / Morningstar',
    font: 'Inter + Tabular',
  },
  {
    id: 'soft-enterprise',
    name: 'Soft Enterprise',
    subtitle: '柔和企业',
    description: '毛玻璃导航、统一12px圆角、柔和阴影、流畅动画。现代SaaS风格。参考 Notion、Linear、Vercel。',
    icon: Sparkles,
    colors: ['#2563EB', '#64748B', '#16A34A', '#F8FAFC'],
    tags: ['现代', '柔和', 'WCAG AA+'],
    radius: '12px',
    reference: 'Notion / Linear / Vercel',
    font: 'Plus Jakarta Sans',
  },
]

export default function DesignShowcasePage() {
  const newThemes = themes.filter(t => t.isNew)
  const existingThemes = themes.filter(t => !t.isNew)

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: 'var(--font-inter), sans-serif' }}>
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">CSAAS UI 设计方案</h1>
              <p className="text-sm text-gray-500 mt-1">企业智囊平台 — 10种风格方案</p>
            </div>
            <a href="/" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">返回首页</a>
          </div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 py-10">
        {/* Positioning */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-10">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">定位与方向</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="text-xs font-medium text-red-600 mb-2">当前问题</div>
              <ul className="space-y-1.5">
                <li className="text-sm text-gray-600">渐变滥用、动画过度</li>
                <li className="text-sm text-gray-600">圆角/间距不统一</li>
                <li className="text-sm text-gray-600">MUI + shadcn/ui 混用</li>
              </ul>
            </div>
            <div>
              <div className="text-xs font-medium text-blue-600 mb-2">产品定位</div>
              <ul className="space-y-1.5">
                <li className="text-sm text-gray-600">企业智囊平台（非单纯合规工具）</li>
                <li className="text-sm text-gray-600">目标用户：40-50岁CIO高管</li>
                <li className="text-sm text-gray-600">类似 Gartner / McKinsey 智库服务</li>
              </ul>
            </div>
            <div>
              <div className="text-xs font-medium text-green-600 mb-2">设计原则</div>
              <ul className="space-y-1.5">
                <li className="text-sm text-gray-600">浅色/温暖背景（眼睛友好）</li>
                <li className="text-sm text-gray-600">权威感 + 科技前瞻感</li>
                <li className="text-sm text-gray-600">统一设计语言</li>
              </ul>
            </div>
          </div>
        </div>

        {/* New themes */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-lg font-bold text-gray-900">智库风格方案</h2>
            <span className="px-2 py-0.5 text-[10px] font-bold text-white bg-gradient-to-r from-blue-600 to-purple-600 rounded-md">
              推荐
            </span>
          </div>
          <p className="text-sm text-gray-500 mb-6">针对CIO高管智库定位设计，浅色友好、权威专业、科技前瞻</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {newThemes.map((theme) => (
              <ThemeCard key={theme.id} theme={theme} />
            ))}
          </div>
        </div>

        {/* Existing themes */}
        <div className="mb-12">
          <h2 className="text-lg font-bold text-gray-900 mb-2">其他方案</h2>
          <p className="text-sm text-gray-500 mb-6">之前的6种风格方案，包含深色和数据密集型选项</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {existingThemes.map((theme) => (
              <ThemeCard key={theme.id} theme={theme} />
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-200 bg-white mt-12">
        <div className="max-w-6xl mx-auto px-6 py-6 text-center">
          <p className="text-xs text-gray-400">
            展示页面完全独立于生产代码，选择方案后将以此风格重构整个系统
          </p>
        </div>
      </footer>
    </div>
  )
}

function ThemeCard({ theme }: { theme: typeof themes[number] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group">
      <div className="h-16 flex relative">
        {theme.colors.map((color, i) => (
          <div key={i} className="flex-1" style={{ backgroundColor: color }} />
        ))}
        {theme.isNew && (
          <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 text-[9px] font-bold text-white bg-gradient-to-r from-blue-600 to-purple-600 rounded">
            NEW
          </span>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between mb-1.5">
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <theme.icon className="w-3.5 h-3.5 text-gray-400" />
              <h3 className="text-sm font-bold text-gray-900">{theme.name}</h3>
            </div>
            <p className="text-[10px] text-gray-500">{theme.subtitle}</p>
          </div>
          <div className="text-right">
            <div className="text-[9px] text-gray-400">圆角</div>
            <div className="text-[11px] font-mono font-semibold text-gray-700">{theme.radius}</div>
          </div>
        </div>
        <p className="text-[11px] text-gray-600 leading-relaxed mb-2.5">{theme.description}</p>
        <div className="flex flex-wrap gap-1 mb-3">
          {theme.tags.map((tag) => (
            <span key={tag} className="px-1.5 py-0.5 bg-gray-50 text-gray-500 text-[9px] font-medium rounded border border-gray-200">
              {tag}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between text-[9px] text-gray-400 mb-3">
          <span>参考: {theme.reference}</span>
        </div>
        <Link
          href={`/design-showcase/${theme.id}`}
          className="inline-flex items-center gap-1.5 bg-gray-900 text-white px-3 py-1.5 text-[11px] font-medium rounded-lg hover:bg-gray-800 active:scale-[0.98] transition-all duration-200"
        >
          预览方案
          <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform duration-200" />
        </Link>
      </div>
    </div>
  )
}
