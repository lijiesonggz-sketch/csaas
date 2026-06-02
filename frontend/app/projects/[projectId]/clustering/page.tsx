'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Layers, Sparkles, AlertCircle, ArrowLeft, Loader2, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { AIGenerationAPI } from '@/lib/api/ai-generation'
import { apiFetch } from '@/lib/utils/api'
import { useProject } from '@/lib/contexts/ProjectContext'
import ClusteringResultDisplay from '@/components/features/ClusteringResultDisplay'
import type { GenerationResult } from '@/lib/types/ai-generation'
import { useTaskProgressPolling } from '@/lib/hooks/useTaskProgressPolling'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { extractClauseIdsFromContent } from '@/lib/utils/clauseIds'

interface UploadedDocument {
  id: string
  name: string
  content: string
  filename?: string
}

type ClusteringMode = 'structured' | 'ai'

const LEAF_REQUIREMENT_ID_PATTERN = /^\d{1,2}(?:\.\d{1,2}){1,3}-[a-z](?:-\d{1,2})?$/

function analyzeStructuredStandard(documents: UploadedDocument[]) {
  if (documents.length !== 1 || !documents[0]?.content) {
    return {
      isStructured: false,
      leafRequirementCount: 0,
    }
  }

  const clauseIds = extractClauseIdsFromContent(documents[0].content)
  const leafRequirementCount = clauseIds.filter((id) => LEAF_REQUIREMENT_ID_PATTERN.test(id)).length

  return {
    isStructured: leafRequirementCount > 0,
    leafRequirementCount,
  }
}

