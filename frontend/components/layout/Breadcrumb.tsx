'use client'

import React from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Breadcrumb Navigation Component
 *
 * Epic 1 Story 1.4 - AC 7
 * 显示当前位置路径，例如："Dashboard / Radar Service / 技术雷达"
 *
 * @component Breadcrumb
 */
interface BreadcrumbProps {
  organizationName?: string
}

export default function Breadcrumb({ organizationName }: BreadcrumbProps) {
  const pathname = usePathname()
  const router = useRouter()

  // 解析路径为面包屑
  const breadcrumbs = React.useMemo(() => {
    const pathSegments = (pathname ?? '').split('/').filter(Boolean)

    // 构建面包屑数组
    const crumbs = [{ label: '首页', path: '/' }]

    let currentPath = ''

    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`

      // 根据路径段生成标签
      let label = segment
      if (segment === 'projects') {
        label = '标准评估'
      } else if (segment === 'radar') {
        label = 'Radar Service'
      } else if (segment === 'tech') {
        label = '技术雷达'
      } else if (segment === 'industry') {
        label = '行业雷达'
      } else if (segment === 'compliance') {
        label = '合规雷达'
      } else if (segment === 'reports') {
        label = '报告中心'
      }

      crumbs.push({
        label,
        path: currentPath,
      })
    })

    return crumbs
  }, [pathname])

  if (breadcrumbs.length <= 1) {
    return null // 不显示首页的面包屑
  }

  return (
    <div className="py-2">
      <nav aria-label="breadcrumb" className="flex items-center gap-1 text-sm">
        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1

          if (isLast) {
            return (
              <span key={crumb.path} className="text-[#1E3A5F] font-medium">
                {crumb.label}
              </span>
            )
          }

          return (
            <React.Fragment key={crumb.path}>
              <button
                onClick={() => router.push(crumb.path)}
                className="text-[#64748B] hover:text-[#1E3A5F] transition-colors duration-200"
              >
                {crumb.label}
              </button>
              <ChevronRight className="h-4 w-4 text-[#94A3B8]" />
            </React.Fragment>
          )
        })}
      </nav>

      {/* 可选：显示组织名称 */}
      {organizationName && (
        <div className="mt-1">
          <span className="inline-flex items-center px-2 py-1 rounded-sm text-xs font-medium border border-[#E2E8F0] bg-[#FEFDFB] text-[#1E3A5F]">
            组织: {organizationName}
          </span>
        </div>
      )}
    </div>
  )
}
