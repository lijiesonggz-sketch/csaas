'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  LayoutDashboard,
  FolderOpen,
  FileText,
  Settings,
  Users,
  Radar,
  Building2,
  ClipboardCheck,
  GitBranch,
  Scale,
  Target,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
} from 'lucide-react'

interface MenuItem {
  key: string
  icon: React.ReactNode
  label: string
  children?: MenuItem[]
  adminOnly?: boolean
  requiresOrganization?: boolean
}

const allMenuItems: MenuItem[] = [
  {
    key: '/dashboard',
    icon: <LayoutDashboard className="w-5 h-5" />,
    label: '工作台',
  },
  {
    key: '/projects',
    icon: <FolderOpen className="w-5 h-5" />,
    label: '项目管理',
  },
  {
    key: '/organizations/profile',
    icon: <Building2 className="w-5 h-5" />,
    label: '机构画像',
    requiresOrganization: true,
  },
  {
    key: '/organizations/applicable-controls',
    icon: <ClipboardCheck className="w-5 h-5" />,
    label: '适用控制点',
    requiresOrganization: true,
  },
  {
    key: '/radar',
    icon: <Radar className="w-5 h-5" />,
    label: '技术雷达',
  },
  {
    key: '/reports',
    icon: <FileText className="w-5 h-5" />,
    label: '报告中心',
  },
  {
    key: '/team',
    icon: <Users className="w-5 h-5" />,
    label: '团队管理',
  },
  {
    key: '/admin',
    icon: <Settings className="w-5 h-5" />,
    label: '系统管理',
    adminOnly: true,
    children: [
      {
        key: '/admin/dashboard',
        icon: <LayoutDashboard className="w-4 h-4" />,
        label: '运营仪表板',
      },
      {
        key: '/admin/content-quality',
        icon: <FileText className="w-4 h-4" />,
        label: '内容质量管理',
      },
      { key: '/admin/clients', icon: <Users className="w-4 h-4" />, label: '客户管理' },
      {
        key: '/admin/cost-optimization',
        icon: <Settings className="w-4 h-4" />,
        label: '成本优化',
      },
      { key: '/admin/branding', icon: <Settings className="w-4 h-4" />, label: '品牌配置' },
      { key: '/admin/radar-sources', icon: <Radar className="w-4 h-4" />, label: '信息源配置' },
      { key: '/admin/raw-contents', icon: <FileText className="w-4 h-4" />, label: '文件导入管理' },
      {
        key: '/admin/compliance-cases',
        icon: <ClipboardCheck className="w-4 h-4" />,
        label: '案例运营',
      },
      {
        key: '/admin/failure-modes',
        icon: <GitBranch className="w-4 h-4" />,
        label: 'Failure Mode 管理',
      },
      {
        key: '/admin/obligations',
        icon: <Scale className="w-4 h-4" />,
        label: 'Obligation 管理',
      },
      {
        key: '/admin/control-points',
        icon: <Target className="w-4 h-4" />,
        label: 'Control Point 管理',
      },
      {
        key: '/admin/obligations/coverage-analysis',
        icon: <BarChart3 className="w-4 h-4" />,
        label: '覆盖率分析',
      },
      {
        key: '/admin/knowledge-graph',
        icon: <GitBranch className="w-4 h-4" />,
        label: '知识图谱总览',
      },
      { key: '/admin/peer-crawler', icon: <Settings className="w-4 h-4" />, label: '同业爬虫管理' },
      {
        key: '/admin/peer-crawler/health',
        icon: <Settings className="w-4 h-4" />,
        label: '爬虫健康监控',
      },
    ],
  },
]

export const SIDEBAR_WIDTH = 200
export const SIDEBAR_COLLAPSED_WIDTH = 64

interface SidebarProps {
  collapsed?: boolean
  onCollapseChange?: (collapsed: boolean) => void
  width?: number
  collapsedWidth?: number
  isMobile?: boolean
  mobileOpen?: boolean
  onNavigateComplete?: () => void
}

