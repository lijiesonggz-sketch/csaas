'use client'

import React from 'react'
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

  const handleChange = (_event: React.SyntheticEvent, newValue: string) => {
    const step = steps.find((s) => s.id === newValue)
    if (step) {
      router.push(step.route)
    }
  }

  const getStatusColor = (status: Step['status']) => {
    switch (status) {
      case 'completed':
        return 'success'
      case 'processing':
        return 'primary'
      case 'failed':
        return 'error'
      default:
        return 'default'
    }
  }

  const getStatusLabel = (status: Step['status']) => {
    switch (status) {
      case 'completed':
        return '✓'
      case 'processing':
        return '⟳'
      case 'failed':
        return '✕'
      default:
        return ''
    }
  }

  // 从 pathname 提取当前步骤，如果不是有效的步骤ID，默认为 'upload'
  const getCurrentStepFromPath = () => {
    const pathSegment = pathname.split('/').pop()
    const validStepIds = steps.map(s => s.id)
    return validStepIds.includes(pathSegment || '') ? pathSegment : 'upload'
  }

  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
      <Tabs value={currentStep || getCurrentStepFromPath()} onChange={handleChange} variant="scrollable" scrollButtons="auto">
        {steps.map((step) => (
          <Tab
            key={step.id}
            value={step.id}
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Badge
                  badgeContent={getStatusLabel(step.status)}
                  color={getStatusColor(step.status) as any}
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
        ))}
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
    id: 'action-plan',
    name: '改进措施',
    icon: <TaskAlt fontSize="small" />,
    status: 'pending',
  },
]
