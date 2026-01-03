'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { AITasksAPI, AITask } from '@/lib/api/ai-tasks'
import { useTaskProgress } from '@/lib/hooks/useTaskProgress'
import ActionPlanResultDisplay from '@/components/features/ActionPlanResultDisplay'
import RollbackButton from '@/components/projects/RollbackButton'
import { ListTodo, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react'
import { TaskAdapter } from '@/lib/adapters/task-adapter'
import type { GenerationResult } from '@/lib/types/ai-generation'

export default function ActionPlanPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const projectId = params.projectId as string

  const [currentTask, setCurrentTask] = useState<AITask | null>(null)
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null)
  const [detailedMeasures, setDetailedMeasures] = useState<any[]>([]) // 详细措施列表（90条）
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [targetMaturity, setTargetMaturity] = useState<number>(3.5) // 默认目标成熟度
  const [showTargetMaturityInput, setShowTargetMaturityInput] = useState(false) // 默认不显示，只有重新生成时才显示
  const [hasGenerated, setHasGenerated] = useState(false) // 标记是否已经生成过任务
  const isGeneratingRef = useRef(false) // 使用ref防止React Strict Mode导致的重复调用

  // 实时进度跟踪
  const { progress, message: progressMessage, isCompleted, isFailed } = useTaskProgress(currentTask?.id || null)

  // 加载现有任务
  useEffect(() => {
    // 双重防护：state + ref
    if (hasGenerated || isGeneratingRef.current) {
      console.log('⚠️ [ActionPlan] 已生成过任务，跳过重复生成')
      return
    }

    // 检查URL参数，如果有surveyResponseId和targetMaturity，说明是从差距分析页面跳转过来
    const urlSurveyResponseId = searchParams.get('surveyResponseId')
    const urlTargetMaturity = searchParams.get('targetMaturity')

    if (urlSurveyResponseId && urlTargetMaturity) {
      console.log('🎯 [ActionPlan] 从差距分析跳转，生成新的改进措施任务')
      console.log('   surveyResponseId:', urlSurveyResponseId)
      console.log('   targetMaturity:', urlTargetMaturity)

      // 立即标记为正在生成，防止重复
      isGeneratingRef.current = true
      setHasGenerated(true)

      // 设置目标成熟度并自动生成
      setTargetMaturity(parseFloat(urlTargetMaturity))
      generateNewActionPlan(urlSurveyResponseId, parseFloat(urlTargetMaturity))
    } else {
      // 没有URL参数，加载现有任务
      loadExistingTasks()
    }
  }, [projectId, searchParams])

  // 生成新的改进措施任务
  const generateNewActionPlan = async (surveyResponseId: string, targetMaturityValue: number) => {
    try {
      setLoading(true)
      setError(null)

      console.log('🚀 [ActionPlan] 生成新的改进措施任务')

      // 调用后端API生成改进措施
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/survey/${surveyResponseId}/action-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetMaturity: targetMaturityValue,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || '生成失败')
      }

      const data = await response.json()
      console.log('✅ [ActionPlan] 任务创建成功:', data)

      if (data.success && data.data.taskId) {
        // 获取任务信息并设置，由 useTaskProgress hook 监听进度
        const task = await AITasksAPI.getTask(data.data.taskId)
        console.log('✅ [ActionPlan] 任务创建成功，任务ID:', data.data.taskId)
        console.log('📊 [ActionPlan] 任务状态:', task.status, '进度:', task.progress + '%')
        setCurrentTask(task)
        // 清除URL参数，避免刷新页面重复生成
        window.history.replaceState({}, '', `/projects/${projectId}/action-plan`)
      }
    } catch (err: any) {
      console.error('❌ [ActionPlan] 生成失败:', err)
      setError(err.message || '生成失败')
      setLoading(false)
      setHasGenerated(false) // 失败时重置标志，允许重试
    }
  }

  const loadExistingTasks = async () => {
    try {
      console.log('🔍 [ActionPlan] 开始加载任务...')
      const tasks = await AITasksAPI.getTasksByProject(projectId)
      console.log('📋 [ActionPlan] 获取到任务数:', tasks.length)

      const actionPlanTasks = tasks.filter(t => t.type === 'action_plan')
      console.log('🎯 [ActionPlan] 筛选后的 action_plan 任务数:', actionPlanTasks.length)

      // 先筛选已完成的任务，再按时间排序取最新的
      const completedTasks = actionPlanTasks.filter(t => t.status === 'completed' && t.result)
      const actionPlanTask = completedTasks.length > 0
        ? completedTasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
        : actionPlanTasks[0] // 如果没有完成的任务，取最新的任务（可能正在处理或失败）

      console.log('📊 [ActionPlan] 已完成任务数:', completedTasks.length)
      console.log('🎯 [ActionPlan] 选中的任务:', actionPlanTask?.id, '状态:', actionPlanTask?.status)

      if (actionPlanTask && actionPlanTask.status === 'completed' && actionPlanTask.result) {
        console.log('✅ [ActionPlan] 找到最新任务并设置结果')
        setCurrentTask(actionPlanTask)

        // 获取详细措施列表
        console.log('📥 [ActionPlan] 正在获取详细措施...')
        const measures = await AITasksAPI.getActionPlanMeasures(actionPlanTask.id)
        console.log('✅ [ActionPlan] 获取到措施数:', measures.length)

        // 保存到 detailedMeasures state（供组件显示使用）
        setDetailedMeasures(measures)

        // 将措施详情添加到 result 中（供TaskAdapter转换使用）
        const taskWithMeasures = {
          ...actionPlanTask,
          result: {
            ...actionPlanTask.result,
            content: {
              measures: measures
            }
          }
        }

        const result = TaskAdapter.toGenerationResult(taskWithMeasures)
        setGenerationResult(result)
        setShowTargetMaturityInput(false) // 有结果时隐藏目标成熟度输入
      } else if (actionPlanTask) {
        console.log('⚠️ [ActionPlan] 任务状态或结果不满足显示条件')
        setCurrentTask(actionPlanTask)
        setShowTargetMaturityInput(false) // 有任务但未完成，也不显示输入框
      } else {
        console.log('❌ [ActionPlan] 没有找到 action_plan 任务')
        setShowTargetMaturityInput(true) // 没有任何任务时，显示输入框
      }
    } catch (err: any) {
      console.error('❌ [ActionPlan] 加载任务失败:', err)
    }
  }

  const handleGenerate = async () => {
    // 防止重复点击
    if (loading) {
      console.log('⚠️ [ActionPlan] 正在生成中，请勿重复点击')
      return
    }

    try {
      setLoading(true)
      setError(null)
      setHasGenerated(true) // 标记已生成

      // 需要先获取surveyResponseId
      // 1. 查找最新的问卷任务
      const tasks = await AITasksAPI.getTasksByProject(projectId)
      const questionnaireTask = tasks
        .filter(t => t.type === 'questionnaire' && t.status === 'completed')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]

      if (!questionnaireTask) {
        throw new Error('未找到已完成的问卷任务，请先完成问卷生成')
      }

      // 2. 查找对应的survey response
      const surveyResponseId = questionnaireTask.result?.surveyResponseId

      if (!surveyResponseId) {
        throw new Error('未找到问卷响应记录，无法生成改进措施')
      }

      console.log('🎯 [ActionPlan] 使用问卷响应ID:', surveyResponseId)

      // 3. 调用后端API生成改进措施（使用 /survey 接口）
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/survey/${surveyResponseId}/action-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetMaturity,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || '生成失败')
      }

      const data = await response.json()
      console.log('✅ [ActionPlan] 任务创建成功:', data)

      if (data.success && data.data.taskId) {
        // 获取任务信息并设置，由 useTaskProgress hook 监听进度
        const task = await AITasksAPI.getTask(data.data.taskId)
        console.log('✅ [ActionPlan] 任务创建成功，任务ID:', data.data.taskId)
        console.log('📊 [ActionPlan] 任务状态:', task.status, '进度:', task.progress + '%')
        setCurrentTask(task)
        setShowTargetMaturityInput(false) // 生成时隐藏输入框
      }
    } catch (err: any) {
      console.error('❌ [ActionPlan] 生成失败:', err)
      setError(err.message || '生成失败')
      setLoading(false)
      setHasGenerated(false) // 失败时重置标志，允许重试
    }
  }

  const handleRegenerate = () => {
    // 重新生成时允许重新选择目标成熟度
    setShowTargetMaturityInput(true)
    setGenerationResult(null)
    setHasGenerated(false) // 重置标志，允许重新生成
  }

  // 监听任务完成
  useEffect(() => {
    if (isCompleted && currentTask?.id) {
      loadTaskResult(currentTask.id)
      setLoading(false)
    }
  }, [isCompleted])

  // 监听任务失败
  useEffect(() => {
    if (isFailed) {
      setError(progressMessage || '生成失败')
      setLoading(false)
    }
  }, [isFailed, progressMessage])

  const loadTaskResult = async (taskId: string) => {
    try {
      console.log('📊 [ActionPlan] 加载任务结果和详细措施:', taskId)
      const task = await AITasksAPI.getTask(taskId)
      if (task.result) {
        const result = TaskAdapter.toGenerationResult(task)
        setGenerationResult(result)
      }

      // 获取详细的措施列表（90条）
      const measures = await AITasksAPI.getActionPlanMeasures(taskId)
      console.log('✅ [ActionPlan] 加载到详细措施:', measures.length, '条')
      setDetailedMeasures(measures)
    } catch (err: any) {
      console.error('Failed to load task result:', err)
    }
  }

  const handleRerunComplete = () => {
    setCurrentTask(null)
    setGenerationResult(null)
    setShowTargetMaturityInput(false)
    setHasGenerated(false) // 重置标志
    loadExistingTasks()
  }

  return (
    <main className="max-w-[1920px] mx-auto px-6 py-8">
      {/* 头部：标题 + 操作按钮 */}
      <header className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-3">
            <ListTodo className="w-8 h-8 text-blue-600" strokeWidth={2} />
            改进措施
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            基于问卷结果生成改进措施建议和行动计划
          </p>
        </div>

        <div className="flex items-center gap-3">
          {showTargetMaturityInput ? (
            <button
              onClick={() => {
                setShowTargetMaturityInput(false)
                setError(null)
              }}
              className="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors min-h-[44px]"
            >
              取消重新生成
            </button>
          ) : (
            <>
              <RollbackButton
                projectId={projectId}
                taskType="action-plan"
                taskTypeName="改进措施"
                backupExists={!!currentTask?.backupResult}
                onRollbackComplete={handleRerunComplete}
              />
              <button
                onClick={() => setShowTargetMaturityInput(true)}
                disabled={!generationResult}
                className="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px]"
              >
                重新生成
              </button>
            </>
          )}
        </div>
      </header>

      {/* 错误提示 */}
      {error && (
        <div
          className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm flex items-start gap-3"
          role="alert"
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" strokeWidth={2} />
          <div className="flex-1">
            <p className="font-medium mb-1">生成失败</p>
            <p>{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="flex-shrink-0 text-red-700 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
            aria-label="关闭错误提示"
          >
            ×
          </button>
        </div>
      )}

      {/* 内容区域 */}
      {/* 如果有结果，显示结果；否则如果正在显示成熟度选择，显示选择界面；否则显示加载状态 */}
      {generationResult ? (
        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
            <CheckCircle2 className="w-6 h-6 text-green-500" strokeWidth={2} />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">改进措施生成完成</h2>
          </div>

          {/* 显示改进措施结果 */}
          <ActionPlanResultDisplay result={generationResult} detailedMeasures={detailedMeasures} />
        </section>
      ) : showTargetMaturityInput ? (
        <section className="text-center py-16 px-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-full">
              <Sparkles className="w-12 h-12 text-blue-500" strokeWidth={2} />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            生成新的改进措施
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            设置目标成熟度并点击下方按钮开始生成改进措施
          </p>

          {/* 目标成熟度选择 */}
          <div className="max-w-md mx-auto mb-8 p-6 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
            <label htmlFor="targetMaturity" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              目标成熟度级别 (1.0 - 5.0)
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                id="targetMaturity"
                min="1.0"
                max="5.0"
                step="0.1"
                value={targetMaturity}
                onChange={(e) => setTargetMaturity(parseFloat(e.target.value))}
                className="flex-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex items-center gap-2 min-w-[80px]">
                <input
                  type="number"
                  min="1.0"
                  max="5.0"
                  step="0.1"
                  value={targetMaturity}
                  onChange={(e) => setTargetMaturity(parseFloat(e.target.value) || 3.5)}
                  className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-center bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <span className="text-sm text-gray-500 dark:text-gray-400">级</span>
              </div>
            </div>
            <div className="mt-3 text-xs text-gray-500 dark:text-gray-400 text-left">
              <div className="flex justify-between mb-1">
                <span>当前成熟度: ~2.5级</span>
                <span>差距: {(targetMaturity - 2.5).toFixed(1)}级</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5 mt-1">
                <div
                  className="bg-blue-600 h-1.5 rounded-full"
                  style={{ width: `${(targetMaturity / 5) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {loading && progress > 0 ? (
            <div className="max-w-md mx-auto">
              <div className="mb-4 flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">生成进度</span>
                <span className="font-medium text-blue-600 dark:text-blue-400">{progress}%</span>
              </div>
              <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-3">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              {progressMessage && (
                <p className="text-sm text-gray-500 dark:text-gray-400">{progressMessage}</p>
              )}
            </div>
          ) : (
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
                  生成措施
                </>
              )}
            </button>
          )}
        </section>
      ) : (
        // 加载中或空状态
        <section className="text-center py-16 px-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-full">
              <Sparkles className="w-12 h-12 text-gray-400 dark:text-gray-500 animate-pulse" strokeWidth={2} />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            加载中...
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            正在加载改进措施数据
          </p>
        </section>
      )}
    </main>
  )
}
