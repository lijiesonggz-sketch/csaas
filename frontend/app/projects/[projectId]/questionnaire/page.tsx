'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { ClipboardList, Sparkles, AlertCircle, CheckCircle, ArrowLeft, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AITasksAPI, AITask } from '@/lib/api/ai-tasks'
import { useTaskProgress } from '@/lib/hooks/useTaskProgress'
import { useAITaskCache } from '@/lib/hooks/useAITaskCache'
import QuestionnaireResultDisplay from '@/components/features/QuestionnaireResultDisplay'
import { QuestionnaireProgressDisplay } from '@/components/features/QuestionnaireProgressDisplay'
import RerunTaskDialog from '@/components/projects/RerunTaskDialog'
import RollbackButton from '@/components/projects/RollbackButton'
import { TaskAdapter } from '@/lib/adapters/task-adapter'
import type { GenerationResult } from '@/lib/types/ai-generation'
import { Progress } from '@/components/ui/progress'
import { ProfileCompletenessGate } from '@/components/organizations/ProfileCompletenessGate'
import {
  ProjectQuestionnairePublishImpactResponse,
  ProjectQuestionnaireSnapshotQuestion,
  ProjectQuestionnaireSnapshotResponse,
  SurveyAPI,
} from '@/lib/api/survey'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type EditableQuestion = ProjectQuestionnaireSnapshotQuestion
type QuestionnaireDisplayQuestion = {
  question_id: string
  question_template_id?: string | null
  source_question_id?: string | null
  control_id?: string
  cluster_id: string
  cluster_name: string
  question_text: string
  question_type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'RATING' | 'BINARY'
  options: Array<{
    option_id: string
    text: string
    score: number
    level?: string
    description?: string
  }>
  required: boolean
  guidance: string
  display_order?: number
  scoring_rule?: Record<string, unknown> | null
  is_project_custom?: boolean
}

function buildCoverageMap(questions: EditableQuestion[]): Record<string, number> {
  return questions.reduce<Record<string, number>>((acc, question) => {
    acc[question.cluster_id] = (acc[question.cluster_id] ?? 0) + 1
    return acc
  }, {})
}

function normalizeQuestionsForComparison(questions: EditableQuestion[]): string {
  return JSON.stringify(
    questions
      .map((question) => ({
        question_id: question.question_id,
        question_template_id: question.question_template_id,
        control_id: question.control_id,
        question_type: question.question_type,
        question_text: question.question_text,
        required: question.required,
        display_order: question.display_order,
        scoring_rule: question.scoring_rule,
        options: question.options.map((option) => ({
          option_id: option.option_id,
          text: option.text,
          score: option.score,
          level: option.level ?? null,
          description: option.description ?? null,
        })),
      }))
      .sort((left, right) => left.display_order - right.display_order)
  )
}

function toSnapshotDraftRequest(questions: EditableQuestion[]) {
  return {
    questions: questions.map((question) => ({
      questionId: question.question_id,
      questionTemplateId: question.question_template_id,
      controlId: question.control_id,
      questionType: question.question_type,
      questionText: question.question_text,
      options: question.options.map((option) => ({
        optionId: option.option_id,
        text: option.text,
        score: option.score,
        level: option.level,
        description: option.description,
      })),
      scoringRule: question.scoring_rule,
      required: question.required,
      displayOrder: question.display_order,
    })),
  }
}

function adaptDisplayQuestionsToSnapshot(
  questions: QuestionnaireDisplayQuestion[],
  previousQuestions: EditableQuestion[]
): EditableQuestion[] {
  const previousById = new Map(
    previousQuestions.map((question) => [question.question_id, question])
  )

  return questions.map((question, index) => {
    const previous = previousById.get(question.question_id)

    return {
      question_id: question.question_id,
      question_template_id: question.question_template_id ?? previous?.question_template_id ?? null,
      source_question_id: question.source_question_id ?? previous?.source_question_id ?? null,
      control_id: question.control_id ?? previous?.control_id ?? '',
      cluster_id: question.cluster_id,
      cluster_name: question.cluster_name,
      question_text: question.question_text,
      question_type:
        question.question_type === 'BINARY'
          ? (previous?.question_type ?? 'SINGLE_CHOICE')
          : question.question_type,
      options: question.options.map((option) => ({
        option_id: option.option_id,
        text: option.text,
        score: option.score,
        level: option.level,
        description: option.description,
      })),
      required: question.required,
      guidance: question.guidance,
      display_order: question.display_order ?? previous?.display_order ?? index,
      scoring_rule: question.scoring_rule ?? previous?.scoring_rule ?? null,
      is_project_custom: question.is_project_custom ?? previous?.is_project_custom ?? false,
    }
  })
}

