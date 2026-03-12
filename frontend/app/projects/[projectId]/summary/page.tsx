'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { FileText, Sparkles, AlertCircle, ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AIGenerationAPI } from '@/lib/api/ai-generation'
import { detectTextQuality } from '@/lib/utils/fileParser'
import { ProjectsAPI } from '@/lib/api/projects'
import { apiFetch } from '@/lib/utils/api'
import SummaryResultDisplay from '@/components/features/SummaryResultDisplay'
import type { GenerationResult } from '@/lib/types/ai-generation'
import { useTaskProgressPolling } from '@/lib/hooks/useTaskProgressPolling'
import { Progress } from '@/components/ui/progress'

export default function SummaryPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId as string

  const [taskId, setTaskId] = useState<string | null>(null)
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null)
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
          const { AITasksAPI } = await import('@/lib/api/ai-tasks')
          const task = await AITasksAPI.getTask(taskId!)
          if (task && task.result) {
            let parsedContent

            if (task.result.content) {
              try {
                parsedContent = typeof task.result.content === 'string'
                  ? JSON.parse(task.result.content)
                  : task.result.content
              } catch (e) {
                console.error('Failed to parse result.content:', e)
                parsedContent = task.result.content
              }
            } else if (task.result.gpt4 || task.result.claude || task.result.domestic) {
              parsedContent = task.result.gpt4 || task.result.claude || task.result.domestic
            } else {
              parsedContent = task.result
            }

            const displayResult = {
              id: task.id,
              taskId: task.id,
              projectId: task.projectId || projectId,
              generationType: 'summary' as const,
              selectedModel: 'gpt4' as const,
              confidenceLevel: 'HIGH' as const,
              reviewStatus: 'PENDING' as const,
              version: 1,
              createdAt: task.createdAt || new Date().toISOString(),
              selectedResult: parsedContent,
              qualityScores: null as any,
              consistencyReport: null as any,
              coverageReport: undefined,
            }

            setGenerationResult(displayResult as any)
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

  const loadSavedSummaryTask = async () => {
    try {
      setInitializing(true)
      const project = await apiFetch(`/projects/${projectId}`)

      if (project.metadata?.summaryTaskId) {
        const savedTaskId = project.metadata.summaryTaskId
        setTaskId(savedTaskId)

        try {
          const { AITasksAPI } = await import('@/lib/api/ai-tasks')
          const task = await AITasksAPI.getTask(savedTaskId)
          if (task && task.status === 'completed' && task.result) {
            let parsedContent

            if (task.result.content) {
              try {
                parsedContent = typeof task.result.content === 'string'
                  ? JSON.parse(task.result.content)
                  : task.result.content
              } catch (e) {
                console.error('Failed to parse result.content:', e)
                parsedContent = task.result.content
              }
            } else if (task.result.gpt4 || task.result.claude || task.result.domestic) {
              parsedContent = task.result.gpt4 || task.result.claude || task.result.domestic
            } else {
              parsedContent = task.result
            }

            const displayResult = {
              id: task.id,
              taskId: task.id,
              projectId: task.projectId || projectId,
              generationType: 'summary' as const,
              selectedModel: 'gpt4' as const,
              confidenceLevel: 'HIGH' as const,
              reviewStatus: 'PENDING' as const,
              version: 1,
              createdAt: task.createdAt || new Date().toISOString(),
              selectedResult: parsedContent,
              qualityScores: null as any,
              consistencyReport: null as any,
              coverageReport: undefined,
            }

            setGenerationResult(displayResult)
            setLoading(false)
          } else {
            setLoading(true)
          }
        } catch (err: any) {
          throw new Error('Task not completed')
        }
      }
    } catch (err) {
      console.error('加载综述任务失败:', err)
    } finally {
      setInitializing(false)
    }
  }

  useEffect(() => {
    loadSavedSummaryTask()
  }, [projectId])

  const handleGenerate = async () => {
    try {
      setLoading(true)
      setError(null)

      const project = await apiFetch(`/projects/${projectId}`)
      const documents = project.metadata?.uploadedDocuments || []

      if (!Array.isArray(documents) || documents.length === 0) {
        setError('请先上传至少1个文档')
        setLoading(false)
        return
      }

      for (const doc of documents) {
        const qualityCheck = detectTextQuality(doc.content)
        if (!qualityCheck.isValid) {
          setError(`文档 "${doc.name}" ${qualityCheck.issue}\n建议：${qualityCheck.suggestion}`)
          setLoading(false)
          return
        }
      }

      const documentsText = documents.map((doc: any) =>
        `=== ${doc.name} ===\n\n${doc.content}`
      ).join('\n\n')

      if (!documentsText || documentsText.length < 100) {
        setError('请先上传至少100字符的文档内容')
        setLoading(false)
        return
      }

      const { AITasksAPI } = await import('@/lib/api/ai-tasks')
      const task = await AITasksAPI.createTask({
        projectId,
        type: 'summary',
        input: {
          standardDocument: documentsText,
          maxTokens: 2000,
        },
      })

      setTaskId(task.id)

      await apiFetch(`/projects/${projectId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          metadata: {
            summaryTaskId: task.id,
          },
        }),
      })
    } catch (err: any) {
      console.error('生成失败:', err)
      setError(err.message || '生成失败')
      setLoading(false)
    }
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
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">综述生成</h1>
              <p className="text-sm text-white/80">
                基于标准文档生成数据安全成熟度评估综述
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                setGenerationResult(null)
                setTaskId(null)
                setTimeout(() => handleGenerate(), 100)
              }}
              disabled={!generationResult || loading}
              className="bg-white/10 border border-white/20 text-white hover:bg-white/20 hover:text-white"
            >
              {loading ? '生成中...' : '重新生成'}
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

      {initializing ? (
        <Card className="border-0 shadow-[0_4px_6px_-1px_rgba(99,102,241,0.1),0_2px_4px_-1px_rgba(99,102,241,0.06)]">
          <CardContent className="py-16 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-indigo-500" />
            <h3 className="text-xl font-semibold text-slate-900">正在加载...</h3>
          </CardContent>
        </Card>
      ) : loading ? (
        <Card className="border-0 shadow-[0_4px_6px_-1px_rgba(99,102,241,0.1),0_2px_4px_-1px_rgba(99,102,241,0.06)]">
          <CardContent className="py-16 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-indigo-500" />
            <h3 className="text-xl font-semibold text-slate-900 mb-2">正在生成综述...</h3>
            <p className="text-sm text-slate-500 mb-6">
              AI正在分析您的文档并生成综述，这可能需要1-2分钟
            </p>
            {progress && (
              <div className="max-w-md mx-auto">
                <div className="flex justify-between mb-2 text-sm">
                  <span className="text-slate-500">进度</span>
                  <span className="font-semibold">{progress.percentage || 0}%</span>
                </div>
                <Progress value={progress.percentage || 0} className="h-2" />
                {progress.stage && (
                  <p className="text-xs text-slate-500 mt-2">{progress.stage}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ) : !generationResult ? (
        <Card className="border-0 shadow-[0_4px_6px_-1px_rgba(99,102,241,0.1),0_2px_4px_-1px_rgba(99,102,241,0.06)]">
          <CardContent className="py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-6 h-6 text-indigo-600" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">还没有生成综述</h3>
            <p className="text-sm text-slate-500 mb-8">点击下方按钮开始生成综述</p>
            <Button
              onClick={handleGenerate}
              disabled={loading}
              className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-6 py-3 text-lg"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              {loading ? '生成中...' : '生成综述'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-[0_4px_6px_-1px_rgba(99,102,241,0.1),0_2px_4px_-1px_rgba(99,102,241,0.06)]">
          <CardContent className="p-6">
            <SummaryResultDisplay result={generationResult} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
