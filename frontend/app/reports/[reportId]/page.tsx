'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { AlertCircle, FileText } from 'lucide-react'
import { ControlDetailDrawer } from '@/components/compliance/ControlDetailDrawer'
import { useOrganizationStore } from '@/lib/stores/useOrganizationStore'
import { Alert, AlertDescription } from '@/components/ui/alert'
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

  // Story 7.3: 控制点详情抽屉状态
  const [controlDrawerOpen, setControlDrawerOpen] = useState(false)
  const [selectedControl, setSelectedControl] = useState<ControlReportControlNodeDto | null>(null)

  const currentOrganization = useOrganizationStore((state) => state.currentOrganization)
  const organizationId = currentOrganization?.id

  useEffect(() => {
    const fetchReport = async () => {
      if (!organizationId || !reportId) return

      try {
        setIsLoading(true)
        setError(null)

        const response = await fetch(
          `/api/kg/report/compile-control-report?organizationId=${organizationId}&reportId=${reportId}`
        )

        if (!response.ok) {
          throw new Error('加载报告失败')
        }

        const data = await response.json()
        setSections(data.sections || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载报告失败')
      } finally {
        setIsLoading(false)
      }
    }

    fetchReport()
  }, [reportId, organizationId])

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
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6" />
            <CardTitle>控制报告</CardTitle>
          </div>
        </CardHeader>
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
              <CardTitle>{section.l1Name}</CardTitle>
            </CardHeader>
            <CardContent>
              {section.l2Sections.map((l2Section) => (
                <div key={l2Section.l2Code} className="mb-6">
                  <h3 className="text-lg font-semibold mb-4">{l2Section.l2Name}</h3>
                  <div className="space-y-4">
                    {l2Section.controls.map((control) => (
                      <Card key={control.controlId} className="p-4">
                        <div className="flex items-start justify-between">
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
                            </div>
                            <p className="text-sm font-medium">{control.controlName}</p>
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
