'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Layers, Sparkles, AlertCircle, ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AIGenerationAPI } from '@/lib/api/ai-generation'
import { apiFetch } from '@/lib/utils/api'
import { useProject } from '@/lib/contexts/ProjectContext'
import ClusteringResultDisplay from '@/components/features/ClusteringResultDisplay'
import type { GenerationResult } from '@/lib/types/ai-generation'
import { useTaskProgressPolling } from '@/lib/hooks/useTaskProgressPolling'
import { Progress } from '@/components/ui/progress'

interface UploadedDocument {
  id: string
  name: string
  content: string
}

export default function ClusteringPage() {
  const params = useParams<{ projectId: string }>()
  const router = useRouter()
  const projectId = params?.projectId ?? ''
  const { project } = useProject()

  const [taskId, setTaskId] = useState<string | null>(null)
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null)
  const [documents, setDocuments] = useState<UploadedDocument[]>([])
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  const loadSavedClusteringTask = useCallback(async () => {
    if (!project) return

    try {
      setInitializing(true)

      const uploadedDocuments = project.metadata?.uploadedDocuments
      const docs: UploadedDocument[] = Array.isArray(uploadedDocuments)
        ? uploadedDocuments
            .filter(
              (doc): doc is { id: string; name?: string; content?: string } =>
                typeof doc?.id === 'string'
            )
            .map((doc) => ({
              id: doc.id,
              name: doc.name ?? '',
              content: doc.content ?? '',
            }))
        : []
      setDocuments(docs)

      const clusteringTaskId = project.metadata?.clusteringTaskId
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
  }, [project])

  const handleGenerate = async () => {
    if (!project) return

    try {
      setLoading(true)
      setError(null)

      const uploadedDocuments = project.metadata?.uploadedDocuments
      const documents: UploadedDocument[] = Array.isArray(uploadedDocuments)
        ? uploadedDocuments
            .filter(
              (doc): doc is { id: string; name?: string; content?: string } =>
                typeof doc?.id === 'string'
            )
            .map((doc) => ({
              id: doc.id,
              name: doc.name ?? '',
              content: doc.content ?? '',
            }))
        : []

      if (!Array.isArray(documents) || documents.length < 1) {
        setError('聚类分析至少需要1个文档，请先上传文档')
        setLoading(false)
        return
      }

      const { AITasksAPI } = await import('@/lib/api/ai-tasks')
      const task = await AITasksAPI.createTask({
        projectId,
        type: 'clustering',
        input: {
          documentIds: documents.map((doc) => doc.id),
          maxTokens: 60000,
        },
      })

      setTaskId(task.id)

      await apiFetch(`/projects/${projectId}`, {
        method: 'PUT',
        body: JSON.stringify({
          metadata: {
            clusteringTaskId: task.id,
          },
        }),
      })
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
