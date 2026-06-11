'use client'

/**
 * 调研问卷结果展示组件
 * 展示50-100题问卷，支持题目编辑和覆盖率统计
 */

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { Edit, Save, X, CheckCircle, PieChart, HelpCircle, Download } from 'lucide-react'
import type { GenerationResult } from '@/lib/types/ai-generation'

interface Question {
  question_id: string
  question_template_id?: string | null
  source_question_id?: string | null
  control_id?: string
  cluster_id: string
  cluster_name: string
  question_text: string
  question_type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'RATING' | 'BINARY'
  options: QuestionOption[]
  required: boolean
  guidance: string
  display_order?: number
  scoring_rule?: Record<string, unknown> | null
  is_project_custom?: boolean
  expected_answer?: boolean // 判断题的期望答案
  dimension?: string
}

interface QuestionOption {
  option_id: string
  text: string
  score: number
  level?: string
  description?: string
}

interface QuestionnaireMetadata {
  total_questions: number
  estimated_time_minutes: number
  coverage_map: Record<string, number>
}

interface QuestionnaireResultDisplayProps {
  result: GenerationResult
  editable?: boolean
  questions?: Question[]
  onQuestionsChange?: (questions: Question[]) => void
}

export default function QuestionnaireResultDisplay({
  result,
  editable = true,
  questions: controlledQuestions,
  onQuestionsChange,
}: QuestionnaireResultDisplayProps) {
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null)
  const [editedQuestions, setEditedQuestions] = useState<Question[]>(
    controlledQuestions || result.selectedResult?.questionnaire || []
  )
  const [showCoverageModal, setShowCoverageModal] = useState(false)
  const editBackupRef = useRef<Record<string, Question>>({})

  useEffect(() => {
    setEditedQuestions(controlledQuestions || result.selectedResult?.questionnaire || [])
  }, [controlledQuestions, result.selectedResult?.questionnaire, result.taskId])

  const questions: Question[] = editedQuestions
  const metadata: QuestionnaireMetadata = result.selectedResult?.questionnaire_metadata || {
    total_questions: 0,
    estimated_time_minutes: 0,
    coverage_map: {},
  }

  const commitQuestions = (nextQuestions: Question[]) => {
    setEditedQuestions(nextQuestions)
    onQuestionsChange?.(nextQuestions)
  }

  // 题型统计
  const questionTypeStats = {
    SINGLE_CHOICE: questions.filter((q) => q.question_type === 'SINGLE_CHOICE').length,
    MULTIPLE_CHOICE: questions.filter((q) => q.question_type === 'MULTIPLE_CHOICE').length,
    RATING: questions.filter((q) => q.question_type === 'RATING').length,
    BINARY: questions.filter((q) => q.question_type === 'BINARY').length,
  }

  // 编辑题目
  const handleEditQuestion = (questionId: string) => {
    const currentQuestion = questions.find((question) => question.question_id === questionId)
    if (currentQuestion) {
      editBackupRef.current[questionId] = JSON.parse(JSON.stringify(currentQuestion)) as Question
    }
    setEditingQuestion(questionId)
  }

  // 保存题目编辑
  const handleSaveQuestion = () => {
    if (editingQuestion) {
      delete editBackupRef.current[editingQuestion]
    }
    setEditingQuestion(null)
    toast.success('已更新本地草稿，请点击页面顶部保存')
  }

  // 取消编辑
  const handleCancelEdit = () => {
    if (editingQuestion && editBackupRef.current[editingQuestion]) {
      commitQuestions(
        questions.map((question) =>
          question.question_id === editingQuestion
            ? editBackupRef.current[editingQuestion]
            : question
        )
      )
      delete editBackupRef.current[editingQuestion]
    }
    setEditingQuestion(null)
  }

  // 更新题目文本
  const handleUpdateQuestionText = (questionId: string, newText: string) => {
    commitQuestions(
      questions.map((question) =>
        question.question_id === questionId ? { ...question, question_text: newText } : question
      )
    )
  }

  const handleUpdateRequired = (questionId: string, required: boolean) => {
    commitQuestions(
      questions.map((question) =>
        question.question_id === questionId
          ? {
              ...question,
              required,
              guidance: required
                ? '此题为必答题，请选择最符合当前控制现状的选项。'
                : '请根据项目当前实际情况填写。',
            }
          : question
      )
    )
  }

  const handleUpdateOptionText = (questionId: string, optionId: string, text: string) => {
    commitQuestions(
      questions.map((question) =>
        question.question_id === questionId
          ? {
              ...question,
              options: question.options.map((option) =>
                option.option_id === optionId ? { ...option, text } : option
              ),
            }
          : question
      )
    )
  }

  const handleUpdateOptionScore = (questionId: string, optionId: string, score: string) => {
    const parsedScore = Number(score)
    commitQuestions(
      questions.map((question) =>
        question.question_id === questionId
          ? {
              ...question,
              options: question.options.map((option) =>
                option.option_id === optionId
                  ? {
                      ...option,
                      score: Number.isFinite(parsedScore) ? parsedScore : option.score,
                    }
                  : option
              ),
            }
          : question
      )
    )
  }

  // 导出CSV
  const handleExportCSV = () => {
    try {
      const csvRows: string[] = []
      // CSV表头
      csvRows.push(
        'Question ID,Cluster ID,Cluster Name,Dimension,Question Type,Question Text,Required,Guidance,Option ID,Option Text,Score,Level,Description'
      )

      // 遍历所有题目和选项
      questions.forEach((question) => {
        question.options.forEach((option) => {
          const row = [
            question.question_id,
            question.cluster_id,
            `"${question.cluster_name.replace(/"/g, '""')}"`,
            `"${question.dimension || ''}"`,
            question.question_type,
            `"${question.question_text.replace(/"/g, '""')}"`,
            question.required ? 'Yes' : 'No',
            `"${question.guidance.replace(/"/g, '""')}"`,
            option.option_id,
            `"${option.text.replace(/"/g, '""')}"`,
            option.score,
            option.level || '',
            `"${option.description?.replace(/"/g, '""') || ''}"`,
          ]
          csvRows.push(row.join(','))
        })
      })

      const csvContent = csvRows.join('\n')
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `questionnaire_${result.taskId}.csv`
      link.click()
      URL.revokeObjectURL(url)
      toast.success('问卷已导出为CSV文件！')
    } catch (error) {
      toast.error('导出失败：' + (error instanceof Error ? error.message : '未知错误'))
    }
  }

  // 复制任务ID
  const handleCopyTaskId = () => {
    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(result.taskId)
        .then(() => {
          toast.success('任务ID已复制到剪贴板！')
        })
        .catch(() => {
          toast.error('复制失败，请手动复制')
        })
    } else {
      toast.warning('您的浏览器不支持自动复制，请手动复制任务ID')
    }
  }

  // 渲染题目类型标签
  const renderQuestionTypeTag = (type: string) => {
    const config = {
      SINGLE_CHOICE: {
        color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200',
        text: '单选题',
      },
      MULTIPLE_CHOICE: {
        color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200',
        text: '多选题',
      },
      RATING: {
        color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200',
        text: '评分题',
      },
      BINARY: {
        color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200',
        text: '判断题',
      },
    }
    const { color, text } = config[type as keyof typeof config] || {
      color: 'bg-gray-100 text-gray-700',
      text: type,
    }
    return (
      <Badge className={color} variant="outline">
        {text}
      </Badge>
    )
  }

  // 渲染题目选项
  const renderOptions = (question: Question, isEditing: boolean) => {
    // 判断题类型
    if (question.question_type === 'BINARY') {
      return (
        <div className="space-y-2" aria-disabled="true">
          <div className="p-3 border border-gray-200 dark:border-gray-700 rounded-sm">
            <p className="font-medium">A. 有</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              组织已具备此能力或已实施此要求
            </p>
          </div>
          <div className="p-3 border border-gray-200 dark:border-gray-700 rounded-sm">
            <p className="font-medium">B. 没有</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              组织未具备此能力或未实施此要求
            </p>
          </div>
        </div>
      )
    }

    if (question.question_type === 'SINGLE_CHOICE') {
      return (
        <div className="space-y-2" aria-disabled="true">
          {question.options.map((option) => (
            <div
              key={option.option_id}
              className="flex items-start gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-sm"
            >
              <p className="font-medium">{option.option_id}.</p>
              <div className="flex-1">
                <p className="text-sm">{option.text}</p>
                {option.description && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {option.description}
                  </p>
                )}
                {option.level && (
                  <Badge variant="outline" className="mt-2">
                    {option.level}
                  </Badge>
                )}
              </div>
              <Badge variant="outline">{option.score}分</Badge>
            </div>
          ))}
        </div>
      )
    }

    if (question.question_type === 'MULTIPLE_CHOICE') {
      return (
        <div className="space-y-2" aria-disabled="true">
          {question.options.map((option) => (
            <div
              key={option.option_id}
              className="flex items-start gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-sm"
            >
              <p className="font-medium">{option.option_id}.</p>
              <div className="flex-1">
                <p className="text-sm">{option.text}</p>
                {option.description && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {option.description}
                  </p>
                )}
              </div>
              <Badge variant="outline">{option.score}分</Badge>
            </div>
          ))}
        </div>
      )
    }

    if (question.question_type === 'RATING') {
      return (
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">请选择评分（1-10分）：</p>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
              <Button key={score} disabled size="sm" variant="outline">
                {score}
              </Button>
            ))}
          </div>
        </div>
      )
    }

    return null
  }

  // 渲染题目内容
  const renderQuestionContent = (question: Question) => {
    const isEditing = editingQuestion === question.question_id

    return (
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            {isEditing ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="question-text">题目文本</Label>
                  <Input
                    id="question-text"
                    value={question.question_text}
                    onChange={(e) => handleUpdateQuestionText(question.question_id, e.target.value)}
                    placeholder="题目文本"
                    className="min-h-[60px]"
                  />
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="required"
                      checked={question.required}
                      onCheckedChange={(checked) =>
                        handleUpdateRequired(question.question_id, !!checked)
                      }
                    />
                    <Label htmlFor="required">设为必答题</Label>
                  </div>
                </div>
                <div className="space-y-2">
                  {question.options.map((option) => (
                    <div key={option.option_id} className="flex gap-2">
                      <Input
                        value={option.text}
                        onChange={(event) =>
                          handleUpdateOptionText(
                            question.question_id,
                            option.option_id,
                            event.target.value
                          )
                        }
                        placeholder={`选项 ${option.option_id}`}
                        className="flex-1"
                      />
                      <Input
                        value={String(option.score)}
                        onChange={(event) =>
                          handleUpdateOptionScore(
                            question.question_id,
                            option.option_id,
                            event.target.value
                          )
                        }
                        placeholder="分值"
                        type="number"
                        className="w-32"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveQuestion}>
                    <Save className="w-4 h-4 mr-2" />
                    保存
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                    <X className="w-4 h-4 mr-2" />
                    取消
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start gap-3">
                  <p className="font-semibold">{question.question_id}.</p>
                  <div className="flex-1">
                    <p>{question.question_text}</p>
                    {question.required && (
                      <Badge className="mt-2 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                        必答
                      </Badge>
                    )}
                  </div>
                </div>
                {question.guidance && (
                  <div className="flex items-center gap-2 mt-2 pl-6">
                    <HelpCircle className="w-4 h-4 text-gray-500" />
                    <p className="text-sm text-gray-600 dark:text-gray-400">{question.guidance}</p>
                  </div>
                )}
              </>
            )}
          </div>
          {!isEditing && editable && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleEditQuestion(question.question_id)}
            >
              <Edit className="w-4 h-4" />
            </Button>
          )}
        </div>

        {!isEditing && <div className="pl-6">{renderOptions(question, isEditing)}</div>}
      </div>
    )
  }

  const getConfidenceColor = (level: string) => {
    switch (level) {
      case 'HIGH':
        return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200'
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200'
      case 'LOW':
        return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  const getDisplayModelName = (model?: string) => {
    switch ((model || '').toLowerCase()) {
      case 'gpt4':
      case 'gpt-4':
        return 'DeepSeek'
      case 'claude':
        return 'Claude'
      case 'domestic':
      case 'tongyi':
        return '通义千问'
      default:
        return model || 'DeepSeek'
    }
  }

  // 按聚类分组题目
  const questionsByCluster = questions.reduce(
    (acc, question) => {
      if (!acc[question.cluster_id]) {
        acc[question.cluster_id] = []
      }
      acc[question.cluster_id].push(question)
      return acc
    },
    {} as Record<string, Question[]>
  )

  return (
    <div className="space-y-6">
      {/* 成功提示和导出 */}
      <Alert className="bg-green-50 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
        <CheckCircle className="w-5 h-5" />
        <AlertDescription>
          <p className="font-semibold mb-3">问卷生成完成！</p>
          <div className="flex flex-col gap-3">
            <p className="text-sm text-gray-700 dark:text-gray-300">任务ID：</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-sm text-sm font-mono">
                {result.taskId}
              </code>
              <Button size="sm" variant="outline" onClick={handleCopyTaskId}>
                复制ID
              </Button>
            </div>
            <Button size="lg" className="w-full" onClick={handleExportCSV}>
              <Download className="w-4 h-4 mr-2" />
              导出CSV
            </Button>
          </div>
        </AlertDescription>
      </Alert>

      {/* 元数据信息 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-gray-600 dark:text-gray-400">任务ID</p>
            <p className="text-sm font-mono truncate">{result.taskId}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-gray-600 dark:text-gray-400">选中模型</p>
            <div className="mt-1">
              <Badge variant="outline">{getDisplayModelName(result.selectedModel)}</Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-gray-600 dark:text-gray-400">置信度</p>
            <div className="mt-1">
              <Badge className={getConfidenceColor(result.confidenceLevel)} variant="outline">
                {result.confidenceLevel}
              </Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-gray-600 dark:text-gray-400">总题数</p>
            <p className="text-base font-semibold">{metadata.total_questions} 题</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-gray-600 dark:text-gray-400">预估时间</p>
            <p className="text-base font-semibold">{metadata.estimated_time_minutes} 分钟</p>
          </CardContent>
        </Card>
      </div>

      {/* 题型统计 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <h3 className="text-lg font-semibold">题型统计</h3>
          <Button variant="ghost" size="sm" onClick={() => setShowCoverageModal(true)}>
            <PieChart className="w-4 h-4 mr-2" />
            查看覆盖率
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-400">单选题</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {questionTypeStats.SINGLE_CHOICE}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                占比{' '}
                {((questionTypeStats.SINGLE_CHOICE / metadata.total_questions) * 100).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-400">多选题</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {questionTypeStats.MULTIPLE_CHOICE}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                占比{' '}
                {((questionTypeStats.MULTIPLE_CHOICE / metadata.total_questions) * 100).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-400">评分题</p>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {questionTypeStats.RATING}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                占比 {((questionTypeStats.RATING / metadata.total_questions) * 100).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-400">判断题</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {questionTypeStats.BINARY}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                占比 {((questionTypeStats.BINARY / metadata.total_questions) * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 质量评分 */}
      {result.qualityScores && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">质量评分</h3>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">结构质量</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {(result.qualityScores.structural * 100).toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">一致性评分</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {(result.qualityScores.semantic * 100).toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">细节质量</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {(result.qualityScores.detail * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 问卷题目列表（按聚类分组） */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">调研问卷 ({metadata.total_questions} 题)</h3>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible defaultValue={Object.keys(questionsByCluster)[0]}>
            {Object.entries(questionsByCluster).map(([clusterId, clusterQuestions]) => (
              <AccordionItem key={clusterId} value={clusterId}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex justify-between items-center w-full pr-4">
                    <p className="font-medium">{clusterQuestions[0].cluster_name}</p>
                    <Badge variant="outline">{clusterQuestions.length} 题</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-6">
                    {clusterQuestions.map((question) => (
                      <div
                        key={question.question_id}
                        className="border-b border-gray-200 dark:border-gray-700 pb-4 last:border-0"
                      >
                        <div className="mb-2">{renderQuestionTypeTag(question.question_type)}</div>
                        {renderQuestionContent(question)}
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      {/* 覆盖率统计模态框 */}
      <Dialog open={showCoverageModal} onOpenChange={setShowCoverageModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>覆盖率统计</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {Object.entries(metadata.coverage_map).map(([clusterId, count]) => (
              <div key={clusterId} className="flex items-center gap-4">
                <p className="w-48 text-sm truncate" title={clusterId}>
                  {clusterId}
                </p>
                <div className="flex-1">
                  <Progress value={(count / metadata.total_questions) * 100} className="h-2" />
                </div>
                <p className="w-16 text-sm text-right">{count} 题</p>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowCoverageModal(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
