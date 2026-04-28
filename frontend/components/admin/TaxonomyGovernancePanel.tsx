'use client'

import { useState } from 'react'
import { AlertTriangle, Download, Loader2, RefreshCw, ShieldCheck, Upload } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type {
  TaxonomyGovernanceSummary,
  TaxonomyRuntimeProfileImportResult,
} from '@/lib/api/knowledge-graph'

interface TaxonomyGovernancePanelProps {
  summary: TaxonomyGovernanceSummary | null
  loading: boolean
  error: string | null
  onRefresh: () => Promise<void> | void
  onExport: () => Promise<void>
  onImport: (file: File, sourceVersion: string) => Promise<TaxonomyRuntimeProfileImportResult>
}

const RUNTIME_PROFILE_REPLACEMENT_WARNING_TEXT = '导入会替换当前 runtime profile snapshot'

export function TaxonomyGovernancePanel({
  summary,
  loading,
  error,
  onRefresh,
  onExport,
  onImport,
}: TaxonomyGovernancePanelProps) {
  const [importOpen, setImportOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [sourceVersion, setSourceVersion] = useState('')
  const [submittingImport, setSubmittingImport] = useState(false)
  const [submittingExport, setSubmittingExport] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  const currentVersion = summary?.sourceVersion ?? '未设置'

  function handleImportOpenChange(open: boolean) {
    setImportOpen(open)

    if (!open) {
      setSelectedFile(null)
      setSourceVersion('')
      setLocalError(null)
    }
  }

  async function handleConfirmImport() {
    if (!selectedFile) {
      setLocalError('请选择 Runtime Profile CSV 文件')
      return
    }

    if (!sourceVersion.trim()) {
      setLocalError('请输入 sourceVersion')
      return
    }

    try {
      setSubmittingImport(true)
      setLocalError(null)
      const result = await onImport(selectedFile, sourceVersion.trim())
      setSuccessMessage(`导入成功：${result.importedRowCount} 行，版本 ${result.sourceVersion}`)
      setImportOpen(false)
      setSelectedFile(null)
      setSourceVersion('')
    } catch (importError) {
      setLocalError(importError instanceof Error ? importError.message : '导入失败')
    } finally {
      setSubmittingImport(false)
    }
  }

  async function handleExport() {
    try {
      setSubmittingExport(true)
      setLocalError(null)
      await onExport()
    } catch (exportError) {
      setLocalError(exportError instanceof Error ? exportError.message : '导出失败')
    } finally {
      setSubmittingExport(false)
    }
  }

  return (
    <Card className="rounded-sm border-[#E2E8F0] shadow-sm lg:col-span-3">
      <CardContent className="space-y-6 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[#1E3A5F]" />
              <h2 className="text-xl font-semibold text-[#1E3A5F]">治理概览</h2>
            </div>
            <p className="text-sm text-[#64748B]">
              统一查看 taxonomy catalog、runtime profile 与 rulebook 的当前治理状态。
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="rounded-sm"
              onClick={() => void onRefresh()}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              刷新
            </Button>
            <Button
              variant="outline"
              className="rounded-sm"
              onClick={() => void handleExport()}
              disabled={submittingExport}
            >
              {submittingExport ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              导出 Runtime Profile
            </Button>
            <Button className="rounded-sm" onClick={() => setImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              导入 Runtime Profile
            </Button>
          </div>
        </div>

        <Alert className="border-amber-300 bg-amber-50 text-amber-900">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{RUNTIME_PROFILE_REPLACEMENT_WARNING_TEXT}</AlertDescription>
        </Alert>

        {successMessage && (
          <Alert className="border-emerald-300 bg-emerald-50 text-emerald-900">
            <ShieldCheck className="h-4 w-4" />
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>
        )}

        {(error || localError) && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error || localError}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-sm border border-[#E2E8F0] bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
              当前 Runtime Profile 版本
            </p>
            <p className="mt-2 text-lg font-semibold text-[#1E3A5F]">{currentVersion}</p>
          </div>
          <div className="rounded-sm border border-[#E2E8F0] bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
              Domain 数量
            </p>
            <p className="mt-2 text-lg font-semibold text-[#1E3A5F]">
              {summary?.domains.length ?? 0}
            </p>
          </div>
          <div className="rounded-sm border border-[#E2E8F0] bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
              Rulebook 覆盖摘要
            </p>
            <p className="mt-2 text-lg font-semibold text-[#1E3A5F]">
              {(summary?.domains ?? []).reduce(
                (total, domain) => total + domain.rulebookEntryCount,
                0
              )}
            </p>
            <p className="mt-2 text-xs text-[#64748B]">
              仅表示治理可见性，不表示所有 L2 都必须 100% rulebook 化。
            </p>
          </div>
        </div>

        <div className="rounded-sm border border-[#E2E8F0] bg-white">
          <div className="border-b border-[#E2E8F0] px-4 py-3">
            <h3 className="text-sm font-semibold text-[#1E3A5F]">Per-domain Coverage</h3>
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-[#1E3A5F]" />
            </div>
          ) : !summary || summary.domains.length === 0 ? (
            <div className="px-4 py-8 text-sm text-[#64748B]">暂无治理摘要数据</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-[#F8FAFC] text-left text-[#475569]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Domain</th>
                    <th className="px-4 py-3 font-medium">Catalog</th>
                    <th className="px-4 py-3 font-medium">Runtime</th>
                    <th className="px-4 py-3 font-medium">Rulebook</th>
                    <th className="px-4 py-3 font-medium">Mapping 版本</th>
                    <th className="px-4 py-3 font-medium">Rulebook 版本</th>
                    <th className="px-4 py-3 font-medium">Fallback</th>
                    <th className="px-4 py-3 font-medium">Readiness</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.domains.map((domain) => (
                    <tr key={domain.l1Code} className="border-t border-[#E2E8F0]">
                      <td className="px-4 py-3">
                        <div className="font-medium text-[#1E3A5F]">{domain.l1Code}</div>
                        <div className="text-xs text-[#64748B]">{domain.l1Name}</div>
                      </td>
                      <td className="px-4 py-3 text-[#1E3A5F]">{domain.catalogL2Count}</td>
                      <td className="px-4 py-3 text-[#1E3A5F]">{domain.runtimeProfileCount}</td>
                      <td className="px-4 py-3 text-[#1E3A5F]">{domain.rulebookEntryCount}</td>
                      <td className="px-4 py-3 text-[#1E3A5F]">
                        {domain.mappingSourceVersion ?? '未设置'}
                      </td>
                      <td className="px-4 py-3 text-[#1E3A5F]">
                        {domain.rulebookVersion ?? '未设置'}
                      </td>
                      <td className="px-4 py-3 text-[#1E3A5F]">
                        {domain.fallbackBucket ?? '未设置'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs">
                          {domain.readinessStage ?? 'unknown'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-sm border border-[#E2E8F0] bg-[#F8FAFC] p-4">
            <h3 className="text-sm font-semibold text-[#1E3A5F]">Catalog 变更路径</h3>
            <p className="mt-2 text-sm text-[#64748B]">
              使用 canonical `taxonomy_l1 / taxonomy_l2` 管理路径，维护目录与层级本体。
            </p>
          </div>
          <div className="rounded-sm border border-[#E2E8F0] bg-[#F8FAFC] p-4">
            <h3 className="text-sm font-semibold text-[#1E3A5F]">Runtime Profile 变更路径</h3>
            <p className="mt-2 text-sm text-[#64748B]">
              通过 full-snapshot CSV 导入 / 导出维护 `taxonomy_l2_runtime_profiles`。
            </p>
          </div>
          <div className="rounded-sm border border-[#E2E8F0] bg-[#F8FAFC] p-4">
            <h3 className="text-sm font-semibold text-[#1E3A5F]">Rulebook 变更路径</h3>
            <p className="mt-2 text-sm text-[#64748B]">
              Rulebook 保持 repo manifest + PR / CI 治理链路，管理端只读展示。
            </p>
          </div>
        </div>

        <Dialog open={importOpen} onOpenChange={handleImportOpenChange}>
          <DialogContent className="rounded-sm">
            <DialogHeader>
              <DialogTitle>导入 Runtime Profile</DialogTitle>
              <DialogDescription>
                以 full-snapshot 方式替换当前 Runtime Profile snapshot。
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="taxonomy-runtime-profile-source-version">sourceVersion</Label>
                <Input
                  id="taxonomy-runtime-profile-source-version"
                  value={sourceVersion}
                  onChange={(event) => setSourceVersion(event.target.value)}
                  placeholder="例如 2026-04-29-governance-v2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxonomy-runtime-profile-file">上传 Runtime Profile CSV</Label>
                <Input
                  id="taxonomy-runtime-profile-file"
                  aria-label="上传 Runtime Profile CSV"
                  type="file"
                  accept=".csv"
                  onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="rounded-sm"
                onClick={() => setImportOpen(false)}
              >
                取消
              </Button>
              <Button
                type="button"
                className="rounded-sm"
                onClick={() => void handleConfirmImport()}
                disabled={submittingImport}
              >
                {submittingImport ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                确认导入 Runtime Profile
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
