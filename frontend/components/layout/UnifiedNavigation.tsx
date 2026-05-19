'use client'

import React from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Home, FileText, Radar, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Unified Navigation Component
 *
 * Epic 1 Story 1.4 - AC 7
 * 统一顶部导航：Dashboard | 标准评估 | Radar Service | 报告中心
 *
 * @component UnifiedNavigation
 */
interface UnifiedNavigationProps {
  organizationId?: string
}

export default function UnifiedNavigation({ organizationId }: UnifiedNavigationProps) {
  const router = useRouter()
  const pathname = usePathname()

  // 定义导航项映射
  const navItems = [
    { label: 'Dashboard', path: '/', icon: Home, value: '/' },
    { label: '标准评估', path: '/projects', icon: BarChart3, value: '/projects' },
    { label: 'Radar Service', path: '/radar', icon: Radar, value: '/radar' },
    { label: '报告中心', path: '/reports', icon: FileText, value: '/reports' },
  ]

  // 确定当前激活的标签
  const getActiveTab = () => {
    const currentPathname = pathname ?? ''
    // Radar子页面都应该激活Radar标签
    if (currentPathname.startsWith('/radar')) {
      return 2 // Radar Service的索引
    }
    // 项目子页面应该激活标准评估标签
    if (currentPathname.startsWith('/projects')) {
      return 1 // 标准评估的索引
    }
    // Dashboard或根路径
    if (currentPathname === '/' || currentPathname === '') {
      return 0 // Dashboard的索引
    }
    return 0
  }

  const handleTabChange = (path: string) => {
    if (organizationId && path === '/radar') {
      // Radar页面需要orgId参数
      router.push(`${path}?orgId=${organizationId}`)
    } else {
      router.push(path)
    }
  }

  return (
    <div className="border-b border-[#E2E8F0] bg-[#FEFDFB]">
      <div className="max-w-[1400px] mx-auto px-2">
        <div className="flex items-center h-16">
          {navItems.map((item) => {
            const isActive =
              getActiveTab() === navItems.findIndex((nav) => nav.value === item.value)
            const Icon = item.icon

            return (
              <button
                key={item.value}
                onClick={() => handleTabChange(item.path)}
                className={cn(
                  'flex items-center gap-2 px-4 h-16 text-sm font-medium transition-all duration-200 border-b-2',
                  'hover:text-[#1E3A5F] hover:bg-[#F1F5F9]',
                  isActive
                    ? 'text-[#059669] border-[#059669] bg-[#F0FDFA]'
                    : 'text-[#64748B] border-transparent'
                )}
              >
                <Icon className={cn('h-4 w-4', isActive && 'text-[#059669]')} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
