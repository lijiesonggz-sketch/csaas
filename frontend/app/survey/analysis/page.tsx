'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  Card,
  CardContent,
  CardHeader,
  Button,
  Alert,
  AlertTitle,
  Chip,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Radio,
  RadioGroup,
  FormControlLabel,
  TextField,
  Box,
  Typography,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Skeleton,
} from '@mui/material'
import {
  ArrowBack,
  Print,
  BarChart,
  TrendingUp,
  TrendingDown,
  Info,
  Rocket,
  Lightbulb,
  Trophy,
  Warning,
  CheckCircle,
  ExpandMore,
} from '@mui/icons-material'
import { SurveyAPI } from '@/lib/api/survey'
import { message } from '@/lib/message'

interface MaturityAnalysisResult {
  surveyResponseId: string
  respondentInfo: {
    name: string
    department?: string
    position?: string
    submittedAt: string
  }
  overall: {
    maturityLevel: number
    calculation: {
      totalScore: number
      maxScore: number
      formula: string
    }
    grade: string
    description: string
  }
  distribution: {
    level_1: number
    level_2: number
    level_3: number
    level_4: number
    level_5: number
  }
  clusterMaturity: {
    cluster_id: string
    cluster_name: string
    dimension: string
    maturityLevel: number
    totalScore: number
    maxScore: number
    questionsCount: number
    calculation: string
    grade: string
    isShortcoming: boolean
    questions: {
      question_id: string
      question_text: string
      selected_option: string
      selected_option_text: string
      score: number
      level: number
    }[]
  }[]
  dimensionMaturity: {
    dimension: string
    clusterCount: number
    maturityLevel: number
    grade: string
  }[]
  conflicts: {
    intraCluster: {
      cluster_id: string
      cluster_name: string
      conflictType: string
      description: string
      questions: string[]
      scores: number[]
      variance: number
      suggestion: string
    }[]
    interCluster: {
      ruleId: string
      conflictType: string
      description: string
      prerequisiteCluster: {
        cluster_id: string
        cluster_name: string
        maturityLevel: number
      }
      dependentCluster: {
        cluster_id: string
        cluster_name: string
        maturityLevel: number
      }
      suggestion: string
    }[]
    hasConflict: boolean
    conflictCount: number
    severity: 'LOW' | 'MEDIUM' | 'HIGH'
  }
  topShortcomings: {
    rank: number
    cluster_id: string
    cluster_name: string
    maturityLevel: number
    gap: number
  }[]
  topStrengths: {
    rank: number
    cluster_id: string
    cluster_name: string
    maturityLevel: number
    advantage: number
  }[]
  statistics: {
    totalQuestions: number
    answeredQuestions: number
    totalClusters: number
    shortcomingClusters: number
    strengthClusters: number
    averageClusterMaturity: number
    minClusterMaturity: number
    maxClusterMaturity: number
    clusterMaturityStdDev: number
    maturityRange: number
  }
}

