'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
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
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Skeleton,
  IconButton,
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
  UploadFile,
  Download,
  EmojiEvents,
  Warning,
  CheckCircle,
  PictureAsPdf,
  ExpandMore,
} from '@mui/icons-material'
import { SurveyAPI } from '@/lib/api/survey'
import * as XLSX from 'xlsx'
import MaturityRadarChart, { mapToRadarData } from '@/components/features/MaturityRadarChart'
import { GapAnalysisReport, GapAnalysisReportData } from '@/components/features/GapAnalysisReport'
import { generatePDFFilename, formatReportDate } from '@/lib/utils/pdfExport'
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

interface UploadFile {
  name: string
  originFileObj?: File
}

export default function GapAnalysisPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = params.projectId as string

  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<MaturityAnalysisResult | null>(null)
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [parsedData, setParsedData] = useState<any | null>(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [targetMaturity, setTargetMaturity] = useState<number>(4)
  const [reportModalVisible, setReportModalVisible] = useState(false)

  useEffect(() => {
    const savedAnalysis = localStorage.getItem(`gap-analysis-${projectId}`)
    if (savedAnalysis) {
      try {
        setAnalysis(JSON.parse(savedAnalysis))
      } catch (e) {
        console.error('Failed to parse saved analysis:', e)
      }
    }
  }, [projectId])

  useEffect(() => {
    if (analysis) {
      localStorage.setItem(`gap-analysis-${projectId}`, JSON.stringify(analysis))
    }
  }, [analysis, projectId])

  const handleReupload = () => {
    setAnalysis(null)
    setParsedData(null)
    setFileList([])
    setError(null)
    localStorage.removeItem(`gap-analysis-${projectId}`)
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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setUploading(true)
      setError(null)

      const data = await parseFile(file)
      setParsedData(data)
      message.success('文件解析成功！请点击"开始分析"按钮进行差距分析')
      setFileList([{ name: file.name }])
    } catch (err: any) {
      console.error('文件解析失败:', err)
      setError(err.message || '文件解析失败，请确保文件格式正确')
      message.error(err.message || '文件解析失败')
    } finally {
      setUploading(false)
    }
  }

  const handleStartAnalysis = async () => {
    if (!parsedData) {
      message.warning('请先上传文件')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const response = await SurveyAPI.uploadAndAnalyze({
        projectId,
        questionnaireData: parsedData,
      })

      if (response.success) {
        setAnalysis(response.data)
        message.success('差距分析完成！')
        setFileList([])
        setParsedData(null)
      } else {
        throw new Error(response.message || '分析失败')
      }
    } catch (err: any) {
      console.error('分析失败:', err)
      setError(err.message || '差距分析失败')
      message.error(err.message || '差距分析失败')
    } finally {
      setLoading(false)
    }
  }

  const parseFile = async (file: File): Promise<any> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = (e) => {
        try {
          const data = e.target?.result
          const workbook = XLSX.read(data, { type: 'binary' })

          const sheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[sheetName]

          const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, {
            defval: '',
            raw: false,
          })

          const questionnaireData = convertToQuestionnaireData(jsonData)
          resolve(questionnaireData)
        } catch (error) {
          reject(new Error('文件解析失败：' + (error instanceof Error ? error.message : '未知错误')))
        }
      }

      reader.onerror = () => {
        reject(new Error('文件读取失败'))
      }

      reader.readAsBinaryString(file)
    })
  }

  const convertToQuestionnaireData = (jsonData: any[]): any => {
    const answers: Record<string, any> = {}
    let totalScore = 0
    let maxScore = 0

    const firstRow = jsonData[0] || {}
    const questionIdKeys = ['Question ID', 'question_id', 'questionId', '问题ID', '题目ID', 'ID', 'id']
    const selectedOptionKeys = ['Selected Option', 'selected_option', 'selectedOption', 'Option ID', 'option_id', '选择的选项', '选项ID', '选项', 'Answer', 'answer']
    const scoreKeys = ['Score', 'score', '得分', '分数', '分值']

    const questionIdKey = questionIdKeys.find(key => key in firstRow)
    const selectedOptionKey = selectedOptionKeys.find(key => key in firstRow)
    const scoreKey = scoreKeys.find(key => key in firstRow)

    if (!questionIdKey || !selectedOptionKey) {
      throw new Error('CSV格式不正确，必须包含问题ID和选项列。请检查文件格式。')
    }

    const calculateScoreFromOption = (optionId: string): { score: number; options: string[] } => {
      const optionScores: Record<string, number> = {
        'A': 5, 'B': 4, 'C': 3, 'D': 2, 'E': 1,
        'a': 5, 'b': 4, 'c': 3, 'd': 2, 'e': 1,
      }

      if (optionId.includes('、') || optionId.includes(',') || optionId.includes(' ')) {
        const options = optionId.split(/[、, ]+/).filter(o => o.trim())
        const sum = options.reduce((acc, opt) => acc + (optionScores[opt.trim()] || 0), 0)
        const score = Math.round(sum / options.length)
        return { score, options }
      }

      const score = optionScores[optionId] || 0
      return { score, options: [optionId] }
    }

    jsonData.forEach((row: any) => {
      const questionId = row[questionIdKey]
      const selectedOption = row[selectedOptionKey]
      let score = 0
      let options: string[] = []

      if (!questionId || !selectedOption) {
        return
      }

      if (scoreKey) {
        const scoreValue = row[scoreKey]
        score = parseFloat(scoreValue) || 0
        options = [selectedOption]
      } else {
        const result = calculateScoreFromOption(selectedOption)
        score = result.score
        options = result.options
      }

      answers[questionId] = {
        answer: options.length > 1 ? options : options[0],
        score,
      }
      totalScore += score
      maxScore += 5
    })

    return {
      respondentInfo: {
        name: '导出的问卷填写人',
        department: '',
        position: '',
        submittedAt: new Date().toISOString(),
      },
      answers,
      totalScore,
      maxScore,
    }
  }

  const handleDownloadTemplate = () => {
    const template = [
      ['Question ID', 'Selected Option'],
      ['Q001', 'A'],
      ['Q002', 'B'],
      ['Q003', 'C'],
      ['Q004', 'A、C'],
      ['', ''],
      ['', ''],
      ['', '说明：'],
      ['', '1. Question ID: 问题ID（从问卷中获取）'],
      ['', '2. Selected Option: 选择的选项（A=5分, B=4分, C=3分, D=2分, E=1分）'],
      ['', '3. 支持多选，用顿号或逗号分隔，如 A、C 或 A,C'],
      ['', '4. Score列可选，不填会自动计算'],
    ]

    const csvContent = template.map((row) => row.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `questionnaire_answers_template.csv`
    link.click()
    URL.revokeObjectURL(url)
    message.success('模板已下载！')
  }

  const handleGenerateActionPlan = () => {
    setModalVisible(true)
  }

  const handleExportPDF = () => {
    if (!analysis) {
      message.warning('请先完成差距分析')
      return
    }
    setReportModalVisible(true)
  }

  const handlePrintReport = () => {
    const originalTitle = document.title
    const filename = generatePDFFilename(`项目 ${projectId}`)
    document.title = filename.replace('.pdf', '')
    window.print()
    setTimeout(() => {
      document.title = originalTitle
    }, 100)
  }

  const handleConfirmTarget = () => {
    if (!analysis) return

    if (targetMaturity <= analysis.overall.maturityLevel) {
      message.warning(`目标成熟度（${targetMaturity.toFixed(1)}）应高于当前成熟度（${analysis.overall.maturityLevel.toFixed(2)}）`)
      return
    }

    router.push(`/projects/${projectId}/action-plan?surveyResponseId=${analysis.surveyResponseId}&targetMaturity=${targetMaturity}`)
    setModalVisible(false)
  }

  return (
    <main className="max-w-[1920px] mx-auto px-6 py-8">
      <header className="flex items-start justify-between mb-8">
        <div>
          <Typography variant="h4" component="h1" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <BarChart className="text-purple-600" />
            差距分析
          </Typography>
          <Typography variant="body2" color="text.secondary">
            上传问卷答案JSON文件，自动进行成熟度差距分析
          </Typography>
        </div>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            startIcon={<ArrowBack />}
            onClick={() => router.back()}
          >
            返回
          </Button>
          {analysis && (
            <>
              <Button
                startIcon={<UploadFile />}
                onClick={handleReupload}
              >
                重新上传
              </Button>
              <Button
                startIcon={<PictureAsPdf />}
                onClick={handleExportPDF}
              >
                导出 PDF 报告
              </Button>
              <Button
                variant="contained"
                startIcon={<Rocket />}
                onClick={handleGenerateActionPlan}
              >
                生成改进措施
              </Button>
            </>
          )}
        </Box>
      </header>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          <AlertTitle>错误</AlertTitle>
          {error}
        </Alert>
      )}

      {!analysis && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <UploadFile sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" sx={{ mb: 1 }}>上传问卷答案</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                请上传包含问卷答案的CSV或Excel文件，系统将进行差距分析
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                <Button
                  variant="outlined"
                  startIcon={<Download />}
                  onClick={handleDownloadTemplate}
                >
                  下载答案模板
                </Button>
                {parsedData && (
                  <Button
                    variant="contained"
                    startIcon={<BarChart />}
                    onClick={handleStartAnalysis}
                    disabled={loading}
                  >
                    {loading ? '分析中...' : '开始分析'}
                  </Button>
                )}
              </Box>
            </Box>

            <Box
              sx={{
                border: '2px dashed',
                borderColor: 'divider',
                borderRadius: 2,
                p: 4,
                textAlign: 'center',
                mb: 2,
              }}
            >
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
                id="file-upload"
              />
              <label htmlFor="file-upload">
                <Button component="span" startIcon={<UploadFile />}>
                  点击上传文件
                </Button>
              </label>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                支持 CSV 或 Excel (.xlsx, .xls) 格式的问卷答案文件
              </Typography>
            </Box>

            {parsedData && (
              <Alert severity="success" sx={{ mb: 2 }}>
                文件已就绪 - 已解析 {Object.keys(parsedData.answers || {}).length} 个问题答案，总分：{parsedData.totalScore || 0} / {parsedData.maxScore || 0}
              </Alert>
            )}

            <Alert severity="info">
              <AlertTitle>文件格式说明</AlertTitle>
              <Typography variant="body2">
                CSV/Excel文件应包含以下列：Question ID（问题ID）、Selected Option（选择的选项ID）、Score（该选项的得分，可选）
              </Typography>
            </Alert>
          </CardContent>
        </Card>
      )}

      {loading && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Skeleton variant="rectangular" height={200} />
          <Typography sx={{ mt: 2 }}>正在进行差距分析...</Typography>
        </Box>
      )}

      {analysis && !loading && (
        <>
          <Alert
            severity={analysis.conflicts.hasConflict ? getSeverityType(analysis.conflicts.severity) : 'success'}
            sx={{ mb: 3 }}
          >
            {analysis.conflicts.hasConflict
              ? `检测到 ${analysis.conflicts.conflictCount} 个冲突项 (严重程度: ${analysis.conflicts.severity})`
              : '冲突检测：无冲突'}
          </Alert>

          <Card sx={{ mb: 3 }}>
            <CardHeader title="总体成熟度" />
            <CardContent>
              <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h2" color="primary">
                      {analysis.overall.maturityLevel.toFixed(2)}
                      <Typography component="span" variant="h6" color="text.secondary"> / 5.0</Typography>
                    </Typography>
                    <Chip
                      label={analysis.overall.grade}
                      color={getGradeColor(analysis.overall.grade)}
                      sx={{ mt: 2 }}
                    />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                      {analysis.overall.description}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} md={8}>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2">计算公式</Typography>
                    <code>{analysis.overall.calculation.formula}</code>
                  </Box>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2">总得分: <strong>{analysis.overall.calculation.totalScore}</strong></Typography>
                  </Box>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2">满分: <strong>{analysis.overall.calculation.maxScore}</strong></Typography>
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

          <MaturityRadarChart
            data={mapToRadarData(analysis.dimensionMaturity)}
            title="各维度成熟度分布"
            height={400}
            showLegend={true}
          />

          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} lg={6}>
              <Card>
                <CardHeader
                  title="TOP 5 短板"
                  sx={{ color: 'error.main' }}
                  avatar={<TrendingDown color="error" />}
                />
                <CardContent>
                  {analysis.topShortcomings.map((item) => (
                    <Box key={item.rank} sx={{ mb: 2, pb: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip label={item.rank} color="error" size="small" />
                        <Box>
                          <Typography variant="body1" fontWeight="bold">{item.cluster_name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            成熟度: {item.maturityLevel.toFixed(2)} (差距: {item.gap.toFixed(2)})
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  ))}
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} lg={6}>
              <Card>
                <CardHeader
                  title="TOP 5 优势"
                  sx={{ color: 'success.main' }}
                  avatar={<TrendingUp color="success" />}
                />
                <CardContent>
                  {analysis.topStrengths.map((item) => (
                    <Box key={item.rank} sx={{ mb: 2, pb: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip label={item.rank} color="success" size="small" />
                        <Box>
                          <Typography variant="body1" fontWeight="bold">{item.cluster_name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            成熟度: {item.maturityLevel.toFixed(2)} (优势: {item.advantage.toFixed(2)})
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  ))}
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Card sx={{ mb: 3 }}>
            <CardHeader title="统计信息" avatar={<Info />} />
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={6} sm={3}>
                  <Typography variant="body2" color="text.secondary">总问题数</Typography>
                  <Typography variant="h6">{analysis.statistics.totalQuestions}</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="body2" color="text.secondary">总聚类数</Typography>
                  <Typography variant="h6">{analysis.statistics.totalClusters}</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="body2" color="text.secondary">平均聚类成熟度</Typography>
                  <Typography variant="h6">{analysis.statistics.averageClusterMaturity.toFixed(2)}</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="body2" color="text.secondary">成熟度标准差</Typography>
                  <Typography variant="h6">{analysis.statistics.clusterMaturityStdDev.toFixed(2)}</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title={`各聚类详细成熟度 (${analysis.clusterMaturity.length}个)`} avatar={<EmojiEvents />} />
            <CardContent>
              {analysis.clusterMaturity.map((cluster) => (
                <Accordion key={cluster.cluster_id}>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography fontWeight="bold">{cluster.cluster_name}</Typography>
                        <Chip label={cluster.grade} color={getGradeColor(cluster.grade)} size="small" />
                        {cluster.isShortcoming && <Chip label="短板" color="error" size="small" />}
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        成熟度: {cluster.maturityLevel.toFixed(2)} | 维度: {cluster.dimension} | 问题数: {cluster.questionsCount}
                      </Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Typography variant="subtitle2" sx={{ mb: 2 }}>问题详情</Typography>
                    {cluster.questions.map((question, idx) => (
                      <Box
                        key={question.question_id}
                        sx={{
                          mb: 1.5,
                          p: 1.5,
                          bgcolor: 'action.hover',
                          borderRadius: 1,
                          borderLeft: 3,
                          borderColor: 'primary.main',
                        }}
                      >
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Chip label={idx + 1} size="small" />
                          <Box>
                            <Typography variant="body2">{question.question_text}</Typography>
                            <Typography variant="caption" color="primary">
                              选择: {question.selected_option_text || '未选择'}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
                              <Typography variant="caption" color="text.secondary">
                                得分: {question.score}/5
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                等级: Level {question.level}
                              </Typography>
                            </Box>
                          </Box>
                        </Box>
                      </Box>
                    ))}
                  </AccordionDetails>
                </Accordion>
              ))}
            </CardContent>
          </Card>

          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Button variant="outlined" startIcon={<Print />} onClick={() => window.print()} sx={{ mr: 1 }}>
              打印报告
            </Button>
            <Button
              variant="contained"
              startIcon={<Rocket />}
              onClick={handleGenerateActionPlan}
            >
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
                <Typography variant="body2">
                  总体成熟度: {analysis?.overall.maturityLevel.toFixed(2)} ({analysis?.overall.grade})
                </Typography>
              </Alert>

              <Typography variant="subtitle2" sx={{ mb: 1 }}>选择目标成熟度等级:</Typography>
              <RadioGroup
                value={targetMaturity}
                onChange={(e) => setTargetMaturity(Number(e.target.value))}
              >
                {[3, 4, 5].map((level) => {
                  const disabled = analysis ? level <= analysis.overall.maturityLevel : false
                  const levelNames: Record<number, string> = {
                    3: '充分规范级',
                    4: '系统优化级',
                    5: '卓越级',
                  }
                  return (
                    <FormControlLabel
                      key={level}
                      value={level}
                      control={<Radio />}
                      disabled={disabled}
                      label={
                        <Box>
                          <Typography variant="body1">
                            Level {level} - {levelNames[level]}
                            {disabled && <Chip label="已达成" size="small" sx={{ ml: 1 }} />}
                          </Typography>
                        </Box>
                      }
                    />
                  )
                })}
              </RadioGroup>

              <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>或自定义目标成熟度:</Typography>
              <TextField
                type="number"
                inputProps={{ min: analysis ? analysis.overall.maturityLevel + 0.1 : 1, max: 5, step: 0.1 }}
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

          <Dialog open={reportModalVisible} onClose={() => setReportModalVisible(false)} maxWidth="lg" fullWidth>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PictureAsPdf color="error" />
                差距分析报告预览
              </Box>
            </DialogTitle>
            <DialogContent>
              {analysis && (
                <Box sx={{ maxHeight: '70vh', overflow: 'auto' }}>
                  <GapAnalysisReport
                    data={{
                      projectName: `项目 ${projectId}`,
                      reportDate: formatReportDate(),
                      overall: analysis.overall,
                      dimensionMaturity: analysis.dimensionMaturity,
                      clusterMaturity: analysis.clusterMaturity,
                      topShortcomings: analysis.topShortcomings,
                      topStrengths: analysis.topStrengths,
                      targetMaturity,
                    }}
                    showCover={true}
                  />
                </Box>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setReportModalVisible(false)}>关闭</Button>
              <Button variant="contained" startIcon={<Print />} onClick={handlePrintReport}>
                打印 / 保存为 PDF
              </Button>
            </DialogActions>
          </Dialog>
        </>
      )}
    </main>
  )
}
