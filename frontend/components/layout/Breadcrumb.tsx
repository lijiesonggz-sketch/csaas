'use client'

import React from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Breadcrumbs, Link, Typography, Chip, Box } from '@mui/material'
import NavigateNextIcon from '@mui/icons-material/NavigateNext'

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
    const pathSegments = pathname.split('/').filter(Boolean)

    // 构建面包屑数组
    const crumbs = [
      { label: '首页', path: '/' },
    ]

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
    <Box sx={{ py: 2 }}>
      <Breadcrumbs
        separator={<NavigateNextIcon fontSize="small" />}
        aria-label="breadcrumb"
      >
        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1

          if (isLast) {
            return (
              <Typography key={crumb.path} color="text.primary">
                {crumb.label}
              </Typography>
            )
          }

          return (
            <Link
              key={crumb.path}
              href={crumb.path}
              underline="hover"
              color="inherit"
              onClick={(e) => {
                e.preventDefault()
                router.push(crumb.path)
              }}
            >
              {crumb.label}
            </Link>
          )
        })}
      </Breadcrumbs>

      {/* 可选：显示组织名称 */}
      {organizationName && (
        <Box sx={{ mt: 1 }}>
          <Chip label={`组织: ${organizationName}`} size="small" variant="outlined" />
        </Box>
      )}
    </Box>
  )
}
