'use client'

import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { AIGenerationAPI } from '@/lib/api/ai-generation'
import { ProjectsAPI } from '@/lib/api/projects'
import SummaryResultDisplay from '@/components/features/SummaryResultDisplay'
import { FileText, Sparkles, AlertCircle } from 'lucide-react'
import type { GenerationResult } from '@/lib/types/ai-generation'
import { useTaskProgressPolling } from '@/lib/hooks/useTaskProgressPolling'

export default function SummaryPage() {
  const params = useParams()
  const projectId = params.projectId as string

  const [taskId, setTaskId] = useState<string | null>(null)
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 使用新的轮询hook
  const { progress } = useTaskProgressPolling({
    taskId: taskId || undefined,
    enabled: !!taskId && loading && !generationResult,
    pollingInterval: 5000,
    onComplete: async (status) => {
      if (status.status === 'completed') {
        try {
          const { AITasksAPI } = await import('@/lib/api/ai-tasks')
          const task = await AITasksAPI.getTask(taskId!)
          if (task && task.result) {
            setGenerationResult(task.result)
            setLoading(false)
          }
        } catch (err) {
          console.error('Failed to fetch result:', err)
          setError('获取结果失败')
          setLoading(false)
        }
      } else if (status.status === 'failed') {
        setError(status.message || '生成失败')
        setLoading(false)
      }
    },
  })

  // 页面加载时检查是否有已保存的综述任务
  useEffect(() => {
    loadSavedSummaryTask()
  }, [projectId])

  const loadSavedSummaryTask = async () => {
    try {
      console.log('🔍 [Summary] 开始加载已保存的综述任务')
      setInitializing(true)
      const project = await ProjectsAPI.getProject(projectId)
      console.log('📋 [Summary] 项目metadata:', project.metadata)

      // 检查是否有已保存的综述任务ID
      if (project.metadata?.summaryTaskId) {
        const savedTaskId = project.metadata.summaryTaskId
        console.log('✅ [Summary] 找到已保存的taskId:', savedTaskId)
        setTaskId(savedTaskId)

        // 尝试获取该任务的结果
        try {
          const { AITasksAPI } = await import('@/lib/api/ai-tasks')
          const task = await AITasksAPI.getTask(savedTaskId)
          if (task && task.status === 'completed' && task.result) {
            console.log('✅ [Summary] 任务已完成，加载结果')
            setGenerationResult(task.result)
            setLoading(false)
          } else {
            console.log('⏳ [Summary] 任务未完成，检查任务状态')
            throw new Error('Task not completed')
          }
        } catch (err) {
          console.log('⏳ [Summary] 结果未就绪，检查任务状态:', err.message)
          // 任务可能还在处理中，检查任务状态
          try {
            const { AITasksAPI } = await import('@/lib/api/ai-tasks')
            const taskStatus = await AITasksAPI.getTaskStatus(savedTaskId)
            console.log('📊 [Summary] 任务状态:', taskStatus)

            if (taskStatus.status === 'processing' || taskStatus.status === 'pending') {
              // 任务还在处理中，设置loading状态
              console.log('⏳ [Summary] 任务进行中，设置loading=true')
              setLoading(true)
            } else if (taskStatus.status === 'failed') {
              console.log('❌ [Summary] 任务失败')
              setError(taskStatus.message || '任务失败')
              setLoading(false)
            } else if (taskStatus.status === 'completed') {
              console.log('✅ [Summary] 任务已完成，1秒后重试获取结果...')
              // 任务状态是completed但可能结果还没保存，稍等一下再试
              setTimeout(async () => {
                try {
                  const { AITasksAPI } = await import('@/lib/api/ai-tasks')
                  const task = await AITasksAPI.getTask(savedTaskId)
                  if (task && task.result) {
                    setGenerationResult(task.result)
                    setLoading(false)
                  }
                } catch (retryErr) {
                  console.log('❌ [Summary] 重试失败:', retryErr)
                }
              }, 1000)
            }
          } catch (statusErr) {
            console.log('⚠️ [Summary] 无法获取任务状态:', statusErr)
            // 如果无法获取状态，但有taskId，假设任务可能还在进行中
            setLoading(true)
          }
        }
      } else {
        console.log('ℹ️ [Summary] 没有找到已保存的综述任务')
      }
    } catch (err) {
      console.error('❌ [Summary] 加载综述任务失败:', err)
    } finally {
      setInitializing(false)
    }
  }

  const handleGenerate = async () => {
    try {
      console.log('🚀 [Summary] 开始生成综述')
      setLoading(true)
      setError(null)

      // 获取项目信息，提取文档
      const project = await ProjectsAPI.getProject(projectId)
      console.log('📋 [Summary] 当前项目metadata:', project.metadata)

      // 从 metadata.uploadedDocuments 解析文档
      const documents = project.metadata?.uploadedDocuments || []

      if (!Array.isArray(documents) || documents.length === 0) {
        setError('请先上传至少1个文档')
        setLoading(false)
        return
      }

      console.log(`📄 [Summary] 找到 ${documents.length} 个文档`)

      // 合并所有文档内容
      const documentsText = documents.map((doc: any) =>
        `=== ${doc.name} ===\n\n${doc.content}`
      ).join('\n\n')

      if (!documentsText || documentsText.length < 100) {
        setError('请先上传至少100字符的文档内容')
        setLoading(false)
        return
      }

      console.log(`📝 [Summary] 文档总长度: ${documentsText.length} 字符`)

      // 使用新的异步任务API创建综述任务
      const { AITasksAPI } = await import('@/lib/api/ai-tasks')
      const task = await AITasksAPI.createTask({
        projectId,
        type: 'summary',
        input: {
          standardDocument: documentsText,
          maxTokens: 2000,
        },
      })

      console.log('✨ [Summary] 异步任务已创建:', task.id)
      setTaskId(task.id)

      console.log('✅ [Summary] 现在保存taskId到项目metadata')

      // 保存 taskId 到项目 metadata
      await ProjectsAPI.updateProject(projectId, {
        metadata: {
          summaryTaskId: task.id,
        },
      })

      console.log('✅ [Summary] 已保存taskId到数据库')

      // 轮询由useTaskProgressPolling hook自动处理
    } catch (err: any) {
      console.error('❌ [Summary] 生成失败:', err)
      setError(err.message || '生成失败')
      setLoading(false)
    }
  }

  return (
    <main className="max-w-[1920px] mx-auto px-6 py-8">
      <header className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-3">
            <FileText className="w-8 h-8 text-blue-600" strokeWidth={2} />
            综述生成
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            基于标准文档生成数据安全成熟度评估综述
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

      {initializing ? (
        <section className="text-center py-16 px-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            正在加载...
          </h2>
        </section>
      ) : loading ? (
        <section className="text-center py-16 px-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            正在生成综述...
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            AI正在分析您的文档并生成综述，这可能需要1-2分钟
          </p>
          {progress && (
            <div className="max-w-md mx-auto">
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                <span>进度</span>
                <span>{progress.percentage || 0}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progress.percentage || 0}%` }}
                ></div>
              </div>
              {progress.stage && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  {progress.stage}
                </p>
              )}
            </div>
          )}
        </section>
      ) : !generationResult ? (
        <section className="text-center py-16 px-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-full">
              <Sparkles className="w-12 h-12 text-blue-500" strokeWidth={2} />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            还没有生成综述
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8">
            点击下方按钮开始生成综述
          </p>

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm hover:shadow transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px]"
          >
            {loading ? (
              <>
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" strokeWidth={2} />
                生成综述
              </>
            )}
          </button>
        </section>
      ) : (
        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <SummaryResultDisplay result={generationResult} />
        </section>
      )}
    </main>
  )
}
