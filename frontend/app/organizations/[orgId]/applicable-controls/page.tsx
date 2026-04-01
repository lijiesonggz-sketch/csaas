'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { AlertCircle, CheckCircle2, Info, Loader2, AlertTriangle } from 'lucide-react'
import { resolveControls, ResolveControlsResponse, ResolvedControl } from '@/lib/api/applicability-engine'
import { organizationsApi } from '@/lib/api/organizations'
import { ProfileCompletenessGate } from '@/components/organizations/ProfileCompletenessGate'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

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
      <div className="flex justify-center py-8 bg-[#FEFDFB]">
        <Loader2 className="w-8 h-8 animate-spin text-[#1E3A5F]" />
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-[#E2E8F0] rounded-sm shadow-sm">
        <CardContent className="p-6 space-y-4">
          <Alert variant="destructive" className="rounded-sm">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button
            onClick={() => void loadResult()}
            className="bg-[#1E3A5F] hover:bg-[#162e4d] text-white rounded-sm"
          >
            重试
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!result) {
    return null
  }

  return (
    <div className="space-y-6">
      {shouldShowFreshnessWarning && (
        <Alert className="rounded-sm border-yellow-600 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            画像刚更新，结果可能需要刷新。
            <Button
              onClick={() => void loadResult()}
              size="sm"
              variant="link"
              className="text-yellow-800 underline ml-2 h-auto p-0"
            >
              手动刷新
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* 解析摘要 */}
      <Card className="border-[#E2E8F0] rounded-sm shadow-sm">
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold text-[#1E3A5F] font-[var(--font-plus-jakarta)]">
            解析摘要
          </h2>
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-[#1E3A5F] text-white rounded-sm">
              控制点 {result.summary.totalControls}
            </Badge>
            <Badge variant="outline" className="rounded-sm border-[#94A3B8] text-[#94A3B8]">
              强制 {result.summary.mandatoryCount}
            </Badge>
            <Badge variant="outline" className="rounded-sm border-[#059669] text-[#059669]">
              命中包 {result.summary.matchedPacks}
            </Badge>
            <Badge variant="outline" className="rounded-sm border-[#94A3B8] text-[#94A3B8]">
              命中规则 {result.summary.matchedRules}
            </Badge>
          </div>
          <p className="text-sm text-[#94A3B8]">
            关键画像字段：{result.influencingProfileFields.length > 0 ? result.influencingProfileFields.join('、') : '无'}
          </p>
        </CardContent>
      </Card>

      {/* 筛选浏览 */}
      <Card className="border-[#E2E8F0] rounded-sm shadow-sm">
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold text-[#1E3A5F] font-[var(--font-plus-jakarta)]">
            筛选浏览
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pack-filter" className="text-[#1E3A5F]">按控制包筛选</Label>
              <Select value={packFilter} onValueChange={setPackFilter}>
                <SelectTrigger className="rounded-sm" id="pack-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availablePacks.map((pack) => (
                    <SelectItem key={pack} value={pack}>
                      {pack === 'all' ? '全部控制包' : pack}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mandatory-filter" className="text-[#1E3A5F]">按 mandatory 筛选</Label>
              <Select value={mandatoryFilter} onValueChange={(v) => setMandatoryFilter(v as typeof mandatoryFilter)}>
                <SelectTrigger className="rounded-sm" id="mandatory-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="mandatory">仅强制</SelectItem>
                  <SelectItem value="optional">仅可选</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority-filter" className="text-[#1E3A5F]">按 priority 筛选</Label>
              <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as typeof priorityFilter)}>
                <SelectTrigger className="rounded-sm" id="priority-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="HIGH">HIGH</SelectItem>
                  <SelectItem value="MEDIUM">MEDIUM</SelectItem>
                  <SelectItem value="LOW">LOW</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 控制点列表 */}
      {filteredControls.length === 0 ? (
        <Card className="border-[#E2E8F0] rounded-sm shadow-sm">
          <CardContent className="p-6">
            <Alert className="rounded-sm border-[#94A3B8] bg-[#F8FAFC]">
              <Info className="h-4 w-4 text-[#94A3B8]" />
              <AlertDescription className="text-[#94A3B8]">
                当前机构没有命中可展示的适用控制点，或当前筛选条件下没有结果。
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredControls.map((control) => {
            const fields = getControlFields(control, ruleFieldMap)

            return (
              <Card key={control.controlId} className="border-[#E2E8F0] rounded-sm shadow-sm">
                <CardContent className="p-6 space-y-4">
                  {/* 标题和基本信息 */}
                  <div>
                    <h3 className="text-lg font-semibold text-[#1E3A5F] font-[var(--font-plus-jakarta)]">
                      {control.controlCode} {control.controlName}
                    </h3>
                    <p className="text-sm text-[#94A3B8]">
                      控制族：{control.controlFamily}
                    </p>
                  </div>

                  {/* 标签 */}
                  <div className="flex flex-wrap gap-2">
                    <Badge className="bg-[#1E3A5F] text-white rounded-sm">
                      Priority {control.priority}
                    </Badge>
                    <Badge
                      variant={control.mandatory ? 'default' : 'secondary'}
                      className={
                        control.mandatory
                          ? 'bg-yellow-600 text-white rounded-sm'
                          : 'bg-[#94A3B8] text-white rounded-sm'
                      }
                    >
                      {control.mandatory ? 'Mandatory' : 'Optional'}
                    </Badge>
                    {control.matchedPacks.map((pack) => (
                      <Badge key={pack} variant="outline" className="rounded-sm border-[#059669] text-[#059669]">
                        {pack}
                      </Badge>
                    ))}
                  </div>

                  <div className="h-px bg-[#E2E8F0]" />

                  {/* 命中原因 */}
                  <div>
                    <h4 className="text-sm font-semibold text-[#1E3A5F] mb-2">命中原因</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {control.reasons.map((reason) => (
                        <li key={reason} className="text-sm text-[#94A3B8]">
                          {reason}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* 规则与来源 */}
                  <div>
                    <h4 className="text-sm font-semibold text-[#1E3A5F] mb-2">规则与来源</h4>
                    <p className="text-sm text-[#94A3B8]">
                      规则：{control.matchedRules.join('、') || '无'}
                    </p>
                    <p className="text-sm text-[#94A3B8]">
                      控制包：{control.matchedPacks.join('、') || '无'}
                    </p>
                    <p className="text-sm text-[#94A3B8]">
                      关键画像字段：{fields.length > 0 ? fields.join('、') : '无'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function ApplicableControlsPage() {
  const params = useParams<{ orgId: string }>()
  const organizationId = typeof params?.orgId === 'string' ? params.orgId : ''

  return (
    <div className="p-6 bg-[#FEFDFB] min-h-screen">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-[#1E3A5F] font-[var(--font-plus-jakarta)]">
            适用控制点解析结果
          </h1>
          <p className="text-[#94A3B8] mt-1">
            查看当前机构命中的控制包、控制点、优先级与适用原因。
          </p>
        </div>

        <ProfileCompletenessGate
          organizationId={organizationId}
          flowLabel="适用控制点解析"
          profileEditHref={`/organizations/${organizationId}/profile`}
        >
          <ApplicableControlsResult organizationId={organizationId} />
        </ProfileCompletenessGate>
      </div>
    </div>
  )
}
