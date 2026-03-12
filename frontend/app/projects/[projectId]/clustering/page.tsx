'use client'

import React, { useState, useEffect } from 'react'
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
import { Badge } from '@/components/ui/badge'

export default function ClusteringPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId as string
  const { project } = useProject()

  const [taskId, setTaskId] = useState<string | null>(null)
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null)
  const [documents, setDocuments] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { progress } = useTaskProgressPolling({
    taskId: taskId || undefined,
    enabled: !!taskId && loading && !generationResult,
    pollingInterval: 5000,
    onComplete: async (status) => {
      console.log('🎉 [Clustering] 任务完成回调触发，状态:', status.status)
      if (status.status === 'completed') {
        try {
          console.log('📥 [Clustering] 正在获取结果...')
          const response = await AIGenerationAPI.getResult(taskId!)
          console.log('📊 [Clustering] API响应:', response)

          if (response.success && response.data) {
            console.log('✅ [Clustering] 结果获取成功，更新UI')
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
        console.log('❌ [Clustering] 任务失败:', status.message)
        setError(status.message || '生成失败')
        setLoading(false)
      }
    },
  })

  useEffect(() => {
    if (project) {
      loadSavedClusteringTask()
    }
  }, [project])

  const loadSavedClusteringTask = async () => {
    if (!project) return

    try {
      console.log('🔍 [Clustering] 开始加载已保存的聚类任务')
      setInitializing(true)
      console.log('📋 [Clustering] 项目metadata:', project.metadata)

      const docs = project.metadata?.uploadedDocuments || []
      setDocuments(docs)

      if (project.metadata?.clusteringTaskId) {
        const savedTaskId = project.metadata.clusteringTaskId
        console.log('✅ [Clustering] 找到已保存的taskId:', savedTaskId)
        setTaskId(savedTaskId)

        try {
          const { AITasksAPI } = await import('@/lib/api/ai-tasks')
          const task = await AITasksAPI.getTask(savedTaskId)
          if (task && task.status === 'completed' && task.result) {
            console.log('✅ [Clustering] 任务已完成，加载结果')
            setGenerationResult({
              ...task.result,
              taskId: task.id,
              projectId: task.projectId,
              id: task.id,
              generationType: task.type,
            })
            setLoading(false)
          } else {
            console.log('⏳ [Clustering] 任务未完成，检查任务状态')
            throw new Error('Task not completed')
          }
        } catch (err: any) {
          console.log('⏳ [Clustering] 结果未就绪，检查任务状态:', err.message)
          try {
            const { AITasksAPI } = await import('@/lib/api/ai-tasks')
            const taskStatus = await AITasksAPI.getTaskStatus(savedTaskId)
            console.log('📊 [Clustering] 任务状态:', taskStatus)

            if (taskStatus.status === 'processing' || taskStatus.status === 'pending') {
              setLoading(true)
            } else if (taskStatus.status === 'failed') {
              console.log('❌ [Clustering] 任务失败')
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
                        setGenerationResult(response.data)
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
            console.log('⚠️ [Clustering] 无法获取任务状态:', statusErr)
            setLoading(true)
          }
        }
      } else {
        console.log('ℹ️ [Clustering] 没有找到已保存的聚类任务')
      }
    } catch (err) {
      console.error('❌ [Clustering] 加载聚类任务失败:', err)
    } finally {
      setInitializing(false)
    }
  }

  const handleGenerate = async () => {
    if (!project) return

    try {
      console.log('🚀 [Clustering] 开始生成聚类')
      setLoading(true)
      setError(null)

      console.log('📋 [Clustering] 当前项目metadata:', project.metadata)

      const documents = project.metadata?.uploadedDocuments || []

      if (!Array.isArray(documents) || documents.length < 1) {
        setError('聚类分析至少需要1个文档，请先上传文档')
        setLoading(false)
        return
      }

      console.log(`📄 [Clustering] 找到 ${documents.length} 个文档`)

      const { AITasksAPI } = await import('@/lib/api/ai-tasks')
      const task = await AITasksAPI.createTask({
        projectId,
        type: 'clustering',
        input: {
          documentIds: documents.map((doc: any) => doc.id),
          maxTokens: 60000,
        },
      })

      console.log('✨ [Clustering] 异步任务已创建:', task.id)
      setTaskId(task.id)

      console.log('✅ [Clustering] 现在保存taskId到项目metadata')

      await apiFetch(`/projects/${projectId}`, {
        method: 'PUT',
        body: JSON.stringify({
          metadata: {
            clusteringTaskId: task.id,
          },
        }),
      })

      console.log('✅ [Clustering] 已保存taskId到数据库')
    } catch (err: any) {
      console.error('❌ [Clustering] 生成失败:', err)
      setError(err.message || '生成失败')
      setLoading(false)
    }
  }

  if (initializing) {
    return (
      <div className="w-full px-6 py-8">
        {/* 渐变头部 */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#667eea] to-[#764ba2] p-8 mb-8">
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
              <Sparkles className="w-6 h-6 text-indigo-600" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">还没有生成聚类</h3>
            <p className="text-sm text-slate-500 mb-8">点击下方按钮开始生成聚类分析</p>
            <Button
              onClick={handleGenerate}
              disabled={loading}
              className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-6 py-3 text-lg"
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
            <h3 className="text-lg font-semibold text-slate-900 mb-4">生成进度</h3>

            {!progress ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin mr-2 text-indigo-500" />
                <span className="text-sm text-slate-500">正在连接服务器...</span>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">当前阶段</span>
                    <span className="text-sm font-medium text-indigo-600">
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
                      <span className="text-sm text-slate-500">{progress.progress.gpt4.message}</span>
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
                      <span className="text-sm text-slate-500">{progress.progress.claude.message}</span>
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
                      <span className="text-sm text-slate-500">{progress.progress.domestic.message}</span>
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">
                💡 提示：您可以切换到其他标签页，任务将继续在后台运行。回到此页面时会自动显示最新进度。
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
