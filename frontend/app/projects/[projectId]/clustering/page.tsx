'use client'

import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { AIGenerationAPI } from '@/lib/api/ai-generation'
import { ProjectsAPI } from '@/lib/api/projects'
import ClusteringResultDisplay from '@/components/features/ClusteringResultDisplay'
import { Network, Sparkles, AlertCircle } from 'lucide-react'
import type { GenerationResult } from '@/lib/types/ai-generation'
import { v4 as uuidv4 } from 'uuid'
import { useTaskProgressPolling } from '@/lib/hooks/useTaskProgressPolling'

export default function ClusteringPage() {
  const params = useParams()
  const projectId = params.projectId as string

  const [taskId, setTaskId] = useState<string | null>(null)
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null)
  const [documents, setDocuments] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 使用新的轮询hook
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

  // 页面加载时检查是否有已保存的聚类任务
  useEffect(() => {
    loadSavedClusteringTask()
  }, [projectId])

  const loadSavedClusteringTask = async () => {
    try {
      console.log('🔍 [Clustering] 开始加载已保存的聚类任务')
      setInitializing(true)
      const project = await ProjectsAPI.getProject(projectId)
      console.log('📋 [Clustering] 项目metadata:', project.metadata)

      // 加载文档列表
      const docs = project.metadata?.uploadedDocuments || []
      setDocuments(docs)

      // 检查是否有已保存的聚类任务ID
      if (project.metadata?.clusteringTaskId) {
        const savedTaskId = project.metadata.clusteringTaskId
        console.log('✅ [Clustering] 找到已保存的taskId:', savedTaskId)
        setTaskId(savedTaskId)

        // 尝试获取该任务的结果
        try {
          const { AITasksAPI } = await import('@/lib/api/ai-tasks')
          const task = await AITasksAPI.getTask(savedTaskId)
          if (task && task.status === 'completed' && task.result) {
            console.log('✅ [Clustering] 任务已完成，加载结果')
            // ✅ 传递完整的任务信息（包含 id 和 projectId），不只是 result
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
        } catch (err) {
          console.log('⏳ [Clustering] 结果未就绪，检查任务状态:', err.message)
          // 任务可能还在处理中，检查任务状态
          try {
            const { AITasksAPI } = await import('@/lib/api/ai-tasks')
            const taskStatus = await AITasksAPI.getTaskStatus(savedTaskId)
            console.log('📊 [Clustering] 任务状态:', taskStatus)

            if (taskStatus.status === 'processing' || taskStatus.status === 'pending') {
              // 任务还在处理中，设置loading状态
              console.log('⏳ [Clustering] 任务进行中，设置loading=true')
              setLoading(true)
            } else if (taskStatus.status === 'failed') {
              console.log('❌ [Clustering] 任务失败')
              setError(taskStatus.message || '任务失败')
              setLoading(false)
            } else if (taskStatus.status === 'completed') {
              console.log('✅ [Clustering] 任务已完成，1秒后重试获取结果...')
              // 任务状态是completed但可能结果还没保存，稍等一下再试
              setTimeout(async () => {
                try {
                  const { AITasksAPI } = await import('@/lib/api/ai-tasks')
                  const task = await AITasksAPI.getTask(savedTaskId)
                  if (task && task.result) {
                    // ✅ 传递完整的任务信息（包含 id 和 projectId），不只是 result
                    setGenerationResult({
                      ...task.result,
                      taskId: task.id,
                      projectId: task.projectId,
                      id: task.id,
                      generationType: task.type,
                    })
                    setLoading(false)
                  } else {
                    console.warn('⚠️ [Clustering] 任务已完成但结果为空，尝试通过API获取')
                    // 尝试通过getResult API获取
                    try {
                      const { AIGenerationAPI } = await import('@/lib/api/ai-generation')
                      const response = await AIGenerationAPI.getResult(savedTaskId)
                      if (response.success && response.data) {
                        setGenerationResult(response.data)
                        setLoading(false)
                      } else {
                        console.error('❌ [Clustering] getResult API返回空结果')
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
            // 如果无法获取状态，但有taskId，假设任务可能还在进行中
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
    try {
      console.log('🚀 [Clustering] 开始生成聚类')
      setLoading(true)
      setError(null)

      // 获取项目信息，提取文档
      const project = await ProjectsAPI.getProject(projectId)
      console.log('📋 [Clustering] 当前项目metadata:', project.metadata)

      // 从 metadata.uploadedDocuments 解析文档
      const documents = project.metadata?.uploadedDocuments || []

      if (!Array.isArray(documents) || documents.length < 1) {
        setError('聚类分析至少需要1个文档，请先上传文档')
        setLoading(false)
        return
      }

      console.log(`📄 [Clustering] 找到 ${documents.length} 个文档`)

      // 使用异步任务API创建聚类任务
      const { AITasksAPI } = await import('@/lib/api/ai-tasks')
      const task = await AITasksAPI.createTask({
        projectId,
        type: 'clustering',
        input: {
          // 只传递文档ID，后端会从项目metadata读取完整内容
          documentIds: documents.map((doc: any) => doc.id),
          maxTokens: 60000,
        },
      })

      console.log('✨ [Clustering] 异步任务已创建:', task.id)
      setTaskId(task.id)

      console.log('✅ [Clustering] 现在保存taskId到项目metadata')

      // 保存 taskId 到项目 metadata
      await ProjectsAPI.updateProject(projectId, {
        metadata: {
          clusteringTaskId: task.id,
        },
      })

      console.log('✅ [Clustering] 已保存taskId到数据库')

      // 轮询由useTaskProgressPolling hook自动处理
    } catch (err: any) {
      console.error('❌ [Clustering] 生成失败:', err)
      setError(err.message || '生成失败')
      setLoading(false)
    }
  }

  if (initializing) {
    return (
      <main className="max-w-[1920px] mx-auto px-6 py-8">
        <section className="text-center py-16 px-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            正在加载...
          </h2>
        </section>
      </main>
    )
  }

  return (
    <main className="max-w-[1920px] mx-auto px-6 py-8">
      <header className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-3">
            <Network className="w-8 h-8 text-blue-600" strokeWidth={2} />
            聚类生成
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            基于标准文档生成聚类分析结果
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setGenerationResult(null)
              setTaskId(null)
            }}
            disabled={!generationResult}
            className="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px]"
          >
            重新生成
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" strokeWidth={2} />
          <div className="flex-1">
            <p className="font-medium mb-1">生成失败</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      {!generationResult ? (
        <section className="text-center py-16 px-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-full">
              <Sparkles className="w-12 h-12 text-blue-500" strokeWidth={2} />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            还没有生成聚类
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8">
            点击下方按钮开始生成聚类分析
          </p>

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm hover:shadow transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px]"
          >
            {loading ? (
              <>
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {progress?.message || '生成中...'}
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" strokeWidth={2} />
                开始生成
              </>
            )}
          </button>
        </section>
      ) : (
        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <ClusteringResultDisplay result={generationResult} documents={documents} />
        </section>
      )}

      {/* 细粒度进度显示 */}
      {loading && (
        <section className="mt-6 p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">生成进度</h3>

          {!progress ? (
            <div className="flex items-center justify-center py-8">
              <span className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-3"></span>
              <span className="text-sm text-gray-600 dark:text-gray-400">正在连接服务器...</span>
            </div>
          ) : (
            <>
              {/* 当前阶段 */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">当前阶段</span>
                  <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                    {progress.stage === 'generating_models' && '模型生成中'}
                    {progress.stage === 'quality_validation' && '质量验证中'}
                    {progress.stage === 'aggregating' && '结果聚合中'}
                    {progress.stage === 'completed' && '已完成'}
                    {progress.stage === 'failed' && '失败'}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{
                      width:
                        progress.stage === 'generating_models'
                          ? '30%'
                          : progress.stage === 'quality_validation'
                            ? '60%'
                            : progress.stage === 'aggregating'
                              ? '80%'
                              : progress.stage === 'completed'
                                ? '100%'
                                : '10%',
                    }}
                  />
                </div>
              </div>

              {/* 模型进度 */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">AI模型状态</h4>

                {progress.progress.gpt4 && (
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${
                        progress.progress.gpt4.status === 'completed'
                          ? 'bg-green-500'
                          : progress.progress.gpt4.status === 'failed'
                            ? 'bg-red-500'
                            : progress.progress.gpt4.status === 'generating'
                              ? 'bg-blue-500 animate-pulse'
                              : 'bg-gray-400'
                      }`} />
                      <span className="font-medium text-gray-900 dark:text-white">GPT-4</span>
                    </div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {progress.progress.gpt4.message}
                    </span>
                  </div>
                )}

                {progress.progress.claude && (
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${
                        progress.progress.claude.status === 'completed'
                          ? 'bg-green-500'
                          : progress.progress.claude.status === 'failed'
                            ? 'bg-red-500'
                            : progress.progress.claude.status === 'generating'
                              ? 'bg-blue-500 animate-pulse'
                              : 'bg-gray-400'
                      }`} />
                      <span className="font-medium text-gray-900 dark:text-white">Claude</span>
                    </div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {progress.progress.claude.message}
                    </span>
                  </div>
                )}

                {progress.progress.domestic && (
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${
                        progress.progress.domestic.status === 'completed'
                          ? 'bg-green-500'
                          : progress.progress.domestic.status === 'failed'
                            ? 'bg-red-500'
                            : progress.progress.domestic.status === 'generating'
                              ? 'bg-blue-500 animate-pulse'
                              : 'bg-gray-400'
                      }`} />
                      <span className="font-medium text-gray-900 dark:text-white">国内模型</span>
                    </div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {progress.progress.domestic.message}
                    </span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* 提示信息 */}
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              💡 提示：您可以切换到其他标签页，任务将继续在后台运行。回到此页面时会自动显示最新进度。
            </p>
          </div>
        </section>
      )}
    </main>
  )
}
