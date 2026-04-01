'use client'

export const dynamic = 'force-dynamic'

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  Card,
  CardContent,
  CardHeader,
  Button,
  Badge,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui'
import {
  ArrowLeft,
  Printer,
  BarChart3,
  TrendingDown,
  Rocket,
  Lightbulb,
  Trophy,
  AlertTriangle,
  CheckCircle,
  Info,
} from 'lucide-react'
import { SurveyAPI } from '@/lib/api/survey'
import { message } from '@/lib/message'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'

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

  const getErrorMessage = (error: unknown, fallback: string) =>
    error instanceof Error && error.message ? error.message : fallback

  const fetchAnalysis = useCallback(async () => {
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
    } catch (err) {
      console.error('分析失败:', err)
      const errorMessage = getErrorMessage(err, '加载成熟度分析失败')
      setError(errorMessage)
      message.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [surveyId])

  useEffect(() => {
    if (!surveyId) {
      setError('缺少问卷ID参数')
      setLoading(false)
      return
    }

    void fetchAnalysis()
  }, [fetchAnalysis, surveyId])

  const getGradeColor = (grade: string): string => {
    if (grade.includes('卓越级')) return 'bg-purple-600 text-white'
    if (grade.includes('系统优化级')) return 'bg-[#1E3A5F] text-white'
    if (grade.includes('充分规范级')) return 'bg-[#059669] text-white'
    if (grade.includes('初步规范级')) return 'bg-yellow-600 text-white'
    return 'bg-red-600 text-white'
  }

  const getSeverityVariant = (severity: string): 'default' | 'destructive' | 'outline' => {
    switch (severity) {
      case 'HIGH':
        return 'destructive'
      case 'MEDIUM':
        return 'default'
      case 'LOW':
        return 'outline'
      default:
        return 'outline'
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
      <div className="text-center py-8 bg-[#FEFDFB]">
        <Skeleton className="h-48 w-full max-w-4xl mx-auto bg-[#E2E8F0]" />
        <p className="mt-2 text-[#94A3B8]">正在分析成熟度...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto p-6 bg-[#FEFDFB]">
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-sm mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span className="font-semibold">错误</span>
          </div>
          <p className="mt-1">{error}</p>
        </div>
        <Button variant="outline" onClick={() => router.back()} className="rounded-sm">
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回
        </Button>
      </div>
    )
  }

  if (!analysis) {
    return (
      <div className="max-w-6xl mx-auto p-6 bg-[#FEFDFB]">
        <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-sm">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-[#94A3B8]" />
            <p className="text-[#94A3B8]">未找到分析结果</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-6 bg-[#FEFDFB] min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#1E3A5F] font-[var(--font-plus-jakarta)]">
            成熟度分析报告
          </h1>
          <p className="text-sm text-[#94A3B8] mt-1">
            调研对象: {analysis.respondentInfo.name}
            {analysis.respondentInfo.department && ` - ${analysis.respondentInfo.department}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.back()} className="rounded-sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回
          </Button>
          <Button variant="outline" onClick={() => window.print()} className="rounded-sm">
            <Printer className="w-4 h-4 mr-2" />
            打印报告
          </Button>
        </div>
      </div>

      {/* Conflict Alert */}
      <div
        className={`mb-6 p-4 rounded-sm border ${
          analysis.conflicts.hasConflict
            ? 'border-red-200 bg-red-50 text-red-800'
            : 'border-[#059669] bg-[#F0FDF4] text-[#059669]'
        }`}
      >
        <div className="flex items-center gap-2">
          {analysis.conflicts.hasConflict ? (
            <>
              <AlertTriangle className="h-4 w-4" />
              <p>检测到 {analysis.conflicts.conflictCount} 个冲突项</p>
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4" />
              <p>冲突检测：无冲突</p>
            </>
          )}
        </div>
      </div>

      {/* 总体成熟度 */}
      <Card className="mb-6 border-[#E2E8F0] rounded-sm shadow-sm">
        <CardHeader className="flex flex-row items-center gap-3 pb-4">
          <BarChart3 className="w-6 h-6 text-[#1E3A5F]" />
          <h2 className="text-xl font-semibold text-[#1E3A5F] font-[var(--font-plus-jakarta)]">
            总体成熟度
          </h2>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* 成熟度分数 */}
            <div className="md:col-span-4 text-center">
              <div className="text-5xl font-bold text-[#1E3A5F]">
                {analysis.overall.maturityLevel.toFixed(2)}
                <span className="text-xl text-[#94A3B8]"> / 5.0</span>
              </div>
              <Badge className={`mt-4 rounded-sm ${getGradeColor(analysis.overall.grade)}`}>
                {analysis.overall.grade}
              </Badge>
              <p className="text-sm text-[#94A3B8] mt-4">{analysis.overall.description}</p>
            </div>
            {/* 进度条和公式 */}
            <div className="md:col-span-8 space-y-4">
              <div>
                <p className="text-sm text-[#94A3B8] mb-2">计算公式: <code className="bg-[#E2E8F0] px-2 py-1 rounded-sm">{analysis.overall.calculation.formula}</code></p>
              </div>
              <Progress
                value={getMaturityProgress(analysis.overall.maturityLevel)}
                className="h-3 rounded-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* TOP 5 短板和优势 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* TOP 5 短板 */}
        <Card className="border-[#E2E8F0] rounded-sm shadow-sm">
          <CardHeader className="flex flex-row items-center gap-3 pb-4">
            <TrendingDown className="w-5 h-5 text-red-600" />
            <h3 className="text-lg font-semibold text-red-600 font-[var(--font-plus-jakarta)]">
              TOP 5 短板
            </h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analysis.topShortcomings.map((item) => (
                <div key={item.rank} className="pb-3 border-b border-[#E2E8F0] last:border-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive" className="rounded-sm">{item.rank}</Badge>
                    <div>
                      <p className="font-semibold text-[#1E3A5F]">{item.cluster_name}</p>
                      <p className="text-xs text-[#94A3B8]">成熟度: {item.maturityLevel.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* TOP 5 优势 */}
        <Card className="border-[#E2E8F0] rounded-sm shadow-sm">
          <CardHeader className="flex flex-row items-center gap-3 pb-4">
            <Trophy className="w-5 h-5 text-[#059669]" />
            <h3 className="text-lg font-semibold text-[#059669] font-[var(--font-plus-jakarta)]">
              TOP 5 优势
            </h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analysis.topStrengths.map((item) => (
                <div key={item.rank} className="pb-3 border-b border-[#E2E8F0] last:border-0">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-[#059669] text-white rounded-sm">{item.rank}</Badge>
                    <div>
                      <p className="font-semibold text-[#1E3A5F]">{item.cluster_name}</p>
                      <p className="text-xs text-[#94A3B8]">成熟度: {item.maturityLevel.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 生成改进措施按钮 */}
      <div className="text-center mt-8">
        <Button
          onClick={handleGenerateActionPlan}
          className="bg-[#1E3A5F] hover:bg-[#162e4d] text-white rounded-sm"
          size="lg"
        >
          <Rocket className="w-4 h-4 mr-2" />
          生成改进措施
        </Button>
      </div>

      {/* 目标成熟度设置对话框 */}
      <Dialog open={modalVisible} onOpenChange={setModalVisible}>
        <DialogContent className="rounded-sm max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-[#1E3A5F]" />
              <DialogTitle className="text-[#1E3A5F] font-[var(--font-plus-jakarta)]">
                设置改进目标
              </DialogTitle>
            </div>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-sm flex items-center gap-3">
              <Info className="h-4 w-4 text-[#94A3B8]" />
              <p className="text-sm text-[#94A3B8]">
                总体成熟度: {analysis?.overall.maturityLevel.toFixed(2)} ({analysis?.overall.grade})
              </p>
            </div>

            <div>
              <Label className="text-sm text-[#1E3A5F] mb-2 block">选择目标成熟度等级:</Label>
              <RadioGroup value={targetMaturity.toString()} onValueChange={(v) => setTargetMaturity(Number(v))}>
                {[3, 4, 5].map((level) => {
                  const disabled = analysis ? level <= analysis.overall.maturityLevel : false
                  const levelNames: Record<number, string> = { 3: '充分规范级', 4: '系统优化级', 5: '卓越级' }
                  return (
                    <div key={level} className="flex items-center space-x-2">
                      <RadioGroupItem value={level.toString()} id={`level-${level}`} disabled={disabled} />
                      <Label htmlFor={`level-${level}`} className={`flex items-center gap-2 ${disabled ? 'text-[#94A3B8]' : ''}`}>
                        <span>Level {level} - {levelNames[level]}</span>
                        {disabled && <Badge variant="outline" className="rounded-sm text-xs">已达成</Badge>}
                      </Label>
                    </div>
                  )
                })}
              </RadioGroup>
            </div>

            <div>
              <Label htmlFor="custom-target" className="text-sm text-[#1E3A5F] mb-2 block">或自定义目标成熟度:</Label>
              <input
                id="custom-target"
                type="number"
                value={targetMaturity}
                onChange={(e) => setTargetMaturity(Number(e.target.value))}
                className="w-48 px-3 py-2 border border-[#E2E8F0] rounded-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalVisible(false)} className="rounded-sm">
              取消
            </Button>
            <Button onClick={handleConfirmTarget} className="bg-[#1E3A5F] hover:bg-[#162e4d] text-white rounded-sm">
              开始生成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
