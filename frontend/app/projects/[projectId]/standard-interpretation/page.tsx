'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { BookOpen, ArrowLeft, AlertCircle, Loader2, FileText, ChevronDown, Lightbulb, CheckCircle, AlertTriangle, GraduationCap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
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

export default function StandardInterpretationPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId as string

  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [result, setResult] = useState<InterpretationResult | null>(null)
  const [taskId, setTaskId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('overview')
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
          standardDocument: {
            id: uploadedDocs[0]?.id || 'doc-1',
            name: uploadedDocs[0]?.name || project.name || '标准文档',
            content: documentsText,
          },
          interpretationMode: 'enterprise',
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
        return 'bg-red-100 text-red-800 border-red-200'
      case 'MEDIUM':
        return 'bg-amber-100 text-amber-800 border-amber-200'
      case 'LOW':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200'
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200'
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

  if (initializing) {
    return (
      <div className="w-full px-6 py-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">标准解读</h1>
            <p className="text-sm text-slate-500">基于上传的标准文档，AI智能解读条款要求</p>
          </div>
        </div>
        <Card className="border-0 shadow-sm">
          <CardContent className="py-16 text-center">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-indigo-500" />
            <h3 className="text-xl font-semibold text-slate-900">正在加载...</h3>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="w-full px-6 py-8">
      {/* 渐变头部 */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#667eea] to-[#764ba2] p-8 mb-8">
        {/* 装饰性径向渐变 */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.1)_0%,transparent_50%)]" />

        <div className="relative flex items-start justify-between">
          <div className="flex items-center gap-4">
            {/* 毛玻璃图标背景 */}
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">标准解读</h1>
              <p className="text-sm text-white/80">基于上传的标准文档，AI智能解读条款要求</p>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={() => router.back()}
            className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="w-4 h-4" />
          <AlertTitle>错误</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!result ? (
        <Card className="border-0 shadow-[0_4px_6px_-1px_rgba(99,102,241,0.1),0_2px_4px_-1px_rgba(99,102,241,0.06)]">
          <CardContent className="p-6">
            <div className="border-2 border-dashed border-slate-200 rounded-lg p-12 text-center">
              {documents.length === 0 ? (
                <Alert className="mb-6 text-left">
                  <AlertCircle className="w-4 h-4" />
                  <AlertTitle>提示</AlertTitle>
                  <AlertDescription>请先上传标准文档，然后才能进行标准解读</AlertDescription>
                </Alert>
              ) : (
                <div className="mb-6">
                  <FileText className="w-12 h-12 text-indigo-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    已准备好 {documents.length} 个文档
                  </h3>
                  <p className="text-sm text-slate-500">
                    文档已就绪，点击下方按钮开始AI智能解读
                  </p>
                </div>
              )}

              <Button
                onClick={handleAnalyze}
                disabled={loading || documents.length === 0}
                className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-6"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    分析中...
                  </>
                ) : (
                  <>
                    <BookOpen className="w-4 h-4 mr-2" />
                    开始解读
                  </>
                )}
              </Button>

              {loading && (
                <div className="mt-6 max-w-md mx-auto">
                  <Progress className="h-2 mb-4" />
                  {progress && (
                    <>
                      <div className="flex justify-between mb-1 text-sm">
                        <span className="text-slate-500">进度</span>
                        <span className="text-slate-700">{progress.percentage || 0}%</span>
                      </div>
                      {progress.stage && (
                        <p className="text-xs text-slate-500">{progress.stage}</p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="border-0 shadow-sm">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview" className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  概述
                </TabsTrigger>
                <TabsTrigger value="terms" className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4" />
                  关键术语
                </TabsTrigger>
                <TabsTrigger value="requirements" className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  条款要求
                </TabsTrigger>
                <TabsTrigger value="guidance" className="flex items-center gap-2">
                  <Lightbulb className="w-4 h-4" />
                  实施指南
                </TabsTrigger>
              </TabsList>

              {/* 概述 */}
              <TabsContent value="overview" className="p-6">
                <h2 className="text-xl font-semibold text-slate-900 mb-6">标准概述</h2>

                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium text-indigo-600 mb-2">背景</h3>
                    <p className="text-slate-700">{result.overview?.background || '暂无信息'}</p>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium text-indigo-600 mb-2">适用范围</h3>
                    <p className="text-slate-700">{result.overview?.scope || '暂无信息'}</p>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium text-indigo-600 mb-2">核心目标</h3>
                    <ul className="list-disc list-inside space-y-1">
                      {result.overview?.core_objectives?.map((obj, idx) => (
                        <li key={idx} className="text-slate-700">{obj}</li>
                      )) || <li className="text-slate-500">暂无信息</li>}
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium text-indigo-600 mb-2">目标受众</h3>
                    <ul className="list-disc list-inside space-y-1">
                      {result.overview?.target_audience?.map((aud, idx) => (
                        <li key={idx} className="text-slate-700">{aud}</li>
                      )) || <li className="text-slate-500">暂无信息</li>}
                    </ul>
                  </div>
                </div>
              </TabsContent>

              {/* 关键术语 */}
              <TabsContent value="terms" className="p-6">
                <h2 className="text-xl font-semibold text-slate-900 mb-6">关键术语定义</h2>
                <Accordion type="single" collapsible className="w-full">
                  {result.key_terms?.map((term, idx) => (
                    <AccordionItem key={idx} value={`term-${idx}`}>
                      <AccordionTrigger className="text-left">
                        <span className="text-indigo-600 font-medium">{term.term}</span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4 pt-2">
                          <div>
                            <h4 className="text-sm font-medium text-slate-700 mb-1">定义</h4>
                            <p className="text-sm text-slate-600">{term.definition}</p>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-slate-700 mb-1">解释</h4>
                            <p className="text-sm text-slate-600">{term.explanation}</p>
                          </div>
                          {term.examples && term.examples.length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium text-slate-700 mb-1">示例</h4>
                              <ul className="list-disc list-inside space-y-1">
                                {term.examples.map((ex, i) => (
                                  <li key={i} className="text-sm text-slate-600">{ex}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )) || <p className="text-slate-500">暂无术语定义</p>}
                </Accordion>
              </TabsContent>

              {/* 条款要求 */}
              <TabsContent value="requirements" className="p-6">
                <h2 className="text-xl font-semibold text-slate-900 mb-6">关键条款要求</h2>
                <Accordion type="single" collapsible className="w-full">
                  {result.key_requirements?.map((req, idx) => (
                    <AccordionItem key={idx} value={`req-${idx}`}>
                      <AccordionTrigger className="text-left">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="bg-indigo-50 text-indigo-700">
                            {req.clause_id}
                          </Badge>
                          <span className="font-medium text-slate-700">
                            {req.clause_summary || req.clause_text?.substring(0, 50) + '...'}
                          </span>
                          <Badge className={getPriorityColor(req.priority)}>
                            {getPriorityLabel(req.priority)}
                          </Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4 pt-2">
                          {req.chapter && (
                            <p className="text-xs text-slate-500">所属章节: {req.chapter}</p>
                          )}
                          <div>
                            <h4 className="text-sm font-medium text-slate-700 mb-1">条款内容</h4>
                            <p className="text-sm text-slate-600">{req.clause_full_text || req.clause_text}</p>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-slate-700 mb-1">AI解读</h4>
                            <p className="text-sm text-slate-600">
                              {typeof req.interpretation === 'string'
                                ? req.interpretation
                                : (req.interpretation as any)?.what || '暂无解读'}
                            </p>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-slate-700 mb-1">合规要求</h4>
                            <ul className="list-disc list-inside space-y-1">
                              {Array.isArray(req.compliance_criteria)
                                ? req.compliance_criteria.map((criteria, i) => (
                                    <li key={i} className="text-sm text-slate-600">{criteria}</li>
                                  ))
                                : <li className="text-sm text-slate-500">暂无具体要求</li>
                              }
                            </ul>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )) || <p className="text-slate-500">暂无条款要求</p>}
                </Accordion>
              </TabsContent>

              {/* 实施指南 */}
              <TabsContent value="guidance" className="p-6">
                <h2 className="text-xl font-semibold text-slate-900 mb-6">实施指南</h2>

                <div className="space-y-8">
                  <div>
                    <h3 className="text-lg font-medium text-indigo-600 mb-3">准备工作</h3>
                    <ul className="list-disc list-inside space-y-1">
                      {result.implementation_guidance?.preparation?.map((item, idx) => (
                        <li key={idx} className="text-slate-700">{item}</li>
                      )) || <li className="text-slate-500">暂无信息</li>}
                    </ul>
                  </div>

                  <div className="border-t border-slate-200 pt-6">
                    <h3 className="text-lg font-medium text-indigo-600 mb-3">实施步骤</h3>
                    <Accordion type="single" collapsible className="w-full">
                      {result.implementation_guidance?.implementation_steps?.map((step, idx) => (
                        <AccordionItem key={idx} value={`step-${idx}`}>
                          <AccordionTrigger>
                            <span className="font-medium text-slate-700">{step.phase}</span>
                          </AccordionTrigger>
                          <AccordionContent>
                            <ol className="list-decimal list-inside space-y-1 pt-2">
                              {step.steps?.map((s, i) => (
                                <li key={i} className="text-sm text-slate-600">{s}</li>
                              ))}
                            </ol>
                          </AccordionContent>
                        </AccordionItem>
                      )) || <p className="text-slate-500">暂无实施步骤</p>}
                    </Accordion>
                  </div>

                  <div className="border-t border-slate-200 pt-6">
                    <h3 className="text-lg font-medium text-indigo-600 mb-3">最佳实践</h3>
                    <ul className="list-disc list-inside space-y-1">
                      {result.implementation_guidance?.best_practices?.map((item, idx) => (
                        <li key={idx} className="text-slate-700">{item}</li>
                      )) || <li className="text-slate-500">暂无信息</li>}
                    </ul>
                  </div>

                  <div className="border-t border-slate-200 pt-6">
                    <h3 className="text-lg font-medium text-indigo-600 mb-3">常见陷阱</h3>
                    <Alert className="border-amber-200 bg-amber-50">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <AlertDescription>
                        <ul className="list-disc list-inside space-y-1 mt-2">
                          {result.implementation_guidance?.common_pitfalls?.map((item, idx) => (
                            <li key={idx} className="text-sm text-slate-700">{item}</li>
                          )) || <li className="text-sm text-slate-500">暂无信息</li>}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  </div>

                  <div className="border-t border-slate-200 pt-6">
                    <h3 className="text-lg font-medium text-indigo-600 mb-3">预计时间</h3>
                    <p className="text-slate-700">
                      {result.implementation_guidance?.timeline_estimate || '暂无信息'}
                    </p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </Card>

          <div className="mt-6 text-center">
            <Button
              variant="outline"
              onClick={() => {
                setResult(null)
                setTaskId(null)
                setError(null)
              }}
            >
              <BookOpen className="w-4 h-4 mr-2" />
              重新解读
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