export default function SurveyAnalysisPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const surveyId = searchParams?.get('surveyId')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<MaturityAnalysisResult | null>(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [targetMaturity, setTargetMaturity] = useState<number>(4)

  useEffect(() => {
    if (!surveyId) {
      setError('缺少问卷ID参数')
      setLoading(false)
      return
    }

    fetchAnalysis()
  }, [surveyId])

  const fetchAnalysis = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await SurveyAPI.analyzeSurvey(surveyId!)

      if (response.success) {
        setAnalysis(response.data)
        message.success('成熟度分析完成')
      } else {
        throw new Error(response.message || '分析失败')
      }
    } catch (err: any) {
      console.error('分析失败:', err)
      setError(err.message || '加载成熟度分析失败')
      message.error(err.message || '加载成熟度分析失败')
    } finally {
      setLoading(false)
    }
  }

  const getGradeColor = (grade: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    if (grade.includes('卓越级')) return 'secondary'
    if (grade.includes('系统优化级')) return 'primary'
    if (grade.includes('充分规范级')) return 'success'
    if (grade.includes('初步规范级')) return 'warning'
    return 'error'
  }

  const getSeverityType = (severity: string): 'error' | 'warning' | 'info' | 'success' => {
    switch (severity) {
      case 'HIGH':
        return 'error'
      case 'MEDIUM':
        return 'warning'
      case 'LOW':
        return 'info'
      default:
        return 'info'
    }
  }

  const getMaturityProgress = (level: number) => {
    return (level / 5) * 100
  }

  const handleGenerateActionPlan = () => {
    setModalVisible(true)
  }

  const handleConfirmTarget = () => {
    if (!analysis) return

    if (targetMaturity <= analysis.overall.maturityLevel) {
      message.warning(`目标成熟度（${targetMaturity.toFixed(1)}）应高于当前成熟度（${analysis.overall.maturityLevel.toFixed(2)}）`)
      return
    }

    router.push(`/ai-generation/action-plan?surveyId=${surveyId}&targetMaturity=${targetMaturity}`)
    setModalVisible(false)
  }

  if (loading) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Skeleton variant="rectangular" height={200} />
        <Typography sx={{ mt: 2 }}>正在分析成熟度...</Typography>
      </Box>
    )
  }

  if (error) {
    return (
      <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          <AlertTitle>错误</AlertTitle>
          {error}
        </Alert>
        <Button startIcon={<ArrowBack />} onClick={() => router.back()}>
          返回
        </Button>
      </Box>
    )
  }

  if (!analysis) {
    return (
      <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
        <Alert severity="info">未找到分析结果</Alert>
      </Box>
    )
  }

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', p: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ mb: 1 }}>成熟度分析报告</Typography>
          <Typography variant="body2" color="text.secondary">
            调研对象: {analysis.respondentInfo.name}
            {analysis.respondentInfo.department && ` - ${analysis.respondentInfo.department}`}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button startIcon={<ArrowBack />} onClick={() => router.back()}>返回</Button>
          <Button variant="contained" startIcon={<Print />} onClick={() => window.print()}>打印报告</Button>
        </Box>
      </Box>

      <Alert
        severity={analysis.conflicts.hasConflict ? getSeverityType(analysis.conflicts.severity) : 'success'}
        sx={{ mb: 3 }}
        icon={analysis.conflicts.hasConflict ? <Warning /> : <CheckCircle />}
      >
        {analysis.conflicts.hasConflict
          ? `检测到 ${analysis.conflicts.conflictCount} 个冲突项`
          : '冲突检测：无冲突'}
      </Alert>

      <Card sx={{ mb: 3 }}>
        <CardHeader title="总体成熟度" avatar={<BarChart />} />
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h2" color="primary">
                  {analysis.overall.maturityLevel.toFixed(2)}
                  <Typography component="span" variant="h6" color="text.secondary"> / 5.0</Typography>
                </Typography>
                <Chip label={analysis.overall.grade} color={getGradeColor(analysis.overall.grade)} sx={{ mt: 2 }} />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>{analysis.overall.description}</Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={8}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2">计算公式: <code>{analysis.overall.calculation.formula}</code></Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={getMaturityProgress(analysis.overall.maturityLevel)}
                sx={{ height: 10, borderRadius: 5 }}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} lg={6}>
          <Card>
            <CardHeader title="TOP 5 短板" sx={{ color: 'error.main' }} avatar={<TrendingDown color="error" />} />
            <CardContent>
              {analysis.topShortcomings.map((item) => (
                <Box key={item.rank} sx={{ mb: 2, pb: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip label={item.rank} color="error" size="small" />
                    <Box>
                      <Typography fontWeight="bold">{item.cluster_name}</Typography>
                      <Typography variant="caption" color="text.secondary">成熟度: {item.maturityLevel.toFixed(2)}</Typography>
                    </Box>
                  </Box>
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} lg={6}>
          <Card>
            <CardHeader title="TOP 5 优势" sx={{ color: 'success.main' }} avatar={<TrendingUp color="success" />} />
            <CardContent>
              {analysis.topStrengths.map((item) => (
                <Box key={item.rank} sx={{ mb: 2, pb: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip label={item.rank} color="success" size="small" />
                    <Box>
                      <Typography fontWeight="bold">{item.cluster_name}</Typography>
                      <Typography variant="caption" color="text.secondary">成熟度: {item.maturityLevel.toFixed(2)}</Typography>
                    </Box>
                  </Box>
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ mt: 3, textAlign: 'center' }}>
        <Button variant="contained" startIcon={<Rocket />} onClick={handleGenerateActionPlan}>
          生成改进措施
        </Button>
      </Box>

      <Dialog open={modalVisible} onClose={() => setModalVisible(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Lightbulb color="primary" />
            设置改进目标
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            总体成熟度: {analysis?.overall.maturityLevel.toFixed(2)} ({analysis?.overall.grade})
          </Alert>

          <Typography variant="subtitle2" sx={{ mb: 1 }}>选择目标成熟度等级:</Typography>
          <RadioGroup value={targetMaturity} onChange={(e) => setTargetMaturity(Number(e.target.value))}>
            {[3, 4, 5].map((level) => {
              const disabled = analysis ? level <= analysis.overall.maturityLevel : false
              const levelNames: Record<number, string> = { 3: '充分规范级', 4: '系统优化级', 5: '卓越级' }
              return (
                <FormControlLabel
                  key={level}
                  value={level}
                  control={<Radio />}
                  disabled={disabled}
                  label={<Box>
                    Level {level} - {levelNames[level]}
                    {disabled && <Chip label="已达成" size="small" sx={{ ml: 1 }} />}
                  </Box>}
                />
              )
            })}
          </RadioGroup>

          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>或自定义目标成熟度:</Typography>
          <TextField
            type="number"
            value={targetMaturity}
            onChange={(e) => setTargetMaturity(Number(e.target.value))}
            size="small"
            sx={{ width: 200 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModalVisible(false)}>取消</Button>
          <Button variant="contained" onClick={handleConfirmTarget}>开始生成</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