export default function ClusteringPage() {
  const params = useParams<{ projectId: string }>()
  const router = useRouter()
  const projectId = params?.projectId ?? ''
  const { project, refreshProject } = useProject()

  const [taskId, setTaskId] = useState<string | null>(null)
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null)
  const [documents, setDocuments] = useState<UploadedDocument[]>([])
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [clusteringMode, setClusteringMode] = useState<ClusteringMode>('ai')

  const structuredAnalysis = useMemo(() => analyzeStructuredStandard(documents), [documents])

  useEffect(() => {
    setClusteringMode(structuredAnalysis.isStructured ? 'structured' : 'ai')
  }, [structuredAnalysis.isStructured])

  const { progress } = useTaskProgressPolling({
    taskId: taskId || undefined,
    enabled: !!taskId && loading && !generationResult,
    pollingInterval: 5000,
    onComplete: async (status) => {
      if (status.status === 'completed') {
        try {
          const response = await AIGenerationAPI.getResult(taskId!)

          if (response.success && response.data) {
            setGenerationResult(response.data)
            setLoading(false)
          } else {
            console.warn('⚠️ [Clustering] 结果格式异常:', response)
            setError('结果格式异常，请重试')
            setLoading(false)
          }
        } catch (err) {
          console.error('❌ [Clustering] 获取结果失败:', err)
          setError('获取结果失败: ' + (err instanceof Error ? err.message : '未知错误'))
          setLoading(false)
        }
      } else if (status.status === 'failed') {
        setError(status.message || '生成失败')
        setLoading(false)
      }
    },
  })

  const loadProjectDocuments = useCallback(async (): Promise<UploadedDocument[]> => {
    const metadataDocuments = project?.metadata?.uploadedDocuments
    const fallbackDocs: UploadedDocument[] = Array.isArray(metadataDocuments)
      ? metadataDocuments
          .filter(
            (doc): doc is { id: string; name?: string; filename?: string; content?: string } =>
              typeof doc?.id === 'string'
          )
          .map((doc) => ({
            id: doc.id,
            name: doc.name ?? doc.filename ?? '',
            filename: doc.filename,
            content: doc.content ?? '',
          }))
      : []

    try {
      const docs = await apiFetch<UploadedDocument[]>(
        `/files/projects/${projectId}/documents/list`,
        {
          method: 'GET',
        }
      )

      if (Array.isArray(docs) && docs.length > 0) {
        return docs
          .filter((doc): doc is UploadedDocument => typeof doc?.id === 'string')
          .map((doc) => ({
            id: doc.id,
            name: doc.name ?? doc.filename ?? '',
            filename: doc.filename,
            content: doc.content ?? '',
          }))
      }
    } catch (err) {
      console.warn('⚠️ [Clustering] 文档列表接口加载失败，回退到项目 metadata:', err)
    }

    return fallbackDocs
  }, [project?.metadata?.uploadedDocuments, projectId])

  const loadLatestProject = useCallback(async () => {
    try {
      const latestProject = await apiFetch<any>(`/projects/${projectId}`)
      return latestProject?.id ? latestProject : project
    } catch (err) {
      console.warn('⚠️ [Clustering] 项目详情刷新失败，回退到当前上下文:', err)
      return project
    }
  }, [project, projectId])

  const loadSavedClusteringTask = useCallback(async () => {
    if (!project) return

    try {
      setInitializing(true)

      const docs = await loadProjectDocuments()
      setDocuments(docs)

      const latestProject = await loadLatestProject()
      const clusteringTaskId = latestProject?.metadata?.clusteringTaskId
      if (typeof clusteringTaskId === 'string' && clusteringTaskId.length > 0) {
        const savedTaskId: string = clusteringTaskId
        setTaskId(savedTaskId)

        try {
          const { AITasksAPI } = await import('@/lib/api/ai-tasks')
          const task = await AITasksAPI.getTask(savedTaskId)
          if (task && task.status === 'completed' && task.result) {
            setGenerationResult({
              ...task.result,
              taskId: task.id,
              projectId: task.projectId,
              id: task.id,
              generationType: task.type,
            })
            setLoading(false)
          } else {
            throw new Error('Task not completed')
          }
        } catch (err) {
          try {
            const { AITasksAPI } = await import('@/lib/api/ai-tasks')
            const taskStatus = await AITasksAPI.getTaskStatus(savedTaskId)

            if (taskStatus.status === 'processing' || taskStatus.status === 'pending') {
              setLoading(true)
            } else if (taskStatus.status === 'failed') {
              setError(taskStatus.message || '任务失败')
              setLoading(false)
            } else if (taskStatus.status === 'completed') {
              setTimeout(async () => {
                try {
                  const { AITasksAPI } = await import('@/lib/api/ai-tasks')
                  const task = await AITasksAPI.getTask(savedTaskId)
                  if (task && task.result) {
                    setGenerationResult({
                      ...task.result,
                      taskId: task.id,
                      projectId: task.projectId,
                      id: task.id,
                      generationType: task.type,
                    })
                    setLoading(false)
                  } else {
                    try {
                      const { AIGenerationAPI } = await import('@/lib/api/ai-generation')
                      const response = await AIGenerationAPI.getResult(savedTaskId)
                      if (response.success && response.data) {
                        setGenerationResult(response.data as GenerationResult)
                        setLoading(false)
                      } else {
                        setError('结果加载失败，请刷新页面重试')
                        setLoading(false)
                      }
                    } catch (apiErr) {
                      console.error('❌ [Clustering] getResult API调用失败:', apiErr)
                      setError('获取结果失败，请刷新页面重试')
                      setLoading(false)
                    }
                  }
                } catch (retryErr) {
                  console.error('❌ [Clustering] 重试失败:', retryErr)
                  setError('获取结果失败，请刷新页面重试')
                  setLoading(false)
                }
              }, 1000)
            }
          } catch (statusErr) {
            setLoading(true)
          }
        }
      }
    } catch (err) {
      console.error('❌ [Clustering] 加载聚类任务失败:', err)
    } finally {
      setInitializing(false)
    }
  }, [loadLatestProject, loadProjectDocuments, project])

  const handleGenerate = async () => {
    if (!project) return

    try {
      setLoading(true)
      setError(null)

      const currentDocuments = documents.length > 0 ? documents : await loadProjectDocuments()
      setDocuments(currentDocuments)
      const currentStructuredAnalysis = analyzeStructuredStandard(currentDocuments)
      const effectiveClusteringMode: ClusteringMode = currentStructuredAnalysis.isStructured
        ? clusteringMode
        : 'ai'

      if (!Array.isArray(currentDocuments) || currentDocuments.length < 1) {
        setError('聚类分析至少需要1个文档，请先上传文档')
        setLoading(false)
        return
      }

      const { AITasksAPI } = await import('@/lib/api/ai-tasks')
      const task = await AITasksAPI.createTask({
        projectId,
        type: 'clustering',
        input: {
          documentIds: currentDocuments.map((doc) => doc.id),
          maxTokens: 60000,
          clusteringMode: effectiveClusteringMode,
        },
      })

      setTaskId(task.id)

      await apiFetch(`/projects/${projectId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          metadata: {
            clusteringTaskId: task.id,
          },
        }),
      })
      try {
        await refreshProject()
      } catch (refreshErr) {
        console.warn('⚠️ [Clustering] 项目上下文刷新失败，任务已创建:', refreshErr)
      }
    } catch (err) {
      console.error('❌ [Clustering] 生成失败:', err)
      setError(err instanceof Error ? err.message : '生成失败')
      setLoading(false)
    }
  }

  useEffect(() => {
    if (project) {
      void loadSavedClusteringTask()
    }
  }, [loadSavedClusteringTask, project])

  if (initializing) {
    return (
      <div className="w-full px-6 py-8">
        {/* 渐变头部 */}
        <div className="relative overflow-hidden rounded-3xl bg-[#1E3A5F] p-8 mb-8">
          {/* 装饰性径向渐变 */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.1)_0%,transparent_50%)]" />

          <div className="relative flex items-center gap-4">
            {/* 毛玻璃图标背景 */}
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Layers className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">聚类分析</h1>
              <p className="text-sm text-white/80">基于标准文档生成聚类分析结果</p>
            </div>
          </div>
        </div>
        <Card className="border-0 shadow-[0_4px_6px_-1px_rgba(99,102,241,0.1),0_2px_4px_-1px_rgba(99,102,241,0.06)]">
          <CardContent className="py-16 text-center">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-indigo-500" />
            <h3 className="text-xl font-semibold text-[#1E3A5F]">正在加载...</h3>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="w-full px-6 py-8">
      {/* 渐变头部 */}
      <div className="relative overflow-hidden rounded-3xl bg-[#1E3A5F] p-8 mb-8">
        {/* 装饰性径向渐变 */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.1)_0%,transparent_50%)]" />

        <div className="relative flex items-start justify-between">
          <div className="flex items-center gap-4">
            {/* 毛玻璃图标背景 */}
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Layers className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">聚类分析</h1>
              <p className="text-sm text-white/80">基于标准文档生成聚类分析结果</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                setGenerationResult(null)
                setTaskId(null)
              }}
              disabled={!generationResult}
              className="bg-white/10 border border-white/20 text-white hover:bg-white/20 hover:text-white"
            >
              重新生成
            </Button>
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
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="w-4 h-4" />
          <AlertTitle>生成失败</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!generationResult ? (
        <Card className="border-0 shadow-[0_4px_6px_-1px_rgba(99,102,241,0.1),0_2px_4px_-1px_rgba(99,102,241,0.06)]">
          <CardContent className="py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-6 h-6 text-[#1E3A5F]" />
            </div>
            <h3 className="text-xl font-semibold text-[#1E3A5F] mb-2">还没有生成聚类</h3>
            <p className="text-sm text-[#94A3B8] mb-8">点击下方按钮开始生成聚类分析</p>
            <div className="max-w-2xl mx-auto mb-8 text-left">
              {structuredAnalysis.isStructured && (
                <Alert className="mb-4 border-[#BBF7D0] bg-[#F0FDF4]">
                  <CheckCircle className="w-4 h-4 text-[#059669]" />
                  <AlertTitle className="text-[#065F46]">检测到结构化标准</AlertTitle>
                  <AlertDescription className="text-[#065F46]">
                    识别出 {structuredAnalysis.leafRequirementCount}{' '}
                    个叶子要求项，建议按原始层级生成。
                  </AlertDescription>
                </Alert>
              )}
              <RadioGroup
                value={clusteringMode}
                onValueChange={(value) => setClusteringMode(value as ClusteringMode)}
                className="grid gap-3"
              >
                {structuredAnalysis.isStructured && (
                  <div
                    className={cn(
                      'flex gap-3 rounded-sm border p-4',
                      clusteringMode === 'structured'
                        ? 'border-[#059669] bg-[#F0FDF4]'
                        : 'border-[#E2E8F0] bg-white'
                    )}
                  >
                    <RadioGroupItem
                      id="clustering-mode-structured"
                      value="structured"
                      className="mt-1"
                    />
                    <div className="space-y-1">
                      <Label
                        htmlFor="clustering-mode-structured"
                        className="cursor-pointer font-semibold text-[#1E3A5F]"
                      >
                        按原始层级生成
                      </Label>
                      <p className="text-sm text-[#64748B]">
                        保留标准原有能力项、关键活动和要求项，适合 AIMM 这类层级清晰的单文档。
                      </p>
                    </div>
                  </div>
                )}
                <div
                  className={cn(
                    'flex gap-3 rounded-sm border p-4',
                    clusteringMode === 'ai'
                      ? 'border-[#1E3A5F] bg-[#EFF6FF]'
                      : 'border-[#E2E8F0] bg-white'
                  )}
                >
                  <RadioGroupItem id="clustering-mode-ai" value="ai" className="mt-1" />
                  <div className="space-y-1">
                    <Label
                      htmlFor="clustering-mode-ai"
                      className="cursor-pointer font-semibold text-[#1E3A5F]"
                    >
                      AI语义聚类
                    </Label>
                    <p className="text-sm text-[#64748B]">
                      由 AI 按语义重新归并主题，适合非结构化文档、多标准合并或需要重组目录的场景。
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>
            <Button
              onClick={handleGenerate}
              disabled={loading}
              className="bg-[#1E3A5F] hover:from-[#1E3A5F] hover:to-[#152a47] text-white px-6 py-3 text-lg"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              {loading ? '生成中...' : '开始生成'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-[0_4px_6px_-1px_rgba(99,102,241,0.1),0_2px_4px_-1px_rgba(99,102,241,0.06)]">
          <CardContent className="p-6">
            <ClusteringResultDisplay result={generationResult} documents={documents} />
          </CardContent>
        </Card>
      )}

      {loading && (
        <Card className="mt-6 border-0 shadow-[0_4px_6px_-1px_rgba(99,102,241,0.1),0_2px_4px_-1px_rgba(99,102,241,0.06)]">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-[#1E3A5F] mb-4">生成进度</h3>

            {!progress ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin mr-2 text-indigo-500" />
                <span className="text-sm text-[#94A3B8]">正在连接服务器...</span>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">当前阶段</span>
                    <span className="text-sm font-medium text-[#1E3A5F]">
                      {progress.stage === 'generating_models' && '模型生成中'}
                      {progress.stage === 'quality_validation' && '质量验证中'}
                      {progress.stage === 'aggregating' && '结果聚合中'}
                      {progress.stage === 'completed' && '已完成'}
                      {progress.stage === 'failed' && '失败'}
                    </span>
                  </div>
                  <Progress
                    value={
                      progress.stage === 'generating_models'
                        ? 30
                        : progress.stage === 'quality_validation'
                          ? 60
                          : progress.stage === 'aggregating'
                            ? 80
                            : progress.stage === 'completed'
                              ? 100
                              : 10
                    }
                    className="h-2"
                  />
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium mb-3">AI模型状态</p>

                  {progress.progress.gpt4 && (
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-3 h-3 rounded-full ${
                            progress.progress.gpt4.status === 'completed'
                              ? 'bg-emerald-500'
                              : progress.progress.gpt4.status === 'failed'
                                ? 'bg-red-500'
                                : progress.progress.gpt4.status === 'generating'
                                  ? 'bg-blue-500'
                                  : 'bg-slate-400'
                          }`}
                        />
                        <span className="text-sm font-medium">GPT-4</span>
                      </div>
                      <span className="text-sm text-[#94A3B8]">
                        {progress.progress.gpt4.message}
                      </span>
                    </div>
                  )}

                  {progress.progress.claude && (
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-3 h-3 rounded-full ${
                            progress.progress.claude.status === 'completed'
                              ? 'bg-emerald-500'
                              : progress.progress.claude.status === 'failed'
                                ? 'bg-red-500'
                                : progress.progress.claude.status === 'generating'
                                  ? 'bg-blue-500'
                                  : 'bg-slate-400'
                          }`}
                        />
                        <span className="text-sm font-medium">Claude</span>
                      </div>
                      <span className="text-sm text-[#94A3B8]">
                        {progress.progress.claude.message}
                      </span>
                    </div>
                  )}

                  {progress.progress.domestic && (
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-3 h-3 rounded-full ${
                            progress.progress.domestic.status === 'completed'
                              ? 'bg-emerald-500'
                              : progress.progress.domestic.status === 'failed'
                                ? 'bg-red-500'
                                : progress.progress.domestic.status === 'generating'
                                  ? 'bg-blue-500'
                                  : 'bg-slate-400'
                          }`}
                        />
                        <span className="text-sm font-medium">国内模型</span>
                      </div>
                      <span className="text-sm text-[#94A3B8]">
                        {progress.progress.domestic.message}
                      </span>
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">
                💡
                提示：您可以切换到其他标签页，任务将继续在后台运行。回到此页面时会自动显示最新进度。
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
