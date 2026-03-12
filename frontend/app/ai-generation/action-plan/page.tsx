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
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import Stepper from '@mui/material/Stepper'
import Step from '@mui/material/Step'
import StepLabel from '@mui/material/StepLabel'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import Alert from '@mui/material/Alert'
import Grid from '@mui/material/Grid'
import CircularProgress from '@mui/material/CircularProgress'
import LinearProgress from '@mui/material/LinearProgress'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch'
import DownloadIcon from '@mui/icons-material/Download'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import ScheduleIcon from '@mui/icons-material/Schedule'
import SecurityIcon from '@mui/icons-material/Security'
import GroupsIcon from '@mui/icons-material/Groups'
import AttachMoneyIcon from '@mui/icons-material/AttachMoney'
import LightbulbIcon from '@mui/icons-material/Lightbulb'

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

  const getPriorityColor = (priority: string): 'error' | 'warning' | 'info' | 'default' => {
    const colors: Record<string, 'error' | 'warning' | 'info' | 'default'> = {
      high: 'error',
      medium: 'warning',
      low: 'info',
    }
    return colors[priority] || 'default'
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
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      {/* 顶部导航 */}
      <Box sx={{ mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.back()}
          sx={{ mr: 2 }}
        >
          返回成熟度分析
        </Button>
      </Box>

      {/* 页面标题 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <RocketLaunchIcon sx={{ fontSize: 40, color: 'primary.main' }} />
              <Box>
                <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 0 }}>
                  成熟度改进措施
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  基于差距分析生成的具体、可执行的改进计划
                </Typography>
              </Box>
            </Box>
            {taskStatus?.status === 'completed' && (
              <Button
                variant="contained"
                size="large"
                startIcon={<DownloadIcon />}
                onClick={handleExportToExcel}
              >
                导出措施报告
              </Button>
            )}
          </Box>

          {/* 目标信息 */}
          {targetMaturity > 0 && (
            <Alert severity="success" sx={{ mt: 2 }}>
              <strong>改进目标:</strong> 从当前成熟度提升至{' '}
              <Chip label={`Level ${targetMaturity.toFixed(1)}`} color="primary" size="small" />
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* 步骤指示器 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stepper activeStep={currentStep} alternativeLabel>
            {steps.map((step, index) => (
              <Step key={index}>
                <StepLabel>
                  <Typography variant="subtitle2">{step.label}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {step.description}
                  </Typography>
                </StepLabel>
              </Step>
            ))}
          </Stepper>
        </CardContent>
      </Card>

      {/* 任务进度 */}
      {(loading || (taskStatus && taskStatus.status !== 'completed')) && (
        <Card sx={{ mb: 3, textAlign: 'center' }}>
          <CardContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <CircularProgress size={48} />
              <Box>
                <Typography variant="h6">
                  {taskStatus?.status === 'processing' ? '正在生成改进措施...' : '初始化任务...'}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={taskStatus?.progress || 0}
                  sx={{ width: 300, mt: 1, mb: 1 }}
                />
                <Typography variant="body2" color="text.secondary">
                  AI正在基于您的成熟度分析结果,生成针对性的改进措施
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* 生成失败 */}
      {taskStatus?.status === 'failed' && (
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="h6" color="error" gutterBottom>
              生成失败
            </Typography>
            <Typography color="error" sx={{ mb: 2 }}>
              {taskStatus.errorMessage}
            </Typography>
            <Button variant="contained" onClick={startGeneration}>
              重新生成
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 措施展示 */}
      {taskStatus?.status === 'completed' && taskStatus.measures.length > 0 && (
        <>
          {/* 统计概览 */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Grid container spacing={2}>
                <Grid size={{ xs: 6, md: 3 }}>
                  <Typography variant="h4" color="primary.main" fontWeight="bold">
                    {taskStatus.measures.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    总计措施数量
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6, md: 3 }}>
                  <Typography variant="h4" color="success.main" fontWeight="bold">
                    {Object.keys(groupedMeasures).length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    涉及聚类
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6, md: 3 }}>
                  <Typography variant="h4" color="error.main" fontWeight="bold">
                    {taskStatus.measures.filter((m) => m.priority === 'high').length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    高优先级措施
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6, md: 3 }}>
                  <Typography variant="h4" color="warning.main" fontWeight="bold">
                    {taskStatus.measures
                      .reduce((sum, m) => sum + m.expectedImprovement, 0)
                      .toFixed(1)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    预期总提升 (分)
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* 按聚类分组展示措施 */}
          {Object.entries(groupedMeasures).map(([clusterName, measures]) => {
            const clusterGap = measures[0].gap
            const clusterCurrent = measures[0].currentLevel
            const clusterTarget = measures[0].targetLevel

            return (
              <Card key={clusterName} sx={{ mb: 3 }}>
                <CardHeader
                  title={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <SecurityIcon />
                      <Typography variant="h6">{clusterName}</Typography>
                      <Chip
                        color="error"
                        label={`当前 ${clusterCurrent.toFixed(2)} → 目标 ${clusterTarget.toFixed(1)} (差距 ${clusterGap.toFixed(2)})`}
                      />
                    </Box>
                  }
                  action={<Chip label={`${measures.length} 条措施`} color="primary" />}
                />
                <CardContent>
                  {measures
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((measure, index) => (
                      <Accordion key={measure.id} defaultExpanded={index === 0}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                            <Chip
                              color={getPriorityColor(measure.priority)}
                              size="small"
                              label={getPriorityText(measure.priority)}
                            />
                            <Typography variant="subtitle1" sx={{ flex: 1 }}>
                              {index + 1}. {measure.title}
                            </Typography>
                            <Chip
                              icon={<TrendingUpIcon />}
                              label={`预期提升: +${measure.expectedImprovement.toFixed(1)}分`}
                              size="small"
                            />
                            <Chip
                              icon={<ScheduleIcon />}
                              label={measure.timeline}
                              size="small"
                              variant="outlined"
                            />
                          </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {/* 描述 */}
                            <Alert severity="info" icon={<LightbulbIcon />}>
                              {measure.description}
                            </Alert>

                            {/* 实施步骤 */}
                            <Accordion>
                              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography>📋 实施步骤</Typography>
                              </AccordionSummary>
                              <AccordionDetails>
                                <Box component="ol" sx={{ pl: 2 }}>
                                  {measure.implementationSteps.map((step) => (
                                    <Box component="li" key={step.stepNumber} sx={{ mb: 2 }}>
                                      <Typography variant="subtitle2">{step.title}</Typography>
                                      <Typography variant="body2" color="text.secondary">
                                        {step.description}
                                      </Typography>
                                      <Chip
                                        label={`预计耗时: ${step.duration}`}
                                        size="small"
                                        color="info"
                                        sx={{ mt: 0.5 }}
                                      />
                                    </Box>
                                  ))}
                                </Box>
                              </AccordionDetails>
                            </Accordion>

                            {/* 资源需求 */}
                            <Accordion>
                              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography>💰 资源需求</Typography>
                              </AccordionSummary>
                              <AccordionDetails>
                                <Grid container spacing={2}>
                                  {measure.resourcesNeeded.budget && (
                                    <Grid size={{ xs: 12, md: 6 }}>
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <AttachMoneyIcon color="primary" />
                                        <Typography>
                                          <strong>预算:</strong> {measure.resourcesNeeded.budget}
                                        </Typography>
                                      </Box>
                                    </Grid>
                                  )}
                                  {measure.resourcesNeeded.personnel && measure.resourcesNeeded.personnel.length > 0 && (
                                    <Grid size={{ xs: 12, md: 6 }}>
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <GroupsIcon color="primary" />
                                        <Typography>
                                          <strong>人员:</strong>{' '}
                                          {measure.resourcesNeeded.personnel.join(', ')}
                                        </Typography>
                                      </Box>
                                    </Grid>
                                  )}
                                  {measure.resourcesNeeded.technology && measure.resourcesNeeded.technology.length > 0 && (
                                    <Grid size={{ xs: 12 }}>
                                      <Typography gutterBottom>
                                        <strong>技术/工具:</strong>
                                      </Typography>
                                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                        {measure.resourcesNeeded.technology.map((tech, i) => (
                                          <Chip key={i} label={tech} color="primary" size="small" />
                                        ))}
                                      </Box>
                                    </Grid>
                                  )}
                                  <Grid size={{ xs: 12 }}>
                                    <Typography>
                                      <strong>负责部门:</strong> {measure.responsibleDepartment}
                                    </Typography>
                                  </Grid>
                                </Grid>
                              </AccordionDetails>
                            </Accordion>

                            {/* 风险与缓解 */}
                            {measure.risks && measure.risks.length > 0 && (
                              <Accordion>
                                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                  <Typography>⚠️ 风险与缓解</Typography>
                                </AccordionSummary>
                                <AccordionDetails>
                                  <Box component="ul" sx={{ pl: 2 }}>
                                    {measure.risks.map((risk, i) => (
                                      <Box component="li" key={i} sx={{ mb: 1 }}>
                                        <Typography color="error" fontWeight="medium">
                                          风险: {risk.risk}
                                        </Typography>
                                        <Typography color="success.main">
                                          ✓ 缓解措施: {risk.mitigation}
                                        </Typography>
                                      </Box>
                                    ))}
                                  </Box>
                                </AccordionDetails>
                              </Accordion>
                            )}

                            {/* KPI指标 */}
                            {measure.kpiMetrics && measure.kpiMetrics.length > 0 && (
                              <Accordion>
                                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                  <Typography>📊 KPI指标</Typography>
                                </AccordionSummary>
                                <AccordionDetails>
                                  <Grid container spacing={2}>
                                    {measure.kpiMetrics.map((kpi, i) => (
                                      <Grid size={{ xs: 12, md: 6 }} key={i}>
                                        <Card variant="outlined" sx={{ bgcolor: 'primary.50' }}>
                                          <CardContent>
                                            <Typography variant="subtitle2" gutterBottom>
                                              {kpi.metric}
                                            </Typography>
                                            <Typography variant="body2">
                                              目标值: <Chip label={kpi.target} color="success" size="small" />
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                              测量方法: {kpi.measurementMethod}
                                            </Typography>
                                          </CardContent>
                                        </Card>
                                      </Grid>
                                    ))}
                                  </Grid>
                                </AccordionDetails>
                              </Accordion>
                            )}
                          </Box>
                        </AccordionDetails>
                      </Accordion>
                    ))}
                </CardContent>
              </Card>
            )
          })}
        </>
      )}

      {/* 空状态 */}
      {taskStatus?.status === 'completed' && taskStatus.measures.length === 0 && (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h6" color="text.secondary">
              未生成任何措施
            </Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  )
}
