'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Card,
  CardContent,
  CardHeader,
  Button,
  Alert,
  Box,
  Typography,
  LinearProgress,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tabs,
  Tab,
  Paper,
  Divider,
} from '@mui/material'
import {
  ArrowBack,
  Book,
  ExpandMore,
  MenuBook,
  Lightbulb,
  Checklist,
  Warning,
  School,
} from '@mui/icons-material'
import { message } from '@/lib/message'
import { AITasksAPI } from '@/lib/api/ai-tasks'
import { apiFetch } from '@/lib/utils/api'
import { useTaskProgressPolling } from '@/lib/hooks/useTaskProgressPolling'

interface InterpretationResult {
  overview: {
    background: string
    scope: string
    core_objectives: string[]
    target_audience: string[]
    key_changes?: string
  }
  key_terms: Array<{
    term: string
    definition: string
    explanation: string
    examples?: string[]
  }>
  key_requirements: Array<{
    clause_id: string
    chapter?: string
    clause_full_text?: string
    clause_summary?: string
    clause_text: string
    interpretation: string
    compliance_criteria: string[]
    priority: 'HIGH' | 'MEDIUM' | 'LOW'
  }>
  implementation_guidance: {
    preparation: string[]
    implementation_steps: Array<{
      phase: string
      steps: string[]
    }>
    best_practices: string[]
    common_pitfalls: string[]
    timeline_estimate: string
  }
}

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`interpretation-tabpanel-${index}`}
      aria-labelledby={`interpretation-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  )
}

export default function StandardInterpretationPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId as string

  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [result, setResult] = useState<InterpretationResult | null>(null)
  const [taskId, setTaskId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState(0)
  const [documents, setDocuments] = useState<any[]>([])

  // 使用轮询 hook 监听任务进度
  const { progress } = useTaskProgressPolling({
    taskId: taskId || undefined,
    enabled: !!taskId && loading && !result,
    pollingInterval: 5000,
    onComplete: async (status) => {
      if (status.status === 'completed') {
        try {
          const task = await AITasksAPI.getTask(taskId!)
          if (task && task.result) {
            // 解析标准解读结果
            let interpretationResult: InterpretationResult
            if (task.result.content) {
              try {
                interpretationResult = typeof task.result.content === 'string'
                  ? JSON.parse(task.result.content)
                  : task.result.content
              } catch (e) {
                console.error('Failed to parse result:', e)
                interpretationResult = task.result.content
              }
            } else if (task.result.gpt4 || task.result.claude || task.result.domestic) {
              interpretationResult = task.result.gpt4 || task.result.claude || task.result.domestic
            } else {
              interpretationResult = task.result
            }
            setResult(interpretationResult)
            setLoading(false)
            message.success('标准解读完成！')
          }
        } catch (err) {
          console.error('Failed to fetch result:', err)
          setError('获取解读结果失败')
          setLoading(false)
        }
      } else if (status.status === 'failed') {
        setError(status.message || '解读失败')
        setLoading(false)
      }
    },
  })

  // 加载项目文档
  const loadDocuments = useCallback(async () => {
    try {
      const response = await apiFetch(`/files/projects/${projectId}/documents/list`, {
        method: 'POST',
      })
      if (response.success) {
        setDocuments(response.data || [])
      }
    } catch (err) {
      console.error('Failed to load documents:', err)
    }
  }, [projectId])

  // 检查是否有已保存的解读任务
  const loadSavedTask = useCallback(async () => {
    try {
      const project = await apiFetch(`/projects/${projectId}`)

      // 从项目 metadata 获取文档列表（如果 loadDocuments 失败时的回退）
      const uploadedDocs = project.metadata?.uploadedDocuments || []
      if (uploadedDocs.length > 0) {
        setDocuments(uploadedDocs)
      }

      if (project.metadata?.standardInterpretationTaskId) {
        const savedTaskId = project.metadata.standardInterpretationTaskId
        setTaskId(savedTaskId)

        try {
          const task = await AITasksAPI.getTask(savedTaskId)
          if (task && task.status === 'completed' && task.result) {
            let interpretationResult: InterpretationResult
            if (task.result.content) {
              interpretationResult = typeof task.result.content === 'string'
                ? JSON.parse(task.result.content)
                : task.result.content
            } else if (task.result.gpt4 || task.result.claude || task.result.domestic) {
              interpretationResult = task.result.gpt4 || task.result.claude || task.result.domestic
            } else {
              interpretationResult = task.result
            }
            setResult(interpretationResult)
          } else if (task.status === 'processing' || task.status === 'pending') {
            setLoading(true)
          }
        } catch (err) {
          console.log('Failed to load saved task:', err)
        }
      }
    } catch (err) {
      console.error('Failed to load project:', err)
    } finally {
      setInitializing(false)
    }
  }, [projectId])

  useEffect(() => {
    loadDocuments()
    loadSavedTask()
  }, [loadDocuments, loadSavedTask])

  const handleAnalyze = async () => {
    try {
      setLoading(true)
      setError(null)

      // 获取项目信息
      const project = await apiFetch(`/projects/${projectId}`)
      const uploadedDocs = project.metadata?.uploadedDocuments || []

      if (uploadedDocs.length === 0) {
        setError('请先上传至少1个文档')
        setLoading(false)
        return
      }

      // 合并所有文档内容
      const documentsText = uploadedDocs.map((doc: any) =>
        `=== ${doc.name} ===\n\n${doc.content}`
      ).join('\n\n')

      if (!documentsText || documentsText.length < 100) {
        setError('文档内容太短，无法进行分析')
        setLoading(false)
        return
      }

      // 创建标准解读任务
      const task = await AITasksAPI.createTask({
        projectId,
        type: 'standard_interpretation',
        input: {
          standardDocument: documentsText,
          standardName: project.name || '未知标准',
        },
      })

      setTaskId(task.id)

      // 保存 taskId 到项目 metadata
      await apiFetch(`/projects/${projectId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          metadata: {
            standardInterpretationTaskId: task.id,
          },
        }),
      })
    } catch (err: any) {
      console.error('Failed to start analysis:', err)
      setError(err.message || '启动解读失败')
      setLoading(false)
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH':
        return 'error'
      case 'MEDIUM':
        return 'warning'
      case 'LOW':
        return 'success'
      default:
        return 'default'
    }
  }

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'HIGH':
        return '高优先级'
      case 'MEDIUM':
        return '中优先级'
      case 'LOW':
        return '低优先级'
      default:
        return priority
    }
  }

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue)
  }

  if (initializing) {
    return (
      <main className="max-w-[1920px] mx-auto px-6 py-8">
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
          <Typography>加载中...</Typography>
        </Box>
      </main>
    )
  }

  return (
    <main className="max-w-[1920px] mx-auto px-6 py-8">
      <header className="flex items-start justify-between mb-8">
        <div>
          <Typography variant="h4" component="h1" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
            <MenuBook sx={{ fontSize: 32, color: 'primary.main' }} />
            标准解读
          </Typography>
          <Typography variant="body2" color="text.secondary">
            基于上传的标准文档，AI智能解读条款要求
          </Typography>
        </div>

        <Button startIcon={<ArrowBack />} onClick={() => router.back()}>
          返回
        </Button>
      </header>

      {error && (
        <Alert severity="error" sx={{ mb: 4 }}>
          {error}
        </Alert>
      )}

      {!result ? (
        <Card>
          <CardContent>
            <Box
              sx={{
                border: '2px dashed',
                borderColor: 'divider',
                borderRadius: 2,
                p: 6,
                textAlign: 'center',
              }}
            >
              {documents.length === 0 ? (
                <Alert severity="warning" sx={{ mb: 4, textAlign: 'left' }}>
                  请先上传标准文档，然后才能进行标准解读
                </Alert>
              ) : (
                <Box sx={{ mb: 4 }}>
                  <Typography variant="h6" gutterBottom>
                    已准备好 {documents.length} 个文档
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    文档已就绪，点击下方按钮开始AI智能解读
                  </Typography>
                </Box>
              )}

              <Button
                variant="contained"
                startIcon={<Book />}
                onClick={handleAnalyze}
                disabled={loading || documents.length === 0}
                size="large"
              >
                {loading ? '分析中...' : '开始解读'}
              </Button>

              {loading && (
                <Box sx={{ mt: 4, maxWidth: 600, mx: 'auto' }}>
                  <LinearProgress sx={{ mb: 2 }} />
                  {progress && (
                    <>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                          进度
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {progress.percentage || 0}%
                        </Typography>
                      </Box>
                      {progress.stage && (
                        <Typography variant="caption" color="text.secondary">
                          {progress.stage}
                        </Typography>
                      )}
                    </>
                  )}
                </Box>
              )}
            </Box>
          </CardContent>
        </Card>
      ) : (
        <>
          <Paper sx={{ mb: 3 }}>
            <Tabs
              value={activeTab}
              onChange={handleTabChange}
              variant="scrollable"
              scrollButtons="auto"
              sx={{ borderBottom: 1, borderColor: 'divider' }}
            >
              <Tab icon={<MenuBook />} label="概述" />
              <Tab icon={<School />} label="关键术语" />
              <Tab icon={<Checklist />} label="条款要求" />
              <Tab icon={<Lightbulb />} label="实施指南" />
            </Tabs>

            {/* 概述 */}
            <TabPanel value={activeTab} index={0}>
              <Typography variant="h5" gutterBottom>
                标准概述
              </Typography>
              <Box sx={{ mb: 4 }}>
                <Typography variant="h6" gutterBottom color="primary">
                  背景
                </Typography>
                <Typography variant="body1" paragraph>
                  {result.overview?.background || '暂无信息'}
                </Typography>
              </Box>

              <Box sx={{ mb: 4 }}>
                <Typography variant="h6" gutterBottom color="primary">
                  适用范围
                </Typography>
                <Typography variant="body1" paragraph>
                  {result.overview?.scope || '暂无信息'}
                </Typography>
              </Box>

              <Box sx={{ mb: 4 }}>
                <Typography variant="h6" gutterBottom color="primary">
                  核心目标
                </Typography>
                <ul>
                  {result.overview?.core_objectives?.map((obj, idx) => (
                    <li key={idx}>
                      <Typography variant="body1">{obj}</Typography>
                    </li>
                  )) || <Typography variant="body1">暂无信息</Typography>}
                </ul>
              </Box>

              <Box>
                <Typography variant="h6" gutterBottom color="primary">
                  目标受众
                </Typography>
                <ul>
                  {result.overview?.target_audience?.map((aud, idx) => (
                    <li key={idx}>
                      <Typography variant="body1">{aud}</Typography>
                    </li>
                  )) || <Typography variant="body1">暂无信息</Typography>}
                </ul>
              </Box>
            </TabPanel>

            {/* 关键术语 */}
            <TabPanel value={activeTab} index={1}>
              <Typography variant="h5" gutterBottom>
                关键术语定义
              </Typography>
              {result.key_terms?.map((term, idx) => (
                <Accordion key={idx} defaultExpanded={idx === 0}>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography variant="h6" color="primary">
                      {term.term}
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        定义
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {term.definition}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        解释
                      </Typography>
                      <Typography variant="body2">{term.explanation}</Typography>
                    </Box>
                    {term.examples && term.examples.length > 0 && (
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>
                          示例
                        </Typography>
                        <ul>
                          {term.examples.map((ex, i) => (
                            <li key={i}>
                              <Typography variant="body2">{ex}</Typography>
                            </li>
                          ))}
                        </ul>
                      </Box>
                    )}
                  </AccordionDetails>
                </Accordion>
              )) || <Typography variant="body1">暂无术语定义</Typography>}
            </TabPanel>

            {/* 条款要求 */}
            <TabPanel value={activeTab} index={2}>
              <Typography variant="h5" gutterBottom>
                关键条款要求
              </Typography>
              {result.key_requirements?.map((req, idx) => (
                <Accordion key={idx}>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Chip label={req.clause_id} size="small" color="primary" />
                      <Typography variant="subtitle1" fontWeight="bold">
                        {req.clause_summary || req.clause_text?.substring(0, 50) + '...'}
                      </Typography>
                      <Chip
                        label={getPriorityLabel(req.priority)}
                        size="small"
                        color={getPriorityColor(req.priority) as any}
                      />
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    {req.chapter && (
                      <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                        所属章节: {req.chapter}
                      </Typography>
                    )}
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        条款内容
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {req.clause_full_text || req.clause_text}
                      </Typography>
                    </Box>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        AI解读
                      </Typography>
                      <Typography variant="body2">
                        {typeof req.interpretation === 'string'
                          ? req.interpretation
                          : req.interpretation?.what || '暂无解读'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        合规要求
                      </Typography>
                      <ul>
                        {Array.isArray(req.compliance_criteria)
                          ? req.compliance_criteria.map((criteria, i) => (
                              <li key={i}>
                                <Typography variant="body2">{criteria}</Typography>
                              </li>
                            ))
                          : <Typography variant="body2">暂无具体要求</Typography>
                        }
                      </ul>
                    </Box>
                  </AccordionDetails>
                </Accordion>
              )) || <Typography variant="body1">暂无条款要求</Typography>}
            </TabPanel>

            {/* 实施指南 */}
            <TabPanel value={activeTab} index={3}>
              <Typography variant="h5" gutterBottom>
                实施指南
              </Typography>

              <Box sx={{ mb: 4 }}>
                <Typography variant="h6" gutterBottom color="primary">
                  准备工作
                </Typography>
                <ul>
                  {result.implementation_guidance?.preparation?.map((item, idx) => (
                    <li key={idx}>
                      <Typography variant="body1">{item}</Typography>
                    </li>
                  )) || <Typography variant="body1">暂无信息</Typography>}
                </ul>
              </Box>

              <Divider sx={{ my: 3 }} />

              <Box sx={{ mb: 4 }}>
                <Typography variant="h6" gutterBottom color="primary">
                  实施步骤
                </Typography>
                {result.implementation_guidance?.implementation_steps?.map((step, idx) => (
                  <Accordion key={idx}>
                    <AccordionSummary expandIcon={<ExpandMore />}>
                      <Typography variant="subtitle1" fontWeight="bold">
                        {step.phase}
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <ol>
                        {step.steps?.map((s, i) => (
                          <li key={i}>
                            <Typography variant="body2">{s}</Typography>
                          </li>
                        ))}
                      </ol>
                    </AccordionDetails>
                  </Accordion>
                )) || <Typography variant="body1">暂无实施步骤</Typography>}
              </Box>

              <Divider sx={{ my: 3 }} />

              <Box sx={{ mb: 4 }}>
                <Typography variant="h6" gutterBottom color="primary">
                  最佳实践
                </Typography>
                <ul>
                  {result.implementation_guidance?.best_practices?.map((item, idx) => (
                    <li key={idx}>
                      <Typography variant="body1">{item}</Typography>
                    </li>
                  )) || <Typography variant="body1">暂无信息</Typography>}
                </ul>
              </Box>

              <Box sx={{ mb: 4 }}>
                <Typography variant="h6" gutterBottom color="primary">
                  常见陷阱
                </Typography>
                <Alert severity="warning" icon={<Warning />}>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {result.implementation_guidance?.common_pitfalls?.map((item, idx) => (
                      <li key={idx}>
                        <Typography variant="body2">{item}</Typography>
                      </li>
                    )) || <Typography variant="body2">暂无信息</Typography>}
                  </ul>
                </Alert>
              </Box>

              <Box>
                <Typography variant="h6" gutterBottom color="primary">
                  预计时间
                </Typography>
                <Typography variant="body1">
                  {result.implementation_guidance?.timeline_estimate || '暂无信息'}
                </Typography>
              </Box>
            </TabPanel>
          </Paper>

          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Button
              variant="outlined"
              onClick={() => {
                setResult(null)
                setTaskId(null)
                setError(null)
              }}
              startIcon={<Book />}
            >
              重新解读
            </Button>
          </Box>
        </>
      )}
    </main>
  )
}