export default function Sidebar({
  collapsed = false,
  onCollapseChange,
  width = SIDEBAR_WIDTH,
  collapsedWidth = SIDEBAR_COLLAPSED_WIDTH,
  isMobile = false,
  mobileOpen = false,
  onNavigateComplete,
}: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()
  const [expandedKeys, setExpandedKeys] = useState<string[]>(['/admin'])
  const organizationId = session?.user?.organizationId

  const isAdmin = session?.user?.role === 'admin'
  const visibleMenuItems = allMenuItems.filter((item) => {
    if (item.adminOnly && !isAdmin) return false
    if (item.requiresOrganization && !organizationId) return false
    return true
  })

  const handleToggleCollapse = () => {
    onCollapseChange?.(!collapsed)
  }

  const handleExpandToggle = (key: string) => {
    setExpandedKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  const handleNavigation = async (key: string) => {
    if (key === '/organizations/profile') {
      if (organizationId) {
        router.push(`/organizations/${organizationId}/profile`)
        onNavigateComplete?.()
      }
      return
    }

    if (key === '/organizations/applicable-controls') {
      if (organizationId) {
        router.push(`/organizations/${organizationId}/applicable-controls`)
        onNavigateComplete?.()
      }
      return
    }

    if (key === '/radar') {
      try {
        const response = await fetch('/api/organizations/me')
        if (response.ok) {
          const data = await response.json()
          const orgId = data.data?.organization?.id
          if (orgId) {
            router.push(`/radar?orgId=${orgId}`)
            onNavigateComplete?.()
            return
          }
        }
      } catch (error) {
        console.error('[Sidebar] Failed to get organization:', error)
      }
      router.push('/radar')
      onNavigateComplete?.()
    } else {
      router.push(key)
      onNavigateComplete?.()
    }
  }

  const isSelected = (key: string) => {
    if (key === '/organizations/profile') {
      return pathname.startsWith('/organizations/') && pathname.endsWith('/profile')
    }
    if (key === '/organizations/applicable-controls') {
      return pathname.startsWith('/organizations/') && pathname.endsWith('/applicable-controls')
    }
    return pathname === key || pathname.startsWith(`${key}/`)
  }

  const currentWidth = isMobile ? width : collapsed ? collapsedWidth : width

  return (
    <nav
      className={`fixed left-0 top-16 bottom-0 bg-[#1E3A5F] text-white transition-all duration-200 overflow-x-hidden overflow-y-auto z-40 ${
        isMobile ? (mobileOpen ? 'translate-x-0' : '-translate-x-full') : 'translate-x-0'
      }`}
      style={{ width: `${currentWidth}px` }}
    >
      <div className="flex flex-col h-full">
        {/* Menu items */}
        <div className="flex-1 pt-2">
          {visibleMenuItems.map((item) => {
            const hasChildren = item.children && item.children.length > 0
            const selected = isSelected(item.key)
            const expanded = expandedKeys.includes(item.key)

            if (hasChildren) {
              return (
                <div key={item.key}>
                  <button
                    onClick={() => handleExpandToggle(item.key)}
                    className={`w-full flex items-center gap-3 px-5 py-3 text-sm transition-colors ${
                      selected
                        ? 'bg-white/10 text-white font-semibold'
                        : 'text-white/70 hover:bg-white/5 hover:text-white'
                    } ${collapsed ? 'justify-center px-0' : ''}`}
                    title={collapsed ? item.label : undefined}
                  >
                    <span className={selected ? 'text-emerald-400' : 'text-white/60'}>
                      {item.icon}
                    </span>
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left">{item.label}</span>
                        {expanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </>
                    )}
                  </button>
                  {!collapsed && expanded && (
                    <div>
                      {item.children!.map((child) => (
                        <button
                          key={child.key}
                          onClick={() => handleNavigation(child.key)}
                          className={`w-full flex items-center gap-2 pl-12 pr-5 py-2.5 text-[13px] transition-colors ${
                            pathname === child.key
                              ? 'text-emerald-400 font-medium bg-white/5'
                              : 'text-white/60 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          <span className="text-white/40">{child.icon}</span>
                          <span>{child.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            }

            return (
              <button
                key={item.key}
                onClick={() => handleNavigation(item.key)}
                className={`w-full flex items-center gap-3 px-5 py-3 text-sm transition-colors ${
                  selected
                    ? 'bg-white/10 text-white font-semibold border-l-2 border-emerald-400'
                    : 'text-white/70 hover:bg-white/5 hover:text-white'
                } ${collapsed ? 'justify-center px-0' : ''}`}
                title={collapsed ? item.label : undefined}
              >
                <span className={selected ? 'text-emerald-400' : 'text-white/60'}>{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </button>
            )
          })}
        </div>

        {/* Collapse toggle */}
        {!isMobile && (
          <div className="p-2 border-t border-white/10">
            <button
              onClick={handleToggleCollapse}
              className="w-full flex items-center justify-center py-2 text-white/60 hover:text-white transition-colors"
            >
              {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}
