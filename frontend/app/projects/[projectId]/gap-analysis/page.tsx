'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Info,
  Rocket,
  Lightbulb,
  Upload,
  Download,
  Trophy,
  FileText,
  CheckCircle,
  ChevronDown,
  ArrowLeft,
  Printer,
  User,
  Building2,
  Briefcase,
  Calendar,
  PieChart,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
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

  const getGradeColor = (grade: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    if (grade.includes('卓越级')) return 'secondary'
    if (grade.includes('系统优化级')) return 'default'
    if (grade.includes('充分规范级')) return 'outline'
    if (grade.includes('初步规范级')) return 'outline'
    return 'destructive'
  }

  const getGradeClassName = (grade: string): string => {
    if (grade.includes('卓越级')) return 'bg-purple-100 text-purple-800 hover:bg-purple-100'
    if (grade.includes('系统优化级')) return 'bg-blue-100 text-blue-800 hover:bg-blue-100'
    if (grade.includes('充分规范级')) return 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100'
    if (grade.includes('初步规范级')) return 'bg-amber-100 text-amber-800 hover:bg-amber-100'
    return 'bg-red-100 text-red-800 hover:bg-red-100'
  }

  const getSeverityType = (severity: string): 'destructive' | 'default' => {
    switch (severity) {
      case 'HIGH':
        return 'destructive'
      case 'MEDIUM':
      case 'LOW':
        return 'default'
      default:
        return 'default'
    }
  }

  const getSeverityClassName = (severity: string): string => {
    switch (severity) {
      case 'HIGH':
        return 'border-red-500 text-red-800 bg-red-50'
      case 'MEDIUM':
        return 'border-amber-500 text-amber-800 bg-amber-50'
      case 'LOW':
        return 'border-blue-500 text-blue-800 bg-blue-50'
      default:
        return 'border-slate-500 text-slate-800 bg-slate-50'
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
    <main className="w-full px-6 py-8">
      {/* 渐变头部 */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#667eea] to-[#764ba2] p-8 mb-8">
        {/* 装饰性径向渐变 */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.1)_0%,transparent_50%)]" />

        <div className="relative flex items-start justify-between">
          <div className="flex items-center gap-4">
            {/* 毛玻璃图标背景 */}
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">差距分析</h1>
              <p className="text-sm text-white/80">上传问卷答案文件，自动进行成熟度差距分析</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => router.back()}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回
            </Button>
            {analysis && (
              <>
                <Button
                  onClick={handleReupload}
                  className="bg-white/10 border border-white/20 text-white hover:bg-white/20 hover:text-white"
                >
                  重新上传
                </Button>
                <Button
                  onClick={handleExportPDF}
                  className="bg-white/10 border border-white/20 text-white hover:bg-white/20 hover:text-white"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  导出 PDF 报告
                </Button>
                <Button
                  onClick={handleGenerateActionPlan}
                  className="bg-white text-indigo-600 hover:bg-white/90"
                >
                  <Rocket className="w-4 h-4 mr-2" />
                  生成改进措施
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>错误</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!analysis && (
        <Card className="border-0 shadow-[0_4px_6px_-1px_rgba(99,102,241,0.1),0_2px_4px_-1px_rgba(99,102,241,0.06)] mb-6">
          <CardContent className="p-6">
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <Upload className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">上传问卷答案</h3>
              <p className="text-sm text-slate-500 mb-6">
                请上传包含问卷答案的CSV或Excel文件，系统将进行差距分析
              </p>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={handleDownloadTemplate}>
                  <Download className="w-4 h-4 mr-2" />
                  下载答案模板
                </Button>
                {parsedData && (
                  <Button
                    onClick={handleStartAnalysis}
                    disabled={loading}
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
                  >
                    <BarChart3 className="w-4 h-4 mr-2" />
                    {loading ? '分析中...' : '开始分析'}
                  </Button>
                )}
              </div>
            </div>

            <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center mb-4">
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <Button variant="outline" className="pointer-events-none" asChild>
                  <span>
                    <Upload className="w-4 h-4 mr-2" />
                    点击上传文件
                  </span>
                </Button>
              </label>
              <p className="text-sm text-slate-500 mt-2">
                支持 CSV 或 Excel (.xlsx, .xls) 格式的问卷答案文件
              </p>
            </div>

            {parsedData && (
              <Alert className="mb-4 border-emerald-500 bg-emerald-50">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <AlertDescription className="text-emerald-800">
                  文件已就绪 - 已解析 {Object.keys(parsedData.answers || {}).length} 个问题答案，总分：{parsedData.totalScore || 0} / {parsedData.maxScore || 0}
                </AlertDescription>
              </Alert>
            )}

            <Alert>
              <Info className="w-4 h-4" />
              <AlertTitle>文件格式说明</AlertTitle>
              <AlertDescription>
                CSV/Excel文件应包含以下列：Question ID（问题ID）、Selected Option（选择的选项ID）、Score（该选项的得分，可选）
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {loading && (
        <div className="text-center py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-48 bg-slate-200 rounded-lg"></div>
            <p className="text-slate-500">正在进行差距分析...</p>
          </div>
        </div>
      )}

      {analysis && !loading && (
        <>
          <Alert
            variant={analysis.conflicts.hasConflict ? getSeverityType(analysis.conflicts.severity) : 'default'}
            className={`mb-6 ${analysis.conflicts.hasConflict ? getSeverityClassName(analysis.conflicts.severity) : 'border-emerald-500 bg-emerald-50 text-emerald-800'}`}
          >
            <AlertDescription>
              {analysis.conflicts.hasConflict
                ? `检测到 ${analysis.conflicts.conflictCount} 个冲突项 (严重程度: ${analysis.conflicts.severity})`
                : '冲突检测：无冲突'}
            </AlertDescription>
          </Alert>

          {/* 受访者信息 */}
          {analysis.respondentInfo && (
            <Card className="border-0 shadow-sm mb-6">
              <CardHeader className="flex flex-row items-center gap-2">
                <User className="w-5 h-5 text-indigo-500" />
                <CardTitle>受访者信息</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                      <User className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">姓名</p>
                      <p className="text-sm font-medium text-slate-900">{analysis.respondentInfo.name || '未填写'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">部门</p>
                      <p className="text-sm font-medium text-slate-900">{analysis.respondentInfo.department || '未填写'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                      <Briefcase className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">职位</p>
                      <p className="text-sm font-medium text-slate-900">{analysis.respondentInfo.position || '未填写'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">提交时间</p>
                      <p className="text-sm font-medium text-slate-900">
                        {analysis.respondentInfo.submittedAt
                          ? new Date(analysis.respondentInfo.submittedAt).toLocaleString('zh-CN')
                          : '未知'}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-0 shadow-sm mb-6">
            <CardHeader>
              <CardTitle>总体成熟度</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-4xl font-bold text-indigo-600 mb-2">
                    {analysis.overall.maturityLevel.toFixed(2)}
                    <span className="text-xl text-slate-400"> / 5.0</span>
                  </div>
                  <Badge className={getGradeClassName(analysis.overall.grade)}>
                    {analysis.overall.grade}
                  </Badge>
                  <p className="text-sm text-slate-500 mt-2">
                    {analysis.overall.description}
                  </p>
                </div>
                <div className="md:col-span-2 space-y-3">
                  <div>
                    <p className="text-sm text-slate-500 mb-1">计算公式</p>
                    <code className="text-sm bg-slate-100 px-2 py-1 rounded">{analysis.overall.calculation.formula}</code>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">总得分: <strong className="text-slate-900">{analysis.overall.calculation.totalScore}</strong></p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">满分: <strong className="text-slate-900">{analysis.overall.calculation.maxScore}</strong></p>
                  </div>
                  <Progress
                    value={getMaturityProgress(analysis.overall.maturityLevel)}
                    className="h-2"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 成熟度分布 */}
          {analysis.distribution && (
            <Card className="border-0 shadow-sm mb-6">
              <CardHeader className="flex flex-row items-center gap-2">
                <PieChart className="w-5 h-5 text-indigo-500" />
                <CardTitle>成熟度等级分布</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { level: 5, label: '卓越级 (Level 5)', count: analysis.distribution.level_5, color: 'bg-purple-500', textColor: 'text-purple-600' },
                    { level: 4, label: '系统优化级 (Level 4)', count: analysis.distribution.level_4, color: 'bg-blue-500', textColor: 'text-blue-600' },
                    { level: 3, label: '充分规范级 (Level 3)', count: analysis.distribution.level_3, color: 'bg-emerald-500', textColor: 'text-emerald-600' },
                    { level: 2, label: '初步规范级 (Level 2)', count: analysis.distribution.level_2, color: 'bg-amber-500', textColor: 'text-amber-600' },
                    { level: 1, label: '初始级 (Level 1)', count: analysis.distribution.level_1, color: 'bg-red-500', textColor: 'text-red-600' },
                  ].map((item) => {
                    const total = analysis.statistics.totalQuestions || 1
                    const percentage = total > 0 ? (item.count / total) * 100 : 0
                    return (
                      <div key={item.level} className="flex items-center gap-4">
                        <div className="w-32 text-sm font-medium text-slate-700">{item.label}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
                              <div
                                className={`${item.color} h-full transition-all duration-500`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <span className={`text-sm font-semibold ${item.textColor} w-12`}>
                              {item.count}题
                            </span>
                            <span className="text-xs text-slate-400 w-12">
                              {percentage.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between text-sm text-slate-500">
                  <span>总题数: {analysis.statistics.totalQuestions}题</span>
                  <span>
                    主要集中: Level {
                      Object.entries(analysis.distribution)
                        .sort(([,a], [,b]) => (b as number) - (a as number))[0][0]
                        .replace('level_', '')
                    }
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          <MaturityRadarChart
            data={mapToRadarData(analysis.dimensionMaturity)}
            title="各维度成熟度分布"
            height={400}
            showLegend={true}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 my-6">
            <Card className="border-0 shadow-sm">
              <CardHeader className="flex flex-row items-center gap-2">
                <TrendingDown className="w-5 h-5 text-red-500" />
                <CardTitle className="text-red-600">TOP 5 短板</CardTitle>
              </CardHeader>
              <CardContent>
                {analysis.topShortcomings.map((item) => (
                  <div key={item.rank} className="mb-3 pb-3 border-b border-slate-100 last:border-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive">{item.rank}</Badge>
                      <div>
                        <p className="font-semibold text-slate-900">{item.cluster_name}</p>
                        <p className="text-xs text-slate-500">
                          成熟度: {item.maturityLevel.toFixed(2)} (差距: {item.gap.toFixed(2)})
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardHeader className="flex flex-row items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
                <CardTitle className="text-emerald-600">TOP 5 优势</CardTitle>
              </CardHeader>
              <CardContent>
                {analysis.topStrengths.map((item) => (
                  <div key={item.rank} className="mb-3 pb-3 border-b border-slate-100 last:border-0">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">{item.rank}</Badge>
                      <div>
                        <p className="font-semibold text-slate-900">{item.cluster_name}</p>
                        <p className="text-xs text-slate-500">
                          成熟度: {item.maturityLevel.toFixed(2)} (优势: {item.advantage.toFixed(2)})
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card className="border-0 shadow-sm mb-6">
            <CardHeader className="flex flex-row items-center gap-2">
              <Info className="w-5 h-5 text-indigo-500" />
              <CardTitle>统计信息</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-slate-500">总问题数</p>
                  <p className="text-xl font-semibold text-slate-900">{analysis.statistics.totalQuestions}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">总聚类数</p>
                  <p className="text-xl font-semibold text-slate-900">{analysis.statistics.totalClusters}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">平均聚类成熟度</p>
                  <p className="text-xl font-semibold text-slate-900">{analysis.statistics.averageClusterMaturity.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">成熟度标准差</p>
                  <p className="text-xl font-semibold text-slate-900">{analysis.statistics.clusterMaturityStdDev.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm mb-6">
            <CardHeader className="flex flex-row items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              <CardTitle>各聚类详细成熟度 ({analysis.clusterMaturity.length}个)</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full">
                {analysis.clusterMaturity.map((cluster, index) => (
                  <AccordionItem key={cluster.cluster_id} value={cluster.cluster_id}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900">{cluster.cluster_name}</span>
                          <Badge className={getGradeClassName(cluster.grade)}>{cluster.grade}</Badge>
                          {cluster.isShortcoming && <Badge variant="destructive">短板</Badge>}
                        </div>
                        <span className="text-xs text-slate-500">
                          成熟度: {cluster.maturityLevel.toFixed(2)} | 维度: {cluster.dimension} | 问题数: {cluster.questionsCount}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <p className="text-sm font-medium text-slate-900 mb-3">问题详情</p>
                      {cluster.questions.map((question, idx) => (
                        <div
                          key={question.question_id}
                          className="mb-2 p-3 bg-slate-50 rounded-lg border-l-4 border-indigo-500"
                        >
                          <div className="flex gap-2">
                            <Badge variant="outline">{idx + 1}</Badge>
                            <div className="flex-1">
                              <p className="text-sm text-slate-700">{question.question_text}</p>
                              <p className="text-xs text-indigo-600 mt-1">
                                选择: {question.selected_option_text || '未选择'}
                              </p>
                              <div className="flex gap-4 mt-1">
                                <span className="text-xs text-slate-500">
                                  得分: {question.score}/5
                                </span>
                                <span className="text-xs text-slate-500">
                                  等级: Level {question.level}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>

          <div className="flex justify-center gap-2 mt-6">
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-2" />
              打印报告
            </Button>
            <Button
              onClick={handleGenerateActionPlan}
              className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
            >
              <Rocket className="w-4 h-4 mr-2" />
              生成改进措施
            </Button>
          </div>

          {/* 目标成熟度设置对话框 */}
          <Dialog open={modalVisible} onOpenChange={setModalVisible}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-indigo-500" />
                  设置改进目标
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Alert>
                  <AlertDescription>
                    总体成熟度: {analysis?.overall.maturityLevel.toFixed(2)} ({analysis?.overall.grade})
                  </AlertDescription>
                </Alert>

                <div>
                  <Label className="mb-2 block">选择目标成熟度等级:</Label>
                  <RadioGroup
                    value={targetMaturity.toString()}
                    onValueChange={(value) => setTargetMaturity(Number(value))}
                  >
                    {[3, 4, 5].map((level) => {
                      const disabled = analysis ? level <= analysis.overall.maturityLevel : false
                      const levelNames: Record<number, string> = {
                        3: '充分规范级',
                        4: '系统优化级',
                        5: '卓越级',
                      }
                      return (
                        <div key={level} className="flex items-center space-x-2">
                          <RadioGroupItem
                            value={level.toString()}
                            id={`level-${level}`}
                            disabled={disabled}
                          />
                          <Label htmlFor={`level-${level}`} className={disabled ? 'text-slate-400' : ''}>
                            Level {level} - {levelNames[level]}
                            {disabled && <Badge variant="secondary" className="ml-2">已达成</Badge>}
                          </Label>
                        </div>
                      )
                    })}
                  </RadioGroup>
                </div>

                <div>
                  <Label className="mb-2 block">或自定义目标成熟度:</Label>
                  <Input
                    type="number"
                    min={analysis ? analysis.overall.maturityLevel + 0.1 : 1}
                    max={5}
                    step={0.1}
                    value={targetMaturity}
                    onChange={(e) => setTargetMaturity(Number(e.target.value))}
                    className="w-32"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setModalVisible(false)}>
                  取消
                </Button>
                <Button onClick={handleConfirmTarget}>
                  开始生成
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* PDF 报告预览对话框 */}
          <Dialog open={reportModalVisible} onOpenChange={setReportModalVisible}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-red-500" />
                  差距分析报告预览
                </DialogTitle>
              </DialogHeader>
              {analysis && (
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
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setReportModalVisible(false)}>
                  关闭
                </Button>
                <Button onClick={handlePrintReport}>
                  <Printer className="w-4 h-4 mr-2" />
                  打印 / 保存为 PDF
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </main>
  )
}
