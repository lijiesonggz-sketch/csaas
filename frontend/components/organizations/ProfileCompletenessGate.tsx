'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 text-[#1E3A5F] animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border border-[#E2E8F0] rounded-sm">
        <CardContent className="p-6 space-y-4">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button onClick={() => void loadCompleteness()} className="rounded-sm bg-[#1E3A5F] hover:bg-[#162e4d]">
            重试
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!completeness) {
    return null
  }

  if (completeness.isComplete) {
    return <>{children}</>
  }

  return (
    <Card className="border border-[#E2E8F0] rounded-sm">
      <CardContent className="p-6 space-y-4">
        <Alert className="border-amber-200 bg-amber-50">
          <AlertDescription className="text-amber-800">
            当前机构画像未完成，暂时不能继续进入{flowLabel}。
          </AlertDescription>
        </Alert>

        <p className="text-sm text-[#1E3A5F]">
          完成度：{completeness.completionRatio}（已校验 {completeness.validFieldCount}/
          {completeness.totalRequiredFields} 个必填字段）
        </p>

        <div>
          <p className="text-sm font-semibold text-[#1E3A5F] mb-2">
            缺失或无效字段
          </p>
          <ul className="pl-5 m-0 space-y-1">
            {completeness.missingFields.map((field) => (
              <li key={`${field.field}-${field.reason}`} className="text-sm text-[#64748B]">
                {formatFieldIssue(field)}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex gap-3">
          <Link href={profileEditHref}>
            <Button className="rounded-sm bg-[#1E3A5F] hover:bg-[#162e4d]">
              去补录机构画像
            </Button>
          </Link>
          <Button variant="outline" onClick={() => void loadCompleteness()} className="rounded-sm">
            重新检查
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
