'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { AlertCircle, ChevronRight, Download, FileText, LoaderCircle, ShieldAlert } from 'lucide-react'
import { ControlDetailDrawer } from '@/components/compliance/ControlDetailDrawer'
import {
  createReportPdfJob,
  downloadReportPdf,
  getLatestReportPdfJob,
  getReportDetail,
  getReportPdfJob,
  type ReportPdfJob,
} from '@/lib/api/report-center'
import { useOrganizationStore } from '@/lib/stores/useOrganizationStore'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type {
  ControlReportSectionDto,
  ControlReportControlNodeDto,
} from '@/lib/types/report'

export default function ControlReportPage() {
  const params = useParams()
  const reportId = params.reportId as string

  const [sections, setSections] = useState<ControlReportSectionDto[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pdfJob, setPdfJob] = useState<ReportPdfJob | null>(null)
  const [pdfStatusError, setPdfStatusError] = useState<string | null>(null)
  const [isSubmittingPdfJob, setIsSubmittingPdfJob] = useState(false)
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)

  // Story 7.3: 控制点详情抽屉状态
  const [controlDrawerOpen, setControlDrawerOpen] = useState(false)
  const [selectedControl, setSelectedControl] = useState<ControlReportControlNodeDto | null>(null)

  const currentOrganization = useOrganizationStore((state) => state.currentOrganization)
  const organizationId = currentOrganization?.id

  const normalizeErrorMessage = (loadError: unknown): string => {
    if (
      typeof loadError === 'object' &&
      loadError !== null &&
      'status' in loadError &&
      Number((loadError as { status?: number }).status) === 404
    ) {
      return '未找到对应报告'
    }

    if (loadError instanceof Error && loadError.message) {
      return loadError.message
    }

    return '加载报告失败'
  }

  const normalizePdfErrorMessage = (loadError: unknown): string => {
    if (loadError instanceof Error && loadError.message) {
      return loadError.message
    }

    return 'PDF 处理失败'
  }

  useEffect(() => {
    const fetchReport = async () => {
      if (!reportId) return

      try {
        setIsLoading(true)
        setError(null)

        const data = await getReportDetail(reportId)
        setSections(data.sections || [])
      } catch (err) {
        setError(normalizeErrorMessage(err))
      } finally {
        setIsLoading(false)
      }
    }

    fetchReport()
  }, [reportId])

  useEffect(() => {
    let cancelled = false

    const fetchLatestPdfJob = async () => {
      if (!reportId) {
        return
      }

      try {
        const latestJob = await getLatestReportPdfJob(reportId)

        if (!cancelled) {
          setPdfJob(latestJob)
          setPdfStatusError(latestJob?.status === 'failed' ? latestJob.errorSummary : null)
        }
      } catch (loadError) {
        if (!cancelled) {
          setPdfStatusError(normalizePdfErrorMessage(loadError))
        }
      }
    }

    void fetchLatestPdfJob()

    return () => {
      cancelled = true
    }
  }, [reportId])

  useEffect(() => {
    if (!reportId || !pdfJob || (pdfJob.status !== 'queued' && pdfJob.status !== 'rendering')) {
      return
    }

    let cancelled = false
    const timer = window.setInterval(async () => {
      try {
        const nextJob = await getReportPdfJob(reportId, pdfJob.pdfJobId)

        if (!cancelled) {
          setPdfJob(nextJob)
          if (nextJob.status === 'failed') {
            setPdfStatusError(nextJob.errorSummary ?? 'PDF 生成失败')
          } else if (nextJob.status === 'ready') {
            setPdfStatusError(null)
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          setPdfStatusError(normalizePdfErrorMessage(loadError))
        }
      }
    }, 3000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [pdfJob, reportId])

  const handleCreatePdfJob = async () => {
    if (!reportId) {
      return
    }

    try {
      setIsSubmittingPdfJob(true)
      setPdfStatusError(null)
      const nextJob = await createReportPdfJob(reportId)
      setPdfJob(nextJob)
      if (nextJob.status === 'failed') {
        setPdfStatusError(nextJob.errorSummary ?? 'PDF 生成失败')
      }
    } catch (submitError) {
      setPdfStatusError(normalizePdfErrorMessage(submitError))
    } finally {
      setIsSubmittingPdfJob(false)
    }
  }

  const handleDownloadPdf = async () => {
    if (!reportId || !pdfJob) {
      return
    }

    try {
      setIsDownloadingPdf(true)
      setPdfStatusError(null)
      await downloadReportPdf(reportId, pdfJob.pdfJobId)
    } catch (downloadError) {
      setPdfStatusError(normalizePdfErrorMessage(downloadError))
    } finally {
      setIsDownloadingPdf(false)
    }
  }

  const renderPdfStatusBadge = () => {
    if (!pdfJob) {
      return null
    }

    switch (pdfJob.status) {
      case 'queued':
        return <Badge variant="secondary">PDF 排队中</Badge>
      case 'rendering':
        return <Badge variant="secondary">PDF 生成中</Badge>
      case 'ready':
        return <Badge className="bg-emerald-100 text-emerald-800">PDF 已就绪</Badge>
      case 'failed':
        return <Badge variant="destructive">PDF 生成失败</Badge>
      default:
        return null
    }
  }

  // Story 7.3: 处理控制点详情打开
  const handleOpenControlDetail = (control: ControlReportControlNodeDto) => {
    setSelectedControl(control)
    setControlDrawerOpen(true)
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center py-12">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertTitle>报告加载失败</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="mb-6">
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6" />
              <CardTitle>控制报告</CardTitle>
              {renderPdfStatusBadge()}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {pdfJob?.status === 'ready' ? (
                <>
                  <Button
                    variant="outline"
                    onClick={handleDownloadPdf}
                    disabled={isDownloadingPdf}
                  >
                    {isDownloadingPdf ? (
                      <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    下载 PDF
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleCreatePdfJob}
                    disabled={isSubmittingPdfJob}
                  >
                    重新生成 PDF
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  onClick={handleCreatePdfJob}
                  disabled={
                    isSubmittingPdfJob ||
                    pdfJob?.status === 'queued' ||
                    pdfJob?.status === 'rendering'
                  }
                >
                  {isSubmittingPdfJob || pdfJob?.status === 'queued' || pdfJob?.status === 'rendering' ? (
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  生成 PDF
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        {pdfStatusError ? (
          <CardContent className="pt-0">
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertTitle>PDF 处理提示</AlertTitle>
              <AlertDescription>{pdfStatusError}</AlertDescription>
            </Alert>
          </CardContent>
        ) : null}
      </Card>

      {sections.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <FileText className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-muted-foreground mb-2">暂无报告数据</p>
              <p className="text-sm text-muted-foreground">请先完成评估以生成控制报告</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        sections.map((section) => (
          <Card key={section.l1Code} className="mb-6">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Badge variant="outline">{section.l1Code}</Badge>
                <CardTitle>{section.l1Name}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {section.l2Sections.map((l2Section) => (
                <div key={l2Section.l2Code} className="mb-6 rounded-xl border border-slate-200 p-4">
                  <div className="mb-4 flex items-center gap-2">
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                    <Badge variant="outline">{l2Section.l2Code}</Badge>
                    <h3 className="text-lg font-semibold">{l2Section.l2Name}</h3>
                  </div>
                  <div className="space-y-4">
                    {l2Section.controls.map((control) => (
                      <Card key={control.controlId} className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline">{control.controlCode}</Badge>
                              <Badge
                                className={
                                  control.gapLevel === 'HIGH'
                                    ? 'bg-red-100 text-red-800'
                                    : control.gapLevel === 'MEDIUM'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-green-100 text-green-800'
                                }
                              >
                                {control.gapLevel}
                              </Badge>
                              <Badge variant="secondary">{control.currentStatus}</Badge>
                            </div>
                            <p className="text-sm font-medium">{control.controlName}</p>

                            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                              <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                                <p className="font-medium text-slate-900">法规/案例/证据</p>
                                <p className="mt-2">法规条款：{control.clauses.length}</p>
                                <p>处罚案例：{control.cases.length}</p>
                                <p>证据类型：{control.evidences.length}</p>
                              </div>

                              <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600 md:col-span-2">
                                <div className="mb-2 flex items-center gap-2 text-slate-900">
                                  <ShieldAlert className="h-4 w-4 text-amber-600" />
                                  <p className="font-medium">整改建议</p>
                                </div>

                                {control.recommendations.length === 0 ? (
                                  <p className="text-sm text-slate-500">暂无整改建议</p>
                                ) : (
                                  <div className="space-y-3">
                                    {control.recommendations.map((recommendation) => (
                                      <div
                                        key={recommendation.remediationActionId}
                                        className="rounded-lg border border-slate-200 bg-white p-3"
                                      >
                                        <div className="flex flex-wrap items-center gap-2">
                                          <Badge variant="outline">{recommendation.actionCode}</Badge>
                                          {recommendation.priority ? (
                                            <Badge variant="secondary">
                                              {recommendation.priority}
                                            </Badge>
                                          ) : null}
                                        </div>
                                        <p className="mt-2 text-sm font-medium text-slate-900">
                                          {recommendation.actionTitle}
                                        </p>
                                        {recommendation.actionDesc ? (
                                          <p className="mt-1 text-sm text-slate-600">
                                            {recommendation.actionDesc}
                                          </p>
                                        ) : null}
                                        {recommendation.expectedBenefit ? (
                                          <p className="mt-2 text-xs text-emerald-700">
                                            预期收益：{recommendation.expectedBenefit}
                                          </p>
                                        ) : null}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenControlDetail(control)}
                          >
                            查看详情
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}

      {/* Story 7.3: Control Detail Drawer */}
      {controlDrawerOpen && selectedControl && organizationId && (
        <ControlDetailDrawer
          open={controlDrawerOpen}
          onOpenChange={setControlDrawerOpen}
          organizationId={organizationId}
          controlId={selectedControl.controlId}
          sourceModule="report"
          sourceRecordId={reportId}
        />
      )}
    </div>
  )
}
