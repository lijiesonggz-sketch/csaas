'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Alert, Box, Button, CircularProgress, Paper, Stack, Typography } from '@mui/material'
import {
  OrganizationProfileCompleteness,
  OrganizationProfileCompletenessField,
} from '@/lib/types/organization'
import { organizationsApi } from '@/lib/api/organizations'

type ProfileCompletenessGateProps = {
  organizationId: string
  profileEditHref?: string
  flowLabel?: string
  children: React.ReactNode
}

function formatFieldIssue(field: OrganizationProfileCompletenessField): string {
  return field.reason === 'invalid' ? `${field.label}（值非法）` : field.label
}

export function ProfileCompletenessGate({
  organizationId,
  profileEditHref = `/organizations/${organizationId}/profile`,
  flowLabel = 'KG 流程',
  children,
}: ProfileCompletenessGateProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [completeness, setCompleteness] = useState<OrganizationProfileCompleteness | null>(null)

  const loadCompleteness = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await organizationsApi.getOrganizationProfileCompleteness(organizationId)
      setCompleteness(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载机构画像完成度失败'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [organizationId])

  useEffect(() => {
    void loadCompleteness()
  }, [loadCompleteness])

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (error) {
    return (
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Alert severity="error">{error}</Alert>
          <Box>
            <Button variant="contained" onClick={() => void loadCompleteness()}>
              重试
            </Button>
          </Box>
        </Stack>
      </Paper>
    )
  }

  if (!completeness) {
    return null
  }

  if (completeness.isComplete) {
    return <>{children}</>
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Alert severity="warning">
          当前机构画像未完成，暂时不能继续进入{flowLabel}。
        </Alert>

        <Typography variant="body1">
          完成度：{completeness.completionRatio}（已校验 {completeness.validFieldCount}/
          {completeness.totalRequiredFields} 个必填字段）
        </Typography>

        <Box>
          <Typography variant="subtitle1" gutterBottom>
            缺失或无效字段
          </Typography>
          <Box component="ul" sx={{ pl: 3, m: 0 }}>
            {completeness.missingFields.map((field) => (
              <li key={`${field.field}-${field.reason}`}>
                <Typography variant="body2">{formatFieldIssue(field)}</Typography>
              </li>
            ))}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button component={Link} href={profileEditHref} variant="contained">
            去补录机构画像
          </Button>
          <Button variant="outlined" onClick={() => void loadCompleteness()}>
            重新检查
          </Button>
        </Box>
      </Stack>
    </Paper>
  )
}
