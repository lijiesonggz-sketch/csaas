'use client'

import React, { useMemo, useCallback, useState } from 'react'
import { Box, Tab, Tabs, Typography, Badge } from '@mui/material'
import { useRouter, usePathname } from 'next/navigation'
import {
  CloudUpload,
  Description,
  Category,
  GridOn,
  Assignment,
  TrendingUp,
  TaskAlt,
  MenuBook,
  Speed,
} from '@mui/icons-material'

interface Step {
  id: string
  name: string
  icon: React.ReactElement
  route: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
}

interface StepsTabNavigatorProps {
  projectId: string
  steps: Step[]
  currentStep?: string
}

export default function StepsTabNavigator({ projectId, steps, currentStep }: StepsTabNavigatorProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isNavigating, setIsNavigating] = useState(false)

  // 使用useMemo缓存当前步骤的判断
  const currentStepValue = useMemo(() => {
    if (currentStep) return currentStep
    const pathSegment = pathname.split('/').pop()
    const validStepIds = steps.map(s => s.id)
    return validStepIds.includes(pathSegment || '') ? pathSegment : 'upload'
  }, [currentStep, pathname, steps])

  // 使用useCallback缓存handleChange函数
  const handleChange = useCallback((_event: React.SyntheticEvent, newValue: string) => {
    if (isNavigating || newValue === currentStepValue) return // 避免重复导航

    const step = steps.find((s) => s.id === newValue)
    if (step) {
      setIsNavigating(true)
      // 使用replaceState避免触发完整的页面重新渲染
      router.push(step.route)
      // 延迟重置导航状态，确保切换动画完成
      setTimeout(() => setIsNavigating(false), 300)
    }
  }, [steps, currentStepValue, isNavigating, router])

  // 缓存状态相关的计算
  const stepBadges = useMemo(() => {
    const getStatusColor = (status: Step['status']) => {
      switch (status) {
        case 'completed': return 'success'
        case 'processing': return 'primary'
        case 'failed': return 'error'
        default: return 'default'
      }
    }

    const getStatusLabel = (status: Step['status']) => {
      switch (status) {
        case 'completed': return '✓'
        case 'processing': return '⟳'
        case 'failed': return '✕'
        default: return ''
      }
    }

    return steps.map(step => ({
      id: step.id,
      label: getStatusLabel(step.status),
      color: getStatusColor(step.status)
    }))
  }, [steps])

  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
      <Tabs
        value={currentStepValue}
        onChange={handleChange}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          // 优化过渡动画
          '& .MuiTab-root': {
            transition: 'all 0.2s ease-in-out',
            minWidth: 'auto',
          },
        }}
      >
        {steps.map((step, index) => {
          const badge = stepBadges[index]
          return (
            <Tab
              key={step.id}
              value={step.id}
              disabled={isNavigating}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Badge
                    badgeContent={badge.label}
                    color={badge.color as any}
                    sx={{
                      '& .MuiBadge-badge': {
                        fontSize: '0.7rem',
                        height: 16,
                        minWidth: 16,
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {step.icon}
                      <Typography variant="body2" component="span">
                        {step.name}
                      </Typography>
                    </Box>
                  </Badge>
                </Box>
              }
            />
          )
        })}
      </Tabs>
    </Box>
  )
}

// 默认步骤配置
export const DEFAULT_STEPS: Omit<Step, 'route'>[] = [
  {
    id: 'upload',
    name: '上传文档',
    icon: <CloudUpload fontSize="small" />,
    status: 'pending',
  },
  {
    id: 'summary',
    name: '综述生成',
    icon: <Description fontSize="small" />,
    status: 'pending',
  },
  {
    id: 'clustering',
    name: '聚类分析',
    icon: <Category fontSize="small" />,
    status: 'pending',
  },
  {
    id: 'standard-interpretation',
    name: '标准解读',
    icon: <MenuBook fontSize="small" />,
    status: 'pending',
  },
  {
    id: 'matrix',
    name: '成熟度矩阵',
    icon: <GridOn fontSize="small" />,
    status: 'pending',
  },
  {
    id: 'questionnaire',
    name: '问卷生成',
    icon: <Assignment fontSize="small" />,
    status: 'pending',
  },
  {
    id: 'gap-analysis',
    name: '差距分析',
    icon: <TrendingUp fontSize="small" />,
    status: 'pending',
  },
  {
    id: 'quick-gap-analysis',
    name: '超简版差距分析',
    icon: <Speed fontSize="small" />,
    status: 'pending',
  },
  {
    id: 'action-plan',
    name: '改进措施',
    icon: <TaskAlt fontSize="small" />,
    status: 'pending',
  },
]