export default function QuestionnairePage() {
  const params = useParams<{ projectId: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { data: session } = useSession()
  const projectId = params?.projectId ?? ''
  const matrixTaskId = searchParams?.get('matrixTaskId') || null
  const organizationId = session?.user?.organizationId || ''

  const [currentTask, setCurrentTask] = useState<AITask | null>(null)
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null)
  const [clusterStatus, setClusterStatus] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rerunDialogOpen, setRerunDialogOpen] = useState(false)
  const [showPartialResult, setShowPartialResult] = useState(false)
  const [snapshotInfo, setSnapshotInfo] = useState<ProjectQuestionnaireSnapshotResponse | null>(
    null
  )
  const [editableQuestions, setEditableQuestions] = useState<EditableQuestion[]>([])
  const [draftEditingEnabled, setDraftEditingEnabled] = useState(false)
  const [savePending, setSavePending] = useState(false)
  const [publishPending, setPublishPending] = useState(false)
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false)
  const [publishImpact, setPublishImpact] =
    useState<ProjectQuestionnairePublishImpactResponse | null>(null)
  const [publishDialogOpen, setPublishDialogOpen] = useState(false)
  const autoGeneratedRef = useRef(false)

  const cache = useAITaskCache()

  const {
    progress,
    message: progressMessage,
    isCompleted,
    isFailed,
  } = useTaskProgress(currentTask?.id || null)

  function mapSnapshotToGenerationResult(
    snapshot: ProjectQuestionnaireSnapshotResponse
  ): GenerationResult {
    return {
      id: snapshot.questionnaireTaskId,
      taskId: snapshot.questionnaireTaskId,
      projectId: snapshot.projectId,
      generationType: 'questionnaire',
      selectedResult: {
        questionnaire: snapshot.questions,
        questionnaire_metadata: {
          generatedAt: snapshot.generatedAt,
          snapshotVersion: snapshot.snapshotVersion,
          resolvedControlSetVersion: snapshot.resolvedControlSetVersion,
          questionSetVersion: snapshot.questionSetVersion,
          sourceControlIds: snapshot.sourceControlIds,
          missingQuestionControlIds: snapshot.missingQuestionControlIds,
          total_questions: snapshot.questions.length,
          estimated_time_minutes: Math.max(1, Math.ceil(snapshot.questions.length * 0.5)),
          coverage_map: {},
        },
      },
      selectedModel: 'gpt4',
      confidenceLevel: 'HIGH',
      qualityScores: {
        structural: 100,
        semantic: 100,
        detail: 100,
      },
      consistencyReport: {
        agreements: [],
        disagreements: [],
        highRiskDisagreements: [],
      },
      reviewStatus: 'APPROVED',
      version: snapshot.snapshotVersion,
      createdAt: snapshot.generatedAt,
    }
  }

  const syncSnapshotState = useCallback((snapshot: ProjectQuestionnaireSnapshotResponse) => {
    setSnapshotInfo(snapshot)
    setEditableQuestions(snapshot.questions)
    setDraftEditingEnabled(snapshot.lifecycleStatus === 'draft')
    setGenerationResult(mapSnapshotToGenerationResult(snapshot))
    setCurrentTask(null)
    setClusterStatus(null)
    setShowPartialResult(false)
  }, [])

  const questionnaireDisplayResult = useMemo(() => {
    if (!generationResult) {
      return null
    }

    if (!snapshotInfo) {
      return generationResult
    }

    return {
      ...generationResult,
      selectedResult: {
        ...(generationResult.selectedResult ?? {}),
        questionnaire: editableQuestions,
        questionnaire_metadata: {
          ...(generationResult.selectedResult?.questionnaire_metadata ?? {}),
          total_questions: editableQuestions.length,
          estimated_time_minutes: Math.max(1, Math.ceil(editableQuestions.length * 0.5)),
          coverage_map: buildCoverageMap(editableQuestions),
        },
      },
    } as GenerationResult
  }, [editableQuestions, generationResult, snapshotInfo])

  const handleEditableQuestionsChange = useCallback((questions: QuestionnaireDisplayQuestion[]) => {
    setEditableQuestions((previousQuestions) =>
      adaptDisplayQuestionsToSnapshot(questions, previousQuestions)
    )
  }, [])

  const isSnapshotMode = Boolean(snapshotInfo)
  const isDraftSnapshot = snapshotInfo?.lifecycleStatus === 'draft'
  const isQuestionnaireEditable = Boolean(snapshotInfo) && (isDraftSnapshot || draftEditingEnabled)
  const hasUnsavedChanges =
    Boolean(snapshotInfo) &&
    normalizeQuestionsForComparison(editableQuestions) !==
      normalizeQuestionsForComparison(snapshotInfo?.questions ?? [])

  const loadLegacyTasks = useCallback(async () => {
    try {
      setSnapshotInfo(null)
      setEditableQuestions([])
      setDraftEditingEnabled(false)
      const cachedQuestionnaire = cache.get(projectId, 'questionnaire')
      if (cachedQuestionnaire) {
        setGenerationResult(cachedQuestionnaire)
      }

      const tasks = await AITasksAPI.getTasksByProject(projectId)
      const questionnaireTasks = tasks.filter((t) => t.type === 'questionnaire')
      const questionnaireTask = questionnaireTasks.sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      )[0]

      if (questionnaireTask) {
        setCurrentTask(questionnaireTask)

        if (questionnaireTask.result) {
          const result = TaskAdapter.toGenerationResult(questionnaireTask)
          setGenerationResult(result)
          cache.set(projectId, 'questionnaire', questionnaireTask.id, result)
        }

        if (questionnaireTask.clusterGenerationStatus) {
          setClusterStatus(questionnaireTask.clusterGenerationStatus)
          const hasPartialResult =
            questionnaireTask.clusterGenerationStatus.completedClusters?.length > 0 &&
            questionnaireTask.clusterGenerationStatus.completedClusters?.length <
              questionnaireTask.clusterGenerationStatus.totalClusters

          if (hasPartialResult && questionnaireTask.result?.questionnaire?.length > 0) {
            setShowPartialResult(true)
          }
        }
      }
    } catch (err: any) {
      console.error('Failed to load tasks:', err)
    }
  }, [projectId, cache])

  const loadExistingQuestionnaire = useCallback(async () => {
    try {
      const snapshot = await SurveyAPI.getProjectQuestionnaireSnapshot(projectId)
      syncSnapshotState(snapshot)
      return
    } catch (err: any) {
      if (err?.status !== 404) {
        console.warn('Snapshot lookup failed, falling back to legacy questionnaire flow:', err)
      }
    }

    await loadLegacyTasks()
  }, [loadLegacyTasks, projectId, syncSnapshotState])

  useEffect(() => {
    loadExistingQuestionnaire()
  }, [loadExistingQuestionnaire])

  const handleGenerateLegacyQuestionnaire = useCallback(
    async (matrixTaskIdParam: string | null) => {
      try {
        setLoading(true)
        setError(null)

        const input: any = {}
        if (matrixTaskIdParam) {
          input.matrixTaskId = matrixTaskIdParam
        }

        const newTask = await AITasksAPI.createTask({
          projectId,
          type: 'questionnaire',
          input,
        })

        setCurrentTask(newTask)
      } catch (err: any) {
        setError(err.message || '生成失败')
        setLoading(false)
      }
    },
    [projectId]
  )

  useEffect(() => {
    if (matrixTaskId && !autoGeneratedRef.current && !generationResult && !loading) {
      autoGeneratedRef.current = true
      handleGenerateLegacyQuestionnaire(matrixTaskId)
    }
  }, [matrixTaskId, generationResult, loading, handleGenerateLegacyQuestionnaire])

  const handleGenerate = useCallback(
    async (regenerate = false) => {
      try {
        setLoading(true)
        setError(null)
        const snapshot = await SurveyAPI.createProjectQuestionnaireSnapshot({
          projectId,
          regenerate,
        })
        syncSnapshotState(snapshot)
        setRerunDialogOpen(false)
        setLoading(false)
      } catch (err: any) {
        if (err?.status === 404 || err?.status === 400) {
          setError(err.message || '当前项目无法生成 KG 问卷快照')
          setLoading(false)
          return
        }

        const tasks = await AITasksAPI.getTasksByProject(projectId)
        const matrixTask = tasks
          .filter((t) => t.type === 'matrix' && t.status === 'completed')
          .sort(
            (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
          )[0]

        if (!matrixTask) {
          setError(err.message || '无法生成 KG 问卷快照，且未找到可回退的矩阵任务')
          setLoading(false)
          return
        }

        await handleGenerateLegacyQuestionnaire(matrixTask.id)
      }
    },
    [handleGenerateLegacyQuestionnaire, projectId, syncSnapshotState]
  )

  const persistDraft =
    useCallback(async (): Promise<ProjectQuestionnaireSnapshotResponse | null> => {
      if (!snapshotInfo) {
        return null
      }

      try {
        setSavePending(true)
        setError(null)
        const snapshot = await SurveyAPI.saveProjectQuestionnaireSnapshotDraft(
          projectId,
          toSnapshotDraftRequest(editableQuestions)
        )
        syncSnapshotState(snapshot)
        return snapshot
      } catch (err: any) {
        setError(err?.message || '保存问卷草稿失败')
        return null
      } finally {
        setSavePending(false)
      }
    }, [editableQuestions, projectId, snapshotInfo, syncSnapshotState])

  const handlePublishSnapshot = useCallback(async () => {
    if (!snapshotInfo) {
      return
    }

    try {
      setPublishPending(true)
      setError(null)

      if (hasUnsavedChanges) {
        const savedSnapshot = await persistDraft()
        if (!savedSnapshot) {
          return
        }
      }

      const impact = await SurveyAPI.getProjectQuestionnairePublishImpact(projectId)
      setPublishImpact(impact)
      setPublishDialogOpen(true)
    } catch (err: any) {
      setError(err?.message || '发布问卷失败')
    } finally {
      setPublishPending(false)
    }
  }, [hasUnsavedChanges, persistDraft, projectId, snapshotInfo, syncSnapshotState])

  const handleConfirmPublish = useCallback(async () => {
    try {
      setPublishPending(true)
      setError(null)
      const publishedSnapshot = await SurveyAPI.publishProjectQuestionnaireSnapshot(projectId)
      syncSnapshotState(publishedSnapshot)
      setPublishDialogOpen(false)
      setPublishImpact(null)
    } catch (err: any) {
      setError(err?.message || '发布问卷失败')
    } finally {
      setPublishPending(false)
    }
  }, [projectId, syncSnapshotState])

  const handleDiscardUnsavedChanges = useCallback(() => {
    if (!snapshotInfo) {
      return
    }

    setEditableQuestions(snapshotInfo.questions)
    setDraftEditingEnabled(snapshotInfo.lifecycleStatus === 'draft')
    setError(null)
  }, [snapshotInfo])

  const handleBackNavigation = useCallback(() => {
    if (hasUnsavedChanges) {
      setLeaveDialogOpen(true)
      return
    }

    router.back()
  }, [hasUnsavedChanges, router])

  const handleConfirmLeaveWithSave = useCallback(async () => {
    const savedSnapshot = await persistDraft()

    if (!savedSnapshot) {
      return
    }

    setLeaveDialogOpen(false)
    router.back()
  }, [persistDraft, router])

  const handleConfirmLeaveDiscard = useCallback(() => {
    handleDiscardUnsavedChanges()
    setLeaveDialogOpen(false)
    router.back()
  }, [handleDiscardUnsavedChanges, router])

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [hasUnsavedChanges])

  const loadTaskResult = useCallback(
    async (taskId: string) => {
      try {
        const task = await AITasksAPI.getTask(taskId)
        if (task.result) {
          const result = TaskAdapter.toGenerationResult(task)
          setGenerationResult(result)
          cache.set(projectId, 'questionnaire', taskId, result)
        }
        if (task.clusterGenerationStatus) {
          setClusterStatus(task.clusterGenerationStatus)
        }
      } catch (err: any) {
        console.error('Failed to load task result:', err)
      }
    },
    [projectId, cache]
  )

  useEffect(() => {
    if (isCompleted && currentTask?.id) {
      loadTaskResult(currentTask.id)
      setLoading(false)
    }
  }, [currentTask?.id, isCompleted, loadTaskResult])

  useEffect(() => {
    if (isFailed) {
      setError(progressMessage || '生成失败')
      setLoading(false)
    }
  }, [isFailed, progressMessage])

  const handleRerunComplete = useCallback(() => {
    setCurrentTask(null)
    setGenerationResult(null)
    setClusterStatus(null)
    setRerunDialogOpen(false)
    loadExistingQuestionnaire()
  }, [loadExistingQuestionnaire])

  const pageContent = (
    <div className="w-full px-6 py-8">
      {/* 渐变头部 */}
      <div className="relative overflow-hidden rounded-3xl bg-[#1E3A5F] p-8 mb-8">
        {/* 装饰性径向渐变 */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.1)_0%,transparent_50%)]" />

        <div className="relative flex items-start justify-between">
          <div className="flex items-center gap-4">
            {/* 毛玻璃图标背景 */}
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <ClipboardList className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">问卷生成</h1>
              <p className="text-sm text-white/80">基于成熟度矩阵生成调研问卷</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <RollbackButton
              projectId={projectId}
              taskType="questionnaire"
              taskTypeName="问卷"
              backupExists={!!currentTask?.backupResult}
              onRollbackComplete={handleRerunComplete}
            />
            {isSnapshotMode &&
              !isQuestionnaireEditable &&
              snapshotInfo?.lifecycleStatus === 'published' && (
                <Button
                  onClick={() => setDraftEditingEnabled(true)}
                  className="bg-white text-[#1E3A5F] hover:bg-white/90"
                >
                  开始编辑
                </Button>
              )}
            {isSnapshotMode && isQuestionnaireEditable && (
              <>
                <Button
                  onClick={() => void persistDraft()}
                  disabled={!hasUnsavedChanges || savePending}
                  className="bg-white text-[#1E3A5F] hover:bg-white/90"
                >
                  {savePending ? '保存中...' : '保存草稿'}
                </Button>
                <Button
                  onClick={() => handleDiscardUnsavedChanges()}
                  disabled={!hasUnsavedChanges}
                  className="bg-white/10 border border-white/20 text-white hover:bg-white/20 hover:text-white"
                >
                  撤销修改
                </Button>
                <Button
                  onClick={() => void handlePublishSnapshot()}
                  disabled={
                    publishPending || savePending || (!hasUnsavedChanges && !isDraftSnapshot)
                  }
                  className="bg-emerald-500 text-white hover:bg-emerald-600"
                >
                  {publishPending ? '发布中...' : '发布问卷'}
                </Button>
              </>
            )}
            <Button
              onClick={() => void handleGenerate(true)}
              disabled={!generationResult}
              className="bg-white/10 border border-white/20 text-white hover:bg-white/20 hover:text-white"
            >
              重新生成
            </Button>
            <Button
              variant="outline"
              onClick={handleBackNavigation}
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

      {/* 聚类进度显示 */}
      {clusterStatus && clusterStatus.totalClusters > 0 && (
        <QuestionnaireProgressDisplay
          taskId={currentTask?.id || ''}
          projectId={projectId}
          clusterStatus={clusterStatus}
        />
      )}

      {/* 部分结果提示 */}
      {showPartialResult && (
        <Alert className="mb-6 bg-amber-50 border-amber-200">
          <div className="flex items-start gap-3">
            <div className="text-amber-600">⚠️</div>
            <div className="flex-1">
              <AlertTitle className="text-amber-800">部分结果可用</AlertTitle>
              <AlertDescription className="text-amber-700">
                已完成 {clusterStatus?.completedClusters?.length || 0} /{' '}
                {clusterStatus?.totalClusters || 0} 个聚类的问卷生成
              </AlertDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowPartialResult(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </Alert>
      )}

      {!generationResult && !showPartialResult ? (
        <Card className="border-0 shadow-[0_4px_6px_-1px_rgba(99,102,241,0.1),0_2px_4px_-1px_rgba(99,102,241,0.06)]">
          <CardContent className="py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-6 h-6 text-[#1E3A5F]" />
            </div>
            <h3 className="text-xl font-semibold text-[#1E3A5F] mb-2">还没有生成问卷</h3>
            <p className="text-sm text-[#94A3B8] mb-8">点击下方按钮开始生成问卷</p>

            {loading && progress > 0 ? (
              <div className="max-w-md mx-auto">
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-[#94A3B8]">生成进度</span>
                  <span className="text-sm font-semibold text-[#1E3A5F]">{progress}%</span>
                </div>
                <Progress value={progress} className="h-3" />
                {progressMessage && (
                  <p className="text-sm text-[#94A3B8] mt-2">{progressMessage}</p>
                )}
              </div>
            ) : (
              <Button
                onClick={() => void handleGenerate()}
                disabled={loading}
                className="bg-[#1E3A5F] hover:from-[#1E3A5F] hover:to-[#152a47] text-white px-6 py-3 text-lg"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                {loading ? '生成中...' : '生成问卷'}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-[0_4px_6px_-1px_rgba(99,102,241,0.1),0_2px_4px_-1px_rgba(99,102,241,0.06)]">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-[#E2E8F0]">
              <CheckCircle className="w-6 h-6 text-emerald-500" />
              <h3 className="text-xl font-semibold text-[#1E3A5F]">问卷生成完成</h3>
              {snapshotInfo && (
                <>
                  <span className="ml-2 text-sm text-[#1E3A5F]">
                    (KG 快照 v{snapshotInfo.snapshotVersion}
                    {snapshotInfo.reusedExisting ? ', 复用现有版本' : ''})
                  </span>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      snapshotInfo.lifecycleStatus === 'draft'
                        ? 'bg-amber-100 text-amber-700'
                        : snapshotInfo.lifecycleStatus === 'published'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-[#64748B]'
                    }`}
                  >
                    {snapshotInfo.lifecycleStatus === 'draft'
                      ? '草稿'
                      : snapshotInfo.lifecycleStatus === 'published'
                        ? '已发布'
                        : '已废弃'}
                  </span>
                  {hasUnsavedChanges && (
                    <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-medium text-rose-700">
                      未保存修改
                    </span>
                  )}
                </>
              )}
              {clusterStatus &&
                clusterStatus.completedClusters?.length < clusterStatus.totalClusters && (
                  <span className="ml-2 text-sm text-amber-600">
                    (部分结果: {clusterStatus.completedClusters.length}/
                    {clusterStatus.totalClusters})
                  </span>
                )}
            </div>
            {questionnaireDisplayResult && (
              <QuestionnaireResultDisplay
                result={questionnaireDisplayResult}
                editable={isQuestionnaireEditable}
                questions={isSnapshotMode ? editableQuestions : undefined}
                onQuestionsChange={isSnapshotMode ? handleEditableQuestionsChange : undefined}
              />
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>检测到未保存修改</DialogTitle>
            <DialogDescription>
              当前问卷存在尚未保存的本地修改。你可以先保存草稿，再离开页面；也可以放弃这些未保存变更。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLeaveDialogOpen(false)}>
              取消离开
            </Button>
            <Button variant="outline" onClick={handleConfirmLeaveDiscard}>
              放弃修改
            </Button>
            <Button onClick={() => void handleConfirmLeaveWithSave()} disabled={savePending}>
              {savePending ? '保存中...' : '保存后离开'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认重新发布问卷</DialogTitle>
            <DialogDescription>
              {publishImpact?.message ?? '发布后会以当前草稿替换项目问卷的已发布版本。'}
            </DialogDescription>
          </DialogHeader>
          {publishImpact && (
            <div className="space-y-3 rounded-lg border border-[#E2E8F0] bg-slate-50 p-4 text-sm text-[#64748B]">
              <div className="flex flex-wrap gap-2">
                <span className="font-medium">影响对象：</span>
                {publishImpact.staleTargets.length > 0 ? (
                  publishImpact.staleTargets.map((target) => (
                    <span
                      key={target}
                      className="rounded-full bg-rose-100 px-2 py-1 text-xs font-medium text-rose-700"
                    >
                      {target}
                    </span>
                  ))
                ) : (
                  <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                    仅展示变更
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="font-medium">变更类型：</span>
                {publishImpact.changeTypes.length > 0 ? (
                  publishImpact.changeTypes.map((changeType) => (
                    <span
                      key={changeType}
                      className="rounded-full bg-slate-200 px-2 py-1 text-xs font-medium text-[#64748B]"
                    >
                      {changeType}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-[#94A3B8]">未检测到结构性差异</span>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPublishDialogOpen(false)
                setPublishImpact(null)
              }}
            >
              取消
            </Button>
            <Button
              onClick={() => void handleConfirmPublish()}
              disabled={publishPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {publishPending ? '发布中...' : '确认发布'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RerunTaskDialog
        open={rerunDialogOpen && Boolean(currentTask)}
        onClose={() => setRerunDialogOpen(false)}
        projectId={projectId}
        taskType="questionnaire"
        taskTypeName="问卷"
        hasBackup={!!currentTask?.backupResult}
        onRerunComplete={handleRerunComplete}
      />
    </div>
  )

  if (!organizationId) {
    return pageContent
  }

  return (
    <ProfileCompletenessGate organizationId={organizationId} flowLabel="项目问卷快照生成">
      {pageContent}
    </ProfileCompletenessGate>
  )
}
