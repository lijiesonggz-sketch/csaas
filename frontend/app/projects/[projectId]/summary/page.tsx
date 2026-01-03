'use client'

import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { AIGenerationAPI } from '@/lib/api/ai-generation'
import { ProjectsAPI } from '@/lib/api/projects'
import SummaryResultDisplay from '@/components/features/SummaryResultDisplay'
import { FileText, Sparkles, AlertCircle } from 'lucide-react'
import type { GenerationResult } from '@/lib/types/ai-generation'
import { v4 as uuidv4 } from 'uuid'

export default function SummaryPage() {
  const params = useParams()
  const projectId = params.projectId as string

  const [taskId, setTaskId] = useState<string | null>(null)
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 页面加载时检查是否有已保存的综述任务
  useEffect(() => {
    loadSavedSummaryTask()
  }, [projectId])

  const loadSavedSummaryTask = async () => {
    try {
      setInitializing(true)
      const project = await ProjectsAPI.getProject(projectId)

      // 检查是否有已保存的综述任务ID
      if (project.metadata?.summaryTaskId) {
        const savedTaskId = project.metadata.summaryTaskId
        setTaskId(savedTaskId)

        // 尝试获取该任务的结果
        try {
          const response = await AIGenerationAPI.getResult(savedTaskId)
          if (response.success && response.data) {
            setGenerationResult(response.data)
          }
        } catch (err) {
          // 任务可能还在处理中或已失败，忽略错误
          console.log('Saved task not ready or failed:', err)
        }
      }
    } catch (err) {
      console.error('Failed to load saved summary task:', err)
    } finally {
      setInitializing(false)
    }
  }

  const handleGenerate = async () => {
    try {
      setLoading(true)
      setError(null)

      // 获取项目信息，提取文档
      const project = await ProjectsAPI.getProject(projectId)

      // 从 metadata.uploadedDocuments 解析文档
      let documentsText = ''
      if (project.metadata?.uploadedDocuments) {
        const documents = project.metadata.uploadedDocuments
        if (Array.isArray(documents) && documents.length > 0) {
          // 合并所有文档内容
          documentsText = documents.map((doc: any) =>
            `=== ${doc.name} ===\n\n${doc.content}`
          ).join('\n\n')
        }
      }

      if (!documentsText || documentsText.length < 100) {
        setError('请先上传至少100字符的文档内容')
        setLoading(false)
        return
      }

      // 使用旧的 AIGenerationAPI
      const newTaskId = uuidv4()
      setTaskId(newTaskId)

      await AIGenerationAPI.generateSummary({
        taskId: newTaskId,
        standardDocument: documentsText,
      })

      // 保存 taskId 到项目 metadata
      await ProjectsAPI.updateProject(projectId, {
        metadata: {
          summaryTaskId: newTaskId,
        },
      })

      // 开始轮询结果
      pollForResult(newTaskId)
    } catch (err: any) {
      setError(err.message || '生成失败')
      setLoading(false)
    }
  }

  const pollForResult = async (taskId: string) => {
    const maxAttempts = 60 // 最多轮询60次（约2分钟）
    let attempts = 0

    const poll = setInterval(async () => {
      attempts++
      try {
        const response = await AIGenerationAPI.getResult(taskId)
        if (response.success && response.data) {
          clearInterval(poll)
          setGenerationResult(response.data)
          setLoading(false)
        }
      } catch (err: any) {
        if (attempts >= maxAttempts) {
          clearInterval(poll)
          setError('生成超时，请重试')
          setLoading(false)
        }
        // 继续轮询
      }
    }, 2000) // 每2秒轮询一次
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
