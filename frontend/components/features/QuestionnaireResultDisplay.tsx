'use client'

/**
 * 调研问卷结果展示组件
 * 展示50-100题问卷，支持题目编辑和覆盖率统计
 */

import { useState } from 'react'
import {
  Card,
  Collapse,
  Tag,
  Button,
  Modal,
  Input,
  Select,
  message,
  Radio,
  Checkbox,
  Progress,
  Alert,
} from 'antd'
import {
  EditOutlined,
  SaveOutlined,
  CloseOutlined,
  PieChartOutlined,
  QuestionCircleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons'
import type { GenerationResult } from '@/lib/types/ai-generation'

const { Panel } = Collapse
const { TextArea } = Input
const { Option } = Select

interface Question {
  question_id: string
  cluster_id: string
  cluster_name: string
  question_text: string
  question_type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'RATING'
  options: QuestionOption[]
  required: boolean
  guidance: string
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
}

export default function QuestionnaireResultDisplay({
  result,
}: QuestionnaireResultDisplayProps) {
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null)
  const [editedQuestions, setEditedQuestions] = useState<Question[]>(
    result.selectedResult?.questionnaire || []
  )
  const [showCoverageModal, setShowCoverageModal] = useState(false)

  const questions: Question[] = editedQuestions
  const metadata: QuestionnaireMetadata =
    result.selectedResult?.questionnaire_metadata || {
      total_questions: 0,
      estimated_time_minutes: 0,
      coverage_map: {},
    }

  // 题型统计
  const questionTypeStats = {
    SINGLE_CHOICE: questions.filter((q) => q.question_type === 'SINGLE_CHOICE').length,
    MULTIPLE_CHOICE: questions.filter((q) => q.question_type === 'MULTIPLE_CHOICE').length,
    RATING: questions.filter((q) => q.question_type === 'RATING').length,
  }

  // 编辑题目
  const handleEditQuestion = (questionId: string) => {
    setEditingQuestion(questionId)
  }

  // 保存题目编辑
  const handleSaveQuestion = () => {
    setEditingQuestion(null)
    message.success('题目编辑已保存（本地）')
  }

  // 取消编辑
  const handleCancelEdit = () => {
    setEditedQuestions(result.selectedResult?.questionnaire || [])
    setEditingQuestion(null)
  }

  // 更新题目文本
  const handleUpdateQuestionText = (questionId: string, newText: string) => {
    setEditedQuestions((prev) =>
      prev.map((q) => (q.question_id === questionId ? { ...q, question_text: newText } : q))
    )
  }

  // 更新引导文本
  const handleUpdateGuidance = (questionId: string, newGuidance: string) => {
    setEditedQuestions((prev) =>
      prev.map((q) => (q.question_id === questionId ? { ...q, guidance: newGuidance } : q))
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
      message.success('问卷已导出为CSV文件！')
    } catch (error) {
      message.error('导出失败：' + (error instanceof Error ? error.message : '未知错误'))
    }
  }

  // 复制任务ID
  const handleCopyTaskId = () => {
    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(result.taskId)
        .then(() => {
          message.success('任务ID已复制到剪贴板！')
        })
        .catch(() => {
          message.error('复制失败，请手动复制')
        })
    } else {
      message.warning('您的浏览器不支持自动复制，请手动复制任务ID')
    }
  }

  // 渲染题目类型图标
  const renderQuestionTypeTag = (type: string) => {
    const config = {
      SINGLE_CHOICE: { color: 'blue', text: '单选题' },
      MULTIPLE_CHOICE: { color: 'green', text: '多选题' },
      RATING: { color: 'orange', text: '评分题' },
    }
    const { color, text } = config[type as keyof typeof config] || {
      color: 'default',
      text: type,
    }
    return <Tag color={color}>{text}</Tag>
  }

  // 渲染题目选项
  const renderOptions = (question: Question, isEditing: boolean) => {
    if (question.question_type === 'SINGLE_CHOICE') {
      return (
        <Radio.Group disabled className="w-full space-y-2">
          {question.options.map((option) => (
            <div key={option.option_id} className="block">
              <Radio value={option.option_id} className="w-full">
                <div className="flex items-start">
                  <span className="font-medium mr-2">{option.option_id}.</span>
                  <div className="flex-1">
                    <div>{option.text}</div>
                    {option.description && (
                      <div className="text-xs text-gray-500 mt-1">{option.description}</div>
                    )}
                    {option.level && (
                      <Tag size="small" color="purple" className="mt-1">
                        {option.level}
                      </Tag>
                    )}
                  </div>
                  <Tag color="blue" className="ml-2">
                    {option.score}分
                  </Tag>
                </div>
              </Radio>
            </div>
          ))}
        </Radio.Group>
      )
    }

    if (question.question_type === 'MULTIPLE_CHOICE') {
      return (
        <Checkbox.Group disabled className="w-full space-y-2">
          {question.options.map((option) => (
            <div key={option.option_id} className="block">
              <Checkbox value={option.option_id} className="w-full">
                <div className="flex items-start">
                  <span className="font-medium mr-2">{option.option_id}.</span>
                  <div className="flex-1">
                    <div>{option.text}</div>
                    {option.description && (
                      <div className="text-xs text-gray-500 mt-1">{option.description}</div>
                    )}
                  </div>
                  <Tag color="blue" className="ml-2">
                    {option.score}分
                  </Tag>
                </div>
              </Checkbox>
            </div>
          ))}
        </Checkbox.Group>
      )
    }

    if (question.question_type === 'RATING') {
      return (
        <div className="space-y-2">
          <div className="text-sm text-gray-600">请选择评分（1-10分）：</div>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
              <Button key={score} disabled size="small">
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
      <div className="space-y-4">
        <div className="flex justify-between items-start">
          <div className="flex-1 space-y-2">
            {isEditing ? (
              <>
                <TextArea
                  value={question.question_text}
                  onChange={(e) =>
                    handleUpdateQuestionText(question.question_id, e.target.value)
                  }
                  rows={2}
                  placeholder="题目文本"
                />
                <TextArea
                  value={question.guidance}
                  onChange={(e) => handleUpdateGuidance(question.question_id, e.target.value)}
                  rows={2}
                  placeholder="填写引导"
                />
                <div className="flex gap-2">
                  <Button
                    type="primary"
                    size="small"
                    icon={<SaveOutlined />}
                    onClick={handleSaveQuestion}
                  >
                    保存
                  </Button>
                  <Button
                    size="small"
                    icon={<CloseOutlined />}
                    onClick={handleCancelEdit}
                  >
                    取消
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start gap-3">
                  <span className="font-semibold text-gray-700 text-base">
                    {question.question_id}.
                  </span>
                  <div className="flex-1">
                    <div className="text-base text-gray-800">{question.question_text}</div>
                    {question.required && (
                      <Tag color="red" size="small" className="mt-1">
                        必答
                      </Tag>
                    )}
                  </div>
                </div>
                {question.guidance && (
                  <div className="text-sm text-gray-500 pl-8">
                    <QuestionCircleOutlined className="mr-1" />
                    {question.guidance}
                  </div>
                )}
              </>
            )}
          </div>
          {!isEditing && (
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEditQuestion(question.question_id)}
            />
          )}
        </div>

        {!isEditing && (
          <div className="pl-8">{renderOptions(question, isEditing)}</div>
        )}
      </div>
    )
  }

  // 渲染覆盖率统计模态框
  const renderCoverageModal = () => {
    const coverageData = Object.entries(metadata.coverage_map).map(([clusterId, count]) => ({
      clusterId,
      count,
    }))

    return (
      <Modal
        title="覆盖率统计"
        open={showCoverageModal}
        onCancel={() => setShowCoverageModal(false)}
        footer={[
          <Button key="close" onClick={() => setShowCoverageModal(false)}>
            关闭
          </Button>,
        ]}
        width={700}
      >
        <div className="space-y-4">
          {coverageData.map(({ clusterId, count }) => (
            <div key={clusterId} className="flex items-center gap-4">
              <div className="w-48 text-sm truncate" title={clusterId}>
                {clusterId}
              </div>
              <div className="flex-1">
                <Progress
                  percent={(count / metadata.total_questions) * 100}
                  format={() => `${count} 题`}
                />
              </div>
            </div>
          ))}
        </div>
      </Modal>
    )
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
      <Alert
        message={
          <div>
            <strong>✅ 问卷生成完成！</strong>
          </div>
        }
        description={
          <div className="space-y-3">
            <div>
              <span className="text-sm text-gray-600">任务ID：</span>
            </div>
            <div className="flex items-center gap-2">
              <code className="bg-gray-100 px-3 py-2 rounded font-mono text-sm flex-1 select-all">
                {result.taskId}
              </code>
              <Button
                onClick={handleCopyTaskId}
                size="small"
                className="whitespace-nowrap"
              >
                复制ID
              </Button>
            </div>
            <div>
              <Button
                type="primary"
                onClick={handleExportCSV}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                📊 导出CSV
              </Button>
            </div>
          </div>
        }
        type="success"
        showIcon
        icon={<CheckCircleOutlined />}
      />

      {/* 元数据信息 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card size="small">
          <div className="text-xs text-gray-500">任务ID</div>
          <div className="text-sm font-mono truncate">{result.taskId}</div>
        </Card>
        <Card size="small">
          <div className="text-xs text-gray-500">选中模型</div>
          <div className="text-sm font-semibold">
            <Tag color="blue">{result.selectedModel}</Tag>
          </div>
        </Card>
        <Card size="small">
          <div className="text-xs text-gray-500">置信度</div>
          <div className="text-sm">
            <Tag
              color={
                result.confidenceLevel === 'HIGH'
                  ? 'green'
                  : result.confidenceLevel === 'MEDIUM'
                    ? 'orange'
                    : 'red'
              }
            >
              {result.confidenceLevel}
            </Tag>
          </div>
        </Card>
        <Card size="small">
          <div className="text-xs text-gray-500">总题数</div>
          <div className="text-sm font-semibold">{metadata.total_questions} 题</div>
        </Card>
        <Card size="small">
          <div className="text-xs text-gray-500">预估时间</div>
          <div className="text-sm font-semibold">{metadata.estimated_time_minutes} 分钟</div>
        </Card>
      </div>

      {/* 题型统计 */}
      <Card
        title="题型统计"
        extra={
          <Button
            type="link"
            size="small"
            icon={<PieChartOutlined />}
            onClick={() => setShowCoverageModal(true)}
          >
            查看覆盖率
          </Button>
        }
      >
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-gray-500">单选题</div>
            <div className="text-2xl font-bold text-blue-600">
              {questionTypeStats.SINGLE_CHOICE}
            </div>
            <div className="text-xs text-gray-500">
              占比{' '}
              {((questionTypeStats.SINGLE_CHOICE / metadata.total_questions) * 100).toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">多选题</div>
            <div className="text-2xl font-bold text-green-600">
              {questionTypeStats.MULTIPLE_CHOICE}
            </div>
            <div className="text-xs text-gray-500">
              占比{' '}
              {((questionTypeStats.MULTIPLE_CHOICE / metadata.total_questions) * 100).toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">评分题</div>
            <div className="text-2xl font-bold text-orange-600">{questionTypeStats.RATING}</div>
            <div className="text-xs text-gray-500">
              占比 {((questionTypeStats.RATING / metadata.total_questions) * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      </Card>

      {/* 质量评分 */}
      {result.qualityScores && (
        <Card title="质量评分" size="small">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-gray-500">结构质量</div>
              <div className="text-xl font-bold text-blue-600">
                {(result.qualityScores.structural * 100).toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">语义质量</div>
              <div className="text-xl font-bold text-green-600">
                {(result.qualityScores.semantic * 100).toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">细节质量</div>
              <div className="text-xl font-bold text-purple-600">
                {(result.qualityScores.detail * 100).toFixed(1)}%
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* 问卷题目列表（按聚类分组） */}
      <Card title={`调研问卷 (${metadata.total_questions} 题)`}>
        <Collapse accordion>
          {Object.entries(questionsByCluster).map(([clusterId, clusterQuestions]) => (
            <Panel
              header={
                <div className="flex justify-between items-center">
                  <span className="font-medium">{clusterQuestions[0].cluster_name}</span>
                  <Tag color="blue">{clusterQuestions.length} 题</Tag>
                </div>
              }
              key={clusterId}
            >
              <div className="space-y-6">
                {clusterQuestions.map((question, index) => (
                  <div key={question.question_id} className="border-b border-gray-200 pb-4 last:border-0">
                    <div className="mb-2">
                      {renderQuestionTypeTag(question.question_type)}
                    </div>
                    {renderQuestionContent(question)}
                  </div>
                ))}
              </div>
            </Panel>
          ))}
        </Collapse>
      </Card>

      {/* 覆盖率统计模态框 */}
      {renderCoverageModal()}
    </div>
  )
}
