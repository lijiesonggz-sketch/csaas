'use client'

export const dynamic = 'force-dynamic'

/**
 * 落地措施生成与展示页面
 * 基于成熟度分析结果生成具体的改进措施
 */

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { exportActionPlanToExcel } from '@/lib/utils/export-action-plan'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import {
  ArrowLeft,
  Rocket,
  Download,
  TrendingUp,
  Clock,
  Shield,
  Users,
  DollarSign,
  Lightbulb,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Info,
  AlertCircle,
} from 'lucide-react'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

interface ActionPlanMeasure {
  id: string
  clusterName: string
  clusterId: string
  currentLevel: number
  targetLevel: number
  gap: number
  priority: 'high' | 'medium' | 'low'
  title: string
  description: string
  implementationSteps: Array<{
    stepNumber: number
    title: string
    description: string
    duration: string
  }>
  timeline: string
  responsibleDepartment: string
  expectedImprovement: number
  resourcesNeeded: {
    budget?: string
    personnel?: string[]
    technology?: string[]
    training?: string
  }
  dependencies: {
    prerequisiteMeasures?: string[]
    externalDependencies?: string[]
  }
  risks: Array<{
    risk: string
    mitigation: string
  }>
  kpiMetrics: Array<{
    metric: string
    target: string
    measurementMethod: string
  }>
  status: string
  progress: number
  sortOrder: number
}

interface TaskStatus {
  taskId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  errorMessage?: string
  result?: any
  measures: ActionPlanMeasure[]
  createdAt: string
  completedAt?: string
}

const steps = [
  { label: '生成措施', description: 'AI分析并生成改进措施' },
  { label: '处理中', description: '正在生成详细计划' },
  { label: '查看结果', description: '查看改进措施详情' },
]

