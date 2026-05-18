'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, BrainCircuit, Loader2, Save } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { UserRole } from '@/lib/auth/types'
import {
  AdvisoryModuleConfig,
  THINKTANK_AUDIT_DELAY_MESSAGE,
  THINKTANK_PRIVACY_CONFIRMATION,
  THINKTANK_ROLE_LABELS,
  THINKTANK_ROLE_ORDER,
  fetchAdvisoryModuleConfig,
  updateAdvisoryModuleConfig,
} from '@/lib/advisory/admin-config'
import { THINKTANK_MODULE_DISABLED_MESSAGE } from '@/lib/advisory/access'

export default function AdvisoryAdminPage() {
  const [config, setConfig] = useState<AdvisoryModuleConfig | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [allowedRoles, setAllowedRoles] = useState<UserRole[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [disableDialogOpen, setDisableDialogOpen] = useState(false)

  useEffect(() => {
    let active = true

    fetchAdvisoryModuleConfig()
      .then((loadedConfig) => {
        if (!active) return
        applyConfig(loadedConfig)
      })
      .catch((loadError) => {
        if (!active) return
        setError(loadError instanceof Error ? loadError.message : '暂时无法加载 ThinkTank 配置。')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const roleSet = useMemo(() => new Set(allowedRoles), [allowedRoles])
  const hasAuditSummary = Boolean(config?.latestAuditSummary?.length)

  const applyConfig = (nextConfig: AdvisoryModuleConfig) => {
    setConfig(nextConfig)
    setEnabled(nextConfig.enabled)
    setAllowedRoles(nextConfig.allowedRoles)
    setError(null)
  }

  const handleRoleChange = (role: UserRole, checked: boolean) => {
    setAllowedRoles((current) => {
      const next = new Set(current)
      if (checked) next.add(role)
      else next.delete(role)
      return THINKTANK_ROLE_ORDER.filter((item) => next.has(item))
    })
  }

  const saveConfig = async (nextEnabled = enabled) => {
    setSaving(true)
    setError(null)
    try {
      const updated = await updateAdvisoryModuleConfig({
        enabled: nextEnabled,
        allowedRoles,
        dataRetentionDays: 90,
        privacyConfirmed: true,
      })
      applyConfig(updated)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '暂时无法保存 ThinkTank 配置。')
    } finally {
      setSaving(false)
    }
  }

  const handleEnabledChange = (checked: boolean) => {
    if (!checked && enabled) {
      setDisableDialogOpen(true)
      return
    }
    setEnabled(checked)
  }

  const confirmDisable = async () => {
    setDisableDialogOpen(false)
    setEnabled(false)
    await saveConfig(false)
  }

  if (loading) {
    return (
      <section className="bg-[#FEFDFB] px-6 py-8">
        <div role="status" className="flex items-center gap-3 text-sm font-medium text-[#1E3A5F]">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
          <span>正在加载 ThinkTank 配置</span>
        </div>
      </section>
    )
  }

  return (
    <section className="bg-[#FEFDFB] px-6 py-8 text-[#1E3A5F]">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <BrainCircuit className="h-6 w-6 text-emerald-600" />
              <h1 className="text-2xl font-semibold">ThinkTank 配置</h1>
            </div>
            <p className="mt-2 text-sm text-[#64748B]">
              管理租户级模块启用、CSAAS 角色绑定和控制面审计状态。
            </p>
          </div>
          <Button type="button" onClick={() => saveConfig()} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            保存配置
          </Button>
        </div>

        {error && (
          <Alert variant="destructive" role="alert">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <Card variant="outlined" className="bg-white">
            <CardHeader>
              <CardTitle>模块状态</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label htmlFor="thinktank-enabled" className="text-sm font-medium">
                    启用 ThinkTank
                  </Label>
                  <p className="mt-1 text-sm text-[#64748B]">
                    关闭后，本租户所有用户都会看到停用说明。
                  </p>
                </div>
                <Switch
                  id="thinktank-enabled"
                  aria-label="启用 ThinkTank"
                  checked={enabled}
                  onCheckedChange={handleEnabledChange}
                />
              </div>
              <div className="rounded-sm border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                数据保留策略：<span className="font-semibold">90 天</span>
              </div>
              <div className="rounded-sm border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {THINKTANK_PRIVACY_CONFIRMATION}
              </div>
            </CardContent>
          </Card>

          <Card variant="outlined" className="bg-white">
            <CardHeader>
              <CardTitle>角色访问</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {THINKTANK_ROLE_ORDER.map((role) => (
                  <div key={role} className="flex items-center gap-2">
                    <Checkbox
                      id={`thinktank-role-${role}`}
                      checked={roleSet.has(role)}
                      onCheckedChange={(checked) => handleRoleChange(role, checked === true)}
                    />
                    <Label htmlFor={`thinktank-role-${role}`} className="text-sm">
                      {THINKTANK_ROLE_LABELS[role]}
                    </Label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card variant="outlined" className="bg-white">
          <CardHeader>
            <CardTitle>最新审计摘要</CardTitle>
          </CardHeader>
          <CardContent>
            {!hasAuditSummary ? (
              <p className="text-sm text-[#64748B]">{THINKTANK_AUDIT_DELAY_MESSAGE}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="border-b border-slate-200 text-[#64748B]">
                    <tr>
                      <th className="py-2 pr-4 font-medium">事件</th>
                      <th className="py-2 pr-4 font-medium">设置</th>
                      <th className="py-2 pr-4 font-medium">操作者</th>
                      <th className="py-2 pr-4 font-medium">时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {config!.latestAuditSummary.map((item) => (
                      <tr key={`${item.eventName}-${item.occurredAt}`} className="border-b">
                        <td className="py-2 pr-4 font-mono text-xs">{item.eventName}</td>
                        <td className="py-2 pr-4">{item.changedSetting ?? '-'}</td>
                        <td className="py-2 pr-4">{item.actorUserId ?? '-'}</td>
                        <td className="py-2 pr-4">{formatDate(item.occurredAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={disableDialogOpen} onOpenChange={setDisableDialogOpen}>
        <DialogContent role="dialog" aria-label="停用 ThinkTank">
          <DialogHeader>
            <DialogTitle>停用 ThinkTank</DialogTitle>
            <DialogDescription>{THINKTANK_MODULE_DISABLED_MESSAGE}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDisableDialogOpen(false)}>
              取消
            </Button>
            <Button type="button" variant="destructive" onClick={confirmDisable} disabled={saving}>
              确认停用
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toISOString().slice(0, 10)
}
