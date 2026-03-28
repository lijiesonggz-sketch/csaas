'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { resolveControls, ResolveControlsResponse, ResolvedControl } from '@/lib/api/applicability-engine'
import { organizationsApi } from '@/lib/api/organizations'
import { ProfileCompletenessGate } from '@/components/organizations/ProfileCompletenessGate'

const FRESH_PROFILE_WINDOW_MS = 5 * 60 * 1000

type RuleFieldMap = Record<string, string[]>

function buildRuleFieldMap(result: ResolveControlsResponse): RuleFieldMap {
  return result.debugLog.reduce<RuleFieldMap>((acc, entry) => {
    const fields = entry.traceEntries
      .filter((trace) => trace.matched && Boolean(trace.field))
      .map((trace) => trace.field)

    acc[entry.ruleCode] = Array.from(new Set(fields))
    return acc
  }, {})
}

function getControlFields(control: ResolvedControl, ruleFieldMap: RuleFieldMap): string[] {
  return Array.from(
    new Set(control.matchedRules.flatMap((ruleCode) => ruleFieldMap[ruleCode] ?? [])),
  )
}

function ApplicableControlsResult({ organizationId }: { organizationId: string }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ResolveControlsResponse | null>(null)
  const [profileUpdatedAt, setProfileUpdatedAt] = useState<string | null>(null)
  const [packFilter, setPackFilter] = useState('all')
  const [mandatoryFilter, setMandatoryFilter] = useState<'all' | 'mandatory' | 'optional'>('all')
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'HIGH' | 'MEDIUM' | 'LOW'>('all')

  const loadResult = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const [profile, resolveResult] = await Promise.all([
        organizationsApi.getOrganizationProfile(organizationId),
        resolveControls({
          organizationId,
          scene: 'quick-gap-analysis',
        }),
      ])

      setProfileUpdatedAt(profile.updatedAt)
      setResult(resolveResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载适用控制点结果失败')
    } finally {
      setLoading(false)
    }
  }, [organizationId])

  useEffect(() => {
    void loadResult()
  }, [loadResult])

  const availablePacks = useMemo(
    () => (result ? ['all', ...result.matchedPacks] : ['all']),
    [result],
  )

  const filteredControls = useMemo(() => {
    if (!result) {
      return []
    }

    return result.controls.filter((control) => {
      if (packFilter !== 'all' && !control.matchedPacks.includes(packFilter)) {
        return false
      }

      if (mandatoryFilter === 'mandatory' && !control.mandatory) {
        return false
      }

      if (mandatoryFilter === 'optional' && control.mandatory) {
        return false
      }

      if (priorityFilter !== 'all' && control.priority !== priorityFilter) {
        return false
      }

      return true
    })
  }, [mandatoryFilter, packFilter, priorityFilter, result])

  const ruleFieldMap = useMemo(() => (result ? buildRuleFieldMap(result) : {}), [result])

  const shouldShowFreshnessWarning = Boolean(
    profileUpdatedAt &&
      Date.now() - new Date(profileUpdatedAt).getTime() <= FRESH_PROFILE_WINDOW_MS,
  )

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
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
            <Button variant="contained" onClick={() => void loadResult()}>
              重试
            </Button>
          </Box>
        </Stack>
      </Paper>
    )
  }

  if (!result) {
    return null
  }

  return (
    <Stack spacing={3}>
      {shouldShowFreshnessWarning && (
        <Alert severity="warning">
          画像刚更新，结果可能需要刷新。
          <Button onClick={() => void loadResult()} size="small" sx={{ ml: 2 }}>
            手动刷新
          </Button>
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h6">解析摘要</Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip label={`控制点 ${result.summary.totalControls}`} color="primary" />
            <Chip label={`强制 ${result.summary.mandatoryCount}`} />
            <Chip label={`命中包 ${result.summary.matchedPacks}`} />
            <Chip label={`命中规则 ${result.summary.matchedRules}`} />
          </Box>
          <Typography variant="body2" color="text.secondary">
            关键画像字段：{result.influencingProfileFields.length > 0 ? result.influencingProfileFields.join('、') : '无'}
          </Typography>
        </Stack>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h6">筛选浏览</Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
              gap: 2,
            }}
          >
            <TextField
              select
              label="按控制包筛选"
              value={packFilter}
              onChange={(event) => setPackFilter(event.target.value)}
              InputLabelProps={{ shrink: true }}
              SelectProps={{ displayEmpty: true }}
            >
              {availablePacks.map((pack) => (
                <MenuItem key={pack} value={pack}>
                  {pack === 'all' ? '全部控制包' : pack}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="按 mandatory 筛选"
              value={mandatoryFilter}
              onChange={(event) => setMandatoryFilter(event.target.value as typeof mandatoryFilter)}
              InputLabelProps={{ shrink: true }}
              SelectProps={{ displayEmpty: true }}
            >
              <MenuItem value="all">全部</MenuItem>
              <MenuItem value="mandatory">仅强制</MenuItem>
              <MenuItem value="optional">仅可选</MenuItem>
            </TextField>
            <TextField
              select
              label="按 priority 筛选"
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value as typeof priorityFilter)}
              InputLabelProps={{ shrink: true }}
              SelectProps={{ displayEmpty: true }}
            >
              <MenuItem value="all">全部</MenuItem>
              <MenuItem value="HIGH">HIGH</MenuItem>
              <MenuItem value="MEDIUM">MEDIUM</MenuItem>
              <MenuItem value="LOW">LOW</MenuItem>
            </TextField>
          </Box>
        </Stack>
      </Paper>

      {filteredControls.length === 0 ? (
        <Paper sx={{ p: 4 }}>
          <Alert severity="info">
            当前机构没有命中可展示的适用控制点，或当前筛选条件下没有结果。
          </Alert>
        </Paper>
      ) : (
        <Stack spacing={2}>
          {filteredControls.map((control) => {
            const fields = getControlFields(control, ruleFieldMap)

            return (
              <Paper key={control.controlId} sx={{ p: 3 }}>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="h6">
                      {control.controlCode} {control.controlName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      控制族：{control.controlFamily}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Chip label={`Priority ${control.priority}`} color="primary" />
                    <Chip
                      label={control.mandatory ? 'Mandatory' : 'Optional'}
                      color={control.mandatory ? 'warning' : 'default'}
                    />
                    {control.matchedPacks.map((pack) => (
                      <Chip key={pack} label={pack} variant="outlined" />
                    ))}
                  </Box>

                  <Divider />

                  <Typography variant="subtitle2">命中原因</Typography>
                  <Box component="ul" sx={{ pl: 3, m: 0 }}>
                    {control.reasons.map((reason) => (
                      <li key={reason}>
                        <Typography variant="body2">{reason}</Typography>
                      </li>
                    ))}
                  </Box>

                  <Typography variant="subtitle2">规则与来源</Typography>
                  <Typography variant="body2">
                    规则：{control.matchedRules.join('、') || '无'}
                  </Typography>
                  <Typography variant="body2">
                    控制包：{control.matchedPacks.join('、') || '无'}
                  </Typography>
                  <Typography variant="body2">
                    关键画像字段：{fields.length > 0 ? fields.join('、') : '无'}
                  </Typography>
                </Stack>
              </Paper>
            )
          })}
        </Stack>
      )}
    </Stack>
  )
}

export default function ApplicableControlsPage() {
  const params = useParams<{ orgId: string }>()
  const organizationId = typeof params?.orgId === 'string' ? params.orgId : ''

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            适用控制点解析结果
          </Typography>
          <Typography variant="body1" color="text.secondary">
            查看当前机构命中的控制包、控制点、优先级与适用原因。
          </Typography>
        </Box>

        <ProfileCompletenessGate
          organizationId={organizationId}
          flowLabel="适用控制点解析"
          profileEditHref={`/organizations/${organizationId}/profile`}
        >
          <ApplicableControlsResult organizationId={organizationId} />
        </ProfileCompletenessGate>
      </Stack>
    </Box>
  )
}
