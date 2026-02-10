'use client'

/**
 * 调研问卷结果展示组件
 * 展示50-100题问卷，支持题目编辑和覆盖率统计
 */

import { useState } from 'react'
import { toast } from 'sonner'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Chip from '@mui/material/Chip'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import LinearProgress from '@mui/material/LinearProgress'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import Stack from '@mui/material/Stack'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import Checkbox from '@mui/material/Checkbox'
import EditIcon from '@mui/icons-material/Edit'
import SaveIcon from '@mui/icons-material/Save'
import CloseIcon from '@mui/icons-material/Close'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import PieChartIcon from '@mui/icons-material/PieChart'
import HelpIcon from '@mui/icons-material/Help'
import type { GenerationResult } from '@/lib/types/ai-generation'

interface Question {
  question_id: string
  cluster_id: string
  cluster_name: string
  question_text: string
  question_type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'RATING' | 'BINARY'
  options: QuestionOption[]
  required: boolean
  guidance: string
  expected_answer?: boolean  // 判断题的期望答案
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
    BINARY: questions.filter((q) => q.question_type === 'BINARY').length,
  }

  // 编辑题目
  const handleEditQuestion = (questionId: string) => {
    setEditingQuestion(questionId)
  }

  // 保存题目编辑
  const handleSaveQuestion = () => {
    setEditingQuestion(null)
    toast.success('题目编辑已保存（本地）')
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

  // 渲染题目类型图标
  const renderQuestionTypeTag = (type: string) => {
    const config = {
      SINGLE_CHOICE: { color: 'primary' as const, text: '单选题' },
      MULTIPLE_CHOICE: { color: 'success' as const, text: '多选题' },
      RATING: { color: 'warning' as const, text: '评分题' },
      BINARY: { color: 'secondary' as const, text: '判断题' },
    }
    const { color, text } = config[type as keyof typeof config] || {
      color: 'default' as const,
      text: type,
    }
    return <Chip label={text} color={color} size="small" />
  }

  // 渲染题目选项
  const renderOptions = (question: Question, isEditing: boolean) => {
    // 判断题类型
    if (question.question_type === 'BINARY') {
      return (
        <FormControl component="fieldset" disabled fullWidth>
          <RadioGroup>
            <Stack spacing={1}>
              <FormControlLabel
                value="true"
                control={<Radio />}
                label={
                  <Box sx={{ p: 1, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="body1" fontWeight="medium">A. 有</Typography>
                    <Typography variant="caption" color="text.secondary">
                      组织已具备此能力或已实施此要求
                    </Typography>
                  </Box>
                }
              />
              <FormControlLabel
                value="false"
                control={<Radio />}
                label={
                  <Box sx={{ p: 1, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="body1" fontWeight="medium">B. 没有</Typography>
                    <Typography variant="caption" color="text.secondary">
                      组织未具备此能力或未实施此要求
                    </Typography>
                  </Box>
                }
              />
            </Stack>
          </RadioGroup>
        </FormControl>
      )
    }

    if (question.question_type === 'SINGLE_CHOICE') {
      return (
        <FormControl component="fieldset" disabled fullWidth>
          <RadioGroup>
            <Stack spacing={1}>
              {question.options.map((option) => (
                <FormControlLabel
                  key={option.option_id}
                  value={option.option_id}
                  control={<Radio />}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                      <Typography variant="body2" fontWeight="medium">
                        {option.option_id}.
                      </Typography>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2">{option.text}</Typography>
                        {option.description && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            {option.description}
                          </Typography>
                        )}
                        {option.level && (
                          <Chip label={option.level} color="secondary" size="small" sx={{ mt: 0.5 }} />
                        )}
                      </Box>
                      <Chip label={`${option.score}分`} color="primary" size="small" />
                    </Box>
                  }
                />
              ))}
            </Stack>
          </RadioGroup>
        </FormControl>
      )
    }

    if (question.question_type === 'MULTIPLE_CHOICE') {
      return (
        <FormControl component="fieldset" disabled fullWidth>
          <Stack spacing={1}>
            {question.options.map((option) => (
              <FormControlLabel
                key={option.option_id}
                value={option.option_id}
                control={<Checkbox />}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                    <Typography variant="body2" fontWeight="medium">
                      {option.option_id}.
                    </Typography>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2">{option.text}</Typography>
                      {option.description && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          {option.description}
                        </Typography>
                      )}
                    </Box>
                    <Chip label={`${option.score}分`} color="primary" size="small" />
                  </Box>
                }
              />
            ))}
          </Stack>
        </FormControl>
      )
    }

    if (question.question_type === 'RATING') {
      return (
        <Box>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            请选择评分（1-10分）：
          </Typography>
          <Stack direction="row" spacing={1}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
              <Button key={score} disabled size="small" variant="outlined">
                {score}
              </Button>
            ))}
          </Stack>
        </Box>
      )
    }

    return null
  }

  // 渲染题目内容
  const renderQuestionContent = (question: Question) => {
    const isEditing = editingQuestion === question.question_id

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1 }}>
            {isEditing ? (
              <Stack spacing={2}>
                <TextField
                  value={question.question_text}
                  onChange={(e) =>
                    handleUpdateQuestionText(question.question_id, e.target.value)
                  }
                  multiline
                  rows={2}
                  placeholder="题目文本"
                  fullWidth
                  size="small"
                />
                <TextField
                  value={question.guidance}
                  onChange={(e) => handleUpdateGuidance(question.question_id, e.target.value)}
                  multiline
                  rows={2}
                  placeholder="填写引导"
                  fullWidth
                  size="small"
                />
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<SaveIcon />}
                    onClick={handleSaveQuestion}
                  >
                    保存
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<CloseIcon />}
                    onClick={handleCancelEdit}
                  >
                    取消
                  </Button>
                </Stack>
              </Stack>
            ) : (
              <>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                  <Typography variant="subtitle1" fontWeight="bold">
                    {question.question_id}.
                  </Typography>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body1">{question.question_text}</Typography>
                    {question.required && (
                      <Chip label="必答" color="error" size="small" sx={{ mt: 0.5 }} />
                    )}
                  </Box>
                </Box>
                {question.guidance && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1, pl: 3 }}>
                    <HelpIcon fontSize="small" color="action" />
                    <Typography variant="caption" color="text.secondary">
                      {question.guidance}
                    </Typography>
                  </Box>
                )}
              </>
            )}
          </Box>
          {!isEditing && (
            <IconButton
              size="small"
              onClick={() => handleEditQuestion(question.question_id)}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          )}
        </Box>

        {!isEditing && (
          <Box sx={{ pl: 3 }}>
            {renderOptions(question, isEditing)}
          </Box>
        )}
      </Box>
    )
  }

  // 渲染覆盖率统计模态框
  const renderCoverageModal = () => {
    const coverageData = Object.entries(metadata.coverage_map).map(([clusterId, count]) => ({
      clusterId,
      count,
    }))

    return (
      <Dialog
        open={showCoverageModal}
        onClose={() => setShowCoverageModal(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>覆盖率统计</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {coverageData.map(({ clusterId, count }) => (
              <Box key={clusterId} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="body2" sx={{ width: 200 }} noWrap title={clusterId}>
                  {clusterId}
                </Typography>
                <Box sx={{ flex: 1 }}>
                  <LinearProgress
                    variant="determinate"
                    value={(count / metadata.total_questions) * 100}
                    sx={{ height: 8, borderRadius: 1 }}
                  />
                </Box>
                <Typography variant="caption" sx={{ width: 60 }}>
                  {count} 题
                </Typography>
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCoverageModal(false)}>关闭</Button>
        </DialogActions>
      </Dialog>
    )
  }

  const getConfidenceColor = (level: string): 'success' | 'warning' | 'error' => {
    switch (level) {
      case 'HIGH':
        return 'success'
      case 'MEDIUM':
        return 'warning'
      case 'LOW':
        return 'error'
      default:
        return 'warning'
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
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* 成功提示和导出 */}
      <Alert severity="success" icon={<CheckCircleIcon />}>
        <Typography variant="subtitle1" fontWeight="bold">
          问卷生成完成！
        </Typography>
        <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">任务ID：</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              component="code"
              sx={{
                bgcolor: 'grey.100',
                px: 2,
                py: 1,
                borderRadius: 1,
                fontFamily: 'monospace',
                flex: 1,
                userSelect: 'all',
              }}
            >
              {result.taskId}
            </Box>
            <Button variant="outlined" size="small" onClick={handleCopyTaskId}>
              复制ID
            </Button>
          </Box>
          <Box>
            <Button variant="contained" color="success" fullWidth onClick={handleExportCSV}>
              导出CSV
            </Button>
          </Box>
        </Box>
      </Alert>

      {/* 元数据信息 */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
        <Card>
          <CardContent>
            <Typography variant="caption" color="text.secondary">任务ID</Typography>
            <Typography variant="body2" fontFamily="monospace" noWrap>
              {result.taskId}
            </Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="caption" color="text.secondary">选中模型</Typography>
            <Box sx={{ mt: 0.5 }}>
              <Chip label={result.selectedModel} color="primary" size="small" />
            </Box>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="caption" color="text.secondary">置信度</Typography>
            <Box sx={{ mt: 0.5 }}>
              <Chip
                label={result.confidenceLevel}
                color={getConfidenceColor(result.confidenceLevel)}
                size="small"
              />
            </Box>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="caption" color="text.secondary">总题数</Typography>
            <Typography variant="body2" fontWeight="bold">
              {metadata.total_questions} 题
            </Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="caption" color="text.secondary">预估时间</Typography>
            <Typography variant="body2" fontWeight="bold">
              {metadata.estimated_time_minutes} 分钟
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* 题型统计 */}
      <Card>
        <CardHeader
          title="题型统计"
          action={
            <Button
              variant="text"
              size="small"
              startIcon={<PieChartIcon />}
              onClick={() => setShowCoverageModal(true)}
            >
              查看覆盖率
            </Button>
          }
        />
        <CardContent>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">单选题</Typography>
              <Typography variant="h5" fontWeight="bold" color="primary.main">
                {questionTypeStats.SINGLE_CHOICE}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                占比 {((questionTypeStats.SINGLE_CHOICE / metadata.total_questions) * 100).toFixed(1)}%
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">多选题</Typography>
              <Typography variant="h5" fontWeight="bold" color="success.main">
                {questionTypeStats.MULTIPLE_CHOICE}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                占比 {((questionTypeStats.MULTIPLE_CHOICE / metadata.total_questions) * 100).toFixed(1)}%
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">评分题</Typography>
              <Typography variant="h5" fontWeight="bold" color="warning.main">
                {questionTypeStats.RATING}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                占比 {((questionTypeStats.RATING / metadata.total_questions) * 100).toFixed(1)}%
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">判断题</Typography>
              <Typography variant="h5" fontWeight="bold" color="secondary.main">
                {questionTypeStats.BINARY}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                占比 {((questionTypeStats.BINARY / metadata.total_questions) * 100).toFixed(1)}%
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* 质量评分 */}
      {result.qualityScores && (
        <Card>
          <CardHeader title="质量评分" />
          <CardContent>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">结构质量</Typography>
                <Typography variant="h5" fontWeight="bold" color="primary.main">
                  {(result.qualityScores.structural * 100).toFixed(1)}%
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">语义质量</Typography>
                <Typography variant="h5" fontWeight="bold" color="success.main">
                  {(result.qualityScores.semantic * 100).toFixed(1)}%
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">细节质量</Typography>
                <Typography variant="h5" fontWeight="bold" color="secondary.main">
                  {(result.qualityScores.detail * 100).toFixed(1)}%
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* 问卷题目列表（按聚类分组） */}
      <Card>
        <CardHeader title={`调研问卷 (${metadata.total_questions} 题)`} />
        <CardContent>
          {Object.entries(questionsByCluster).map(([clusterId, clusterQuestions]) => (
            <Accordion key={clusterId} defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', pr: 2 }}>
                  <Typography variant="subtitle1" fontWeight="medium">
                    {clusterQuestions[0].cluster_name}
                  </Typography>
                  <Chip label={`${clusterQuestions.length} 题`} color="primary" size="small" />
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={3}>
                  {clusterQuestions.map((question) => (
                    <Box
                      key={question.question_id}
                      sx={{
                        borderBottom: 1,
                        borderColor: 'divider',
                        pb: 2,
                        '&:last-child': { borderBottom: 0 },
                      }}
                    >
                      <Box sx={{ mb: 1 }}>
                        {renderQuestionTypeTag(question.question_type)}
                      </Box>
                      {renderQuestionContent(question)}
                    </Box>
                  ))}
                </Stack>
              </AccordionDetails>
            </Accordion>
          ))}
        </CardContent>
      </Card>

      {/* 覆盖率统计模态框 */}
      {renderCoverageModal()}
    </Box>
  )
}
