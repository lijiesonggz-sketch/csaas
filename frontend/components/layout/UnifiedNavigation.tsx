'use client'

import React from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Box, Tabs, Tab, Button } from '@mui/material'
import { Home, Assessment, Radar, Description } from '@mui/icons-material'

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
    { label: 'Dashboard', path: '/', icon: <Home />, value: '/' },
    { label: '标准评估', path: '/projects', icon: <Assessment />, value: '/projects' },
    { label: 'Radar Service', path: '/radar', icon: <Radar />, value: '/radar' },
    { label: '报告中心', path: '/reports', icon: <Description />, value: '/reports' },
  ]

  // 确定当前激活的标签
  const getActiveTab = () => {
    // Radar子页面都应该激活Radar标签
    if (pathname.startsWith('/radar')) {
      return 2 // Radar Service的索引
    }
    // 项目子页面应该激活标准评估标签
    if (pathname.startsWith('/projects')) {
      return 1 // 标准评估的索引
    }
    // Dashboard或根路径
    if (pathname === '/' || pathname === '') {
      return 0 // Dashboard的索引
    }
    return 0
  }

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    const route = navItems[newValue].path
    if (organizationId && newValue === 2) {
      // Radar页面需要orgId参数
      router.push(`${route}?orgId=${organizationId}`)
    } else {
      router.push(route)
    }
  }

  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
      <Box sx={{ maxWidth: 1400, mx: 'auto', px: 2 }}>
        <Tabs
          value={getActiveTab()}
          onChange={handleTabChange}
          aria-label="unified navigation tabs"
          variant="scrollable"
          scrollButtons="auto"
          sx={{ minHeight: 64 }}
        >
          {navItems.map((item) => (
            <Tab
              key={item.value}
              icon={item.icon}
              label={item.label}
              value={item.value}
              sx={{ minHeight: 64 }}
            />
          ))}
        </Tabs>
      </Box>
    </Box>
  )
}