export default function ActionPlanPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const surveyId = searchParams.get('surveyId')
  const targetMaturity = parseFloat(searchParams.get('targetMaturity') || '0')

  const [taskId, setTaskId] = useState<string | null>(null)
  const [taskStatus, setTaskStatus] = useState<TaskStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [polling, setPolling] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)

  // 启动生成任务
  useEffect(() => {
    if (surveyId && targetMaturity && !taskId) {
      startGeneration()
    }
  }, [surveyId, targetMaturity])

  // 轮询任务状态
  useEffect(() => {
    if (taskId && polling) {
      const interval = setInterval(() => {
        fetchTaskStatus()
      }, 3000) // 每3秒轮询一次

      return () => clearInterval(interval)
    }
  }, [taskId, polling])

  const startGeneration = async () => {
    if (!surveyId) {
      toast.error('缺少问卷ID')
      return
    }

    setLoading(true)
    setCurrentStep(1)

    try {
      const response = await fetch(`http://localhost:3000/survey/${surveyId}/action-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetMaturity }),
      })

      const data = await response.json()

      if (data.success) {
        setTaskId(data.data.taskId)
        setPolling(true)
        toast.success('落地措施生成任务已启动')
      } else {
        toast.error(data.message || '启动生成任务失败')
        setCurrentStep(0)
      }
    } catch (error: any) {
      toast.error('网络请求失败: ' + error.message)
      setCurrentStep(0)
    } finally {
      setLoading(false)
    }
  }

  const fetchTaskStatus = async () => {
    if (!taskId || !surveyId) return

    try {
      const response = await fetch(
        `http://localhost:3000/survey/${surveyId}/action-plan/task/${taskId}`,
      )
      const data = await response.json()

      if (data.success) {
        setTaskStatus(data.data)

        // 如果任务完成或失败，停止轮询
        if (data.data.status === 'completed' || data.data.status === 'failed') {
          setPolling(false)

          if (data.data.status === 'completed') {
            setCurrentStep(2)
            toast.success('落地措施生成完成!')
          } else {
            toast.error('生成失败: ' + data.data.errorMessage)
            setCurrentStep(0)
          }
        }
      }
    } catch (error: any) {
      console.error('获取任务状态失败:', error)
    }
  }

  const handleExportToExcel = () => {
    if (!taskStatus || !taskStatus.measures || taskStatus.measures.length === 0) {
      toast.warning('没有可导出的措施数据')
      return
    }

    try {
      exportActionPlanToExcel(taskStatus.measures, targetMaturity, '成熟度改进措施计划')
      toast.success('Excel文件已生成并下载!')
    } catch (error: any) {
      toast.error('导出失败: ' + error.message)
      console.error('导出Excel失败:', error)
    }
  }

  const getPriorityVariant = (priority: string): 'default' | 'destructive' | 'outline' => {
    if (priority === 'high') return 'destructive'
    if (priority === 'medium') return 'outline'
    return 'outline'
  }

  const getPriorityText = (priority: string) => {
    const texts: Record<string, string> = {
      high: '高优先级',
      medium: '中优先级',
      low: '低优先级',
    }
    return texts[priority] || priority
  }

  // 按聚类分组措施
  const groupedMeasures = taskStatus?.measures.reduce((acc, measure) => {
    if (!acc[measure.clusterName]) {
      acc[measure.clusterName] = []
    }
    acc[measure.clusterName].push(measure)
    return acc
  }, {} as Record<string, ActionPlanMeasure[]>) || {}

  return (
    <div className="p-6 bg-[#FEFDFB] min-h-screen max-w-[1400px] mx-auto">
      {/* 顶部导航 */}
      <div className="mb-6">
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="rounded-sm"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回成熟度分析
        </Button>
      </div>

      {/* 页面标题 */}
      <Card className="mb-6 border-[#E2E8F0] rounded-sm shadow-sm">
        <CardContent className="p-6">
          <div className="flex justify-between items-start flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <Rocket className="w-10 h-10 text-[#1E3A5F]" />
              <div>
                <h1 className="text-3xl font-bold text-[#1E3A5F] font-[var(--font-plus-jakarta)]">
                  成熟度改进措施
                </h1>
                <p className="text-sm text-[#94A3B8] mt-1">
                  基于差距分析生成的具体、可执行的改进计划
                </p>
              </div>
            </div>
            {taskStatus?.status === 'completed' && (
              <Button
                className="bg-[#1E3A5F] hover:bg-[#162e4d] text-white rounded-sm"
                onClick={handleExportToExcel}
              >
                <Download className="w-4 h-4 mr-2" />
                导出措施报告
              </Button>
            )}
          </div>

          {/* 目标信息 */}
          {targetMaturity > 0 && (
            <Alert className="mt-4 rounded-sm border-[#059669] bg-[#F0FDF4]">
              <CheckCircle className="h-4 w-4 text-[#059669]" />
              <AlertDescription className="text-[#059669]">
                <strong>改进目标:</strong> 从当前成熟度提升至{' '}
                <Badge className="ml-2 bg-[#1E3A5F] text-white rounded-sm">
                  Level {targetMaturity.toFixed(1)}
                </Badge>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* 步骤指示器 */}
      <Card className="mb-6 border-[#E2E8F0] rounded-sm shadow-sm">
        <CardContent className="p-6">
          <div className="flex justify-between">
            {steps.map((step, index) => (
              <div key={index} className="flex-1 flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                    currentStep >= index
                      ? 'bg-[#1E3A5F] text-white'
                      : 'bg-[#94A3B8] text-white'
                  }`}
                >
                  {index + 1}
                </div>
                <p className="text-sm font-semibold mt-2 text-[#1E3A5F]">{step.label}</p>
                <p className="text-xs text-[#94A3B8] text-center">{step.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 任务进度 */}
      {(loading || (taskStatus && taskStatus.status !== 'completed')) && (
        <Card className="mb-6 border-[#E2E8F0] rounded-sm shadow-sm text-center">
          <CardContent className="p-6">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-12 h-12 animate-spin text-[#1E3A5F]" />
              <div>
                <h3 className="text-lg font-semibold text-[#1E3A5F]">
                  {taskStatus?.status === 'processing' ? '正在生成改进措施...' : '初始化任务...'}
                </h3>
                <Progress
                  value={taskStatus?.progress || 0}
                  className="w-[300px] mt-2 h-2"
                />
                <p className="text-sm text-[#94A3B8] mt-2">
                  AI正在基于您的成熟度分析结果,生成针对性的改进措施
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 生成失败 */}
      {taskStatus?.status === 'failed' && (
        <Card className="mb-6 border-[#E2E8F0] rounded-sm shadow-sm text-center">
          <CardContent className="p-6">
            <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
            <h3 className="text-lg font-semibold text-red-600 mb-2">
              生成失败
            </h3>
            <p className="text-red-600 mb-4">{taskStatus.errorMessage}</p>
            <Button
              onClick={startGeneration}
              className="bg-[#1E3A5F] hover:bg-[#162e4d] text-white rounded-sm"
            >
              重新生成
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 措施展示 */}
      {taskStatus?.status === 'completed' && taskStatus.measures.length > 0 && (
        <>
          {/* 统计概览 */}
          <Card className="mb-6 border-[#E2E8F0] rounded-sm shadow-sm">
            <CardContent className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="text-center">
                  <p className="text-4xl font-bold text-[#1E3A5F]">
                    {taskStatus.measures.length}
                  </p>
                  <p className="text-sm text-[#94A3B8]">总计措施数量</p>
                </div>
                <div className="text-center">
                  <p className="text-4xl font-bold text-[#059669]">
                    {Object.keys(groupedMeasures).length}
                  </p>
                  <p className="text-sm text-[#94A3B8]">涉及聚类</p>
                </div>
                <div className="text-center">
                  <p className="text-4xl font-bold text-red-600">
                    {taskStatus.measures.filter((m) => m.priority === 'high').length}
                  </p>
                  <p className="text-sm text-[#94A3B8]">高优先级措施</p>
                </div>
                <div className="text-center">
                  <p className="text-4xl font-bold text-yellow-600">
                    {taskStatus.measures
                      .reduce((sum, m) => sum + m.expectedImprovement, 0)
                      .toFixed(1)}
                  </p>
                  <p className="text-sm text-[#94A3B8]">预期总提升 (分)</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 按聚类分组展示措施 */}
          {Object.entries(groupedMeasures).map(([clusterName, measures]) => {
            const clusterGap = measures[0].gap
            const clusterCurrent = measures[0].currentLevel
            const clusterTarget = measures[0].targetLevel

            return (
              <Card key={clusterName} className="mb-6 border-[#E2E8F0] rounded-sm shadow-sm">
                <CardContent className="p-6">
                  {/* 聚类标题 */}
                  <div className="flex items-center justify-between mb-4 pb-4 border-b border-[#E2E8F0]">
                    <div className="flex items-center gap-2">
                      <Shield className="w-5 h-5 text-[#1E3A5F]" />
                      <h2 className="text-lg font-semibold text-[#1E3A5F]">{clusterName}</h2>
                      <Badge variant="destructive" className="rounded-sm">
                        当前 {clusterCurrent.toFixed(2)} → 目标 {clusterTarget.toFixed(1)} (差距 {clusterGap.toFixed(2)})
                      </Badge>
                    </div>
                    <Badge className="bg-[#1E3A5F] text-white rounded-sm">
                      {measures.length} 条措施
                    </Badge>
                  </div>

                  {/* 措施列表 */}
                  <div className="space-y-4">
                    {measures
                      .sort((a, b) => a.sortOrder - b.sortOrder)
                      .map((measure, index) => (
                        <Card key={measure.id} className="border border-[#E2E8F0] rounded-sm shadow-sm">
                          <CardContent className="p-4">
                            {/* 措施标题和标签 */}
                            <div className="flex items-center gap-2 mb-3 flex-wrap">
                              <Badge variant={getPriorityVariant(measure.priority)} className="rounded-sm">
                                {getPriorityText(measure.priority)}
                              </Badge>
                              <h3 className="text-base font-semibold text-[#1E3A5F] flex-1">
                                {index + 1}. {measure.title}
                              </h3>
                              <Badge variant="outline" className="rounded-sm border-[#059669] text-[#059669]">
                                <TrendingUp className="w-3 h-3 mr-1" />
                                预期提升: +{measure.expectedImprovement.toFixed(1)}分
                              </Badge>
                              <Badge variant="outline" className="rounded-sm">
                                <Clock className="w-3 h-3 mr-1" />
                                {measure.timeline}
                              </Badge>
                            </div>

                            {/* 描述 */}
                            <Alert className="mb-4 rounded-sm border-[#059669] bg-[#F0FDF4]">
                              <Lightbulb className="h-4 w-4 text-[#059669]" />
                              <AlertDescription className="text-[#059669]">
                                {measure.description}
                              </AlertDescription>
                            </Alert>

                            {/* 实施步骤 */}
                            <div className="mb-4">
                              <h4 className="font-semibold text-[#1E3A5F] mb-2">📋 实施步骤</h4>
                              <ol className="list-decimal list-inside space-y-3">
                                {measure.implementationSteps.map((step) => (
                                  <li key={step.stepNumber} className="pl-2">
                                    <p className="font-semibold text-sm">{step.title}</p>
                                    <p className="text-sm text-[#94A3B8]">{step.description}</p>
                                    <Badge variant="outline" className="mt-1 rounded-sm text-xs">
                                      预计耗时: {step.duration}
                                    </Badge>
                                  </li>
                                ))}
                              </ol>
                            </div>

                            {/* 资源需求 */}
                            <div className="mb-4">
                              <h4 className="font-semibold text-[#1E3A5F] mb-2">💰 资源需求</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {measure.resourcesNeeded.budget && (
                                  <div className="flex items-center gap-2">
                                    <DollarSign className="w-4 h-4 text-[#1E3A5F]" />
                                    <p className="text-sm">
                                      <strong>预算:</strong> {measure.resourcesNeeded.budget}
                                    </p>
                                  </div>
                                )}
                                {measure.resourcesNeeded.personnel && measure.resourcesNeeded.personnel.length > 0 && (
                                  <div className="flex items-center gap-2">
                                    <Users className="w-4 h-4 text-[#1E3A5F]" />
                                    <p className="text-sm">
                                      <strong>人员:</strong> {measure.resourcesNeeded.personnel.join(', ')}
                                    </p>
                                  </div>
                                )}
                                {measure.resourcesNeeded.technology && measure.resourcesNeeded.technology.length > 0 && (
                                  <div className="md:col-span-2">
                                    <p className="text-sm font-semibold mb-1">技术/工具:</p>
                                    <div className="flex flex-wrap gap-1">
                                      {measure.resourcesNeeded.technology.map((tech, i) => (
                                        <Badge key={i} variant="outline" className="rounded-sm">{tech}</Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                <div className="md:col-span-2">
                                  <p className="text-sm">
                                    <strong>负责部门:</strong> {measure.responsibleDepartment}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* 风险与缓解 */}
                            {measure.risks && measure.risks.length > 0 && (
                              <div className="mb-4">
                                <h4 className="font-semibold text-[#1E3A5F] mb-2">⚠️ 风险与缓解</h4>
                                <ul className="space-y-2">
                                  {measure.risks.map((risk, i) => (
                                    <li key={i} className="pl-2">
                                      <p className="text-sm font-semibold text-red-600">
                                        风险: {risk.risk}
                                      </p>
                                      <p className="text-sm text-[#059669]">
                                        ✓ 缓解措施: {risk.mitigation}
                                      </p>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* KPI指标 */}
                            {measure.kpiMetrics && measure.kpiMetrics.length > 0 && (
                              <div>
                                <h4 className="font-semibold text-[#1E3A5F] mb-2">📊 KPI指标</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {measure.kpiMetrics.map((kpi, i) => (
                                    <Card key={i} className="border border-[#E2E8F0] bg-[#F0FDF4] rounded-sm">
                                      <CardContent className="p-3">
                                        <p className="text-sm font-semibold mb-1">{kpi.metric}</p>
                                        <p className="text-sm">
                                          目标值: <Badge className="bg-[#059669] text-white rounded-sm text-xs">{kpi.target}</Badge>
                                        </p>
                                        <p className="text-xs text-[#94A3B8] mt-1">
                                          测量方法: {kpi.measurementMethod}
                                        </p>
                                      </CardContent>
                                    </Card>
                                  ))}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </>
      )}

      {/* 空状态 */}
      {taskStatus?.status === 'completed' && taskStatus.measures.length === 0 && (
        <Card className="border-[#E2E8F0] rounded-sm shadow-sm">
          <CardContent className="p-12 text-center">
            <p className="text-lg text-[#94A3B8]">未生成任何措施</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
