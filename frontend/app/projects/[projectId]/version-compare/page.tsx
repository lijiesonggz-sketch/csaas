'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useParams, useRouter } from 'next/navigation'
import {
  GitCompare,
  ArrowLeft,
  AlertCircle,
  Loader2,
  FileText,
  Plus,
  Minus,
  Edit,
  TrendingUp,
  CheckCircle,
  ArrowRightLeft,
  Network,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { message } from '@/lib/message'
import { AITasksAPI } from '@/lib/api/ai-tasks'
import { apiFetch } from '@/lib/utils/api'
import { useTaskProgressPolling } from '@/lib/hooks/useTaskProgressPolling'
import { CrossCompareForm } from '@/components/version-compare/CrossCompareForm'
import {
  CrossCompareResult,
  CrossCompareData,
} from '@/components/version-compare/CrossCompareResult'

interface VersionCompareResult {
  version_info: {
    old_version: string
    new_version: string
    comparison_summary: string
  }
  added_clauses: Array<{
    clause_id: string
    clause_text: string
    impact: string
    action_required: string
  }>
  modified_clauses: Array<{
    clause_id: string
    old_text: string
    new_text: string
    change_type: 'MINOR' | 'MAJOR'
    impact: string
    migration_guide: string
  }>
  deleted_clauses: Array<{
    clause_id: string
    old_text: string
    impact: string
    alternative: string
  }>
  statistics: {
    total_added: number
    total_modified: number
    total_deleted: number
    change_percentage: number
    total_unchanged?: number
    total_renumbered?: number
  }
  migration_recommendations: string[]
  renumbered_clauses?: Array<{
    old_clause_id: string
    new_clause_id: string
    similarity: number
    text_changed: boolean
  }>
  alignment_meta?: {
    mode: 'clause' | 'paragraph' | 'ai_fallback'
    old_unit_count: number
    new_unit_count: number
    unchanged_count: number
    ai_analyzed_pairs: number
    ai_batch_failures: number
  }
}

export default function VersionComparePage() {
  const params = useParams<{ projectId: string }>()
  const router = useRouter()
  const { status } = useSession()
  const projectId = params?.projectId ?? ''

  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [result, setResult] = useState<VersionCompareResult | null>(null)
  const [taskId, setTaskId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [documents, setDocuments] = useState<any[]>([])
  const [oldVersionId, setOldVersionId] = useState<string>('')
  const [newVersionId, setNewVersionId] = useState<string>('')

  // 多标准交叉分析模式状态
  const [mode, setMode] = useState<'version' | 'cross'>('version')
  const [crossSelectedIds, setCrossSelectedIds] = useState<string[]>([])
  const [crossTaskId, setCrossTaskId] = useState<string | null>(null)
  const [crossResult, setCrossResult] = useState<CrossCompareData | null>(null)
  const [crossLoading, setCrossLoading] = useState(false)
  const [crossError, setCrossError] = useState<string | null>(null)

  // 使用轮询 hook 监听任务进度
  const { progress } = useTaskProgressPolling({
    taskId: taskId || undefined,
    enabled: !!taskId && loading && !result && !error,
    pollingInterval: 5000,
    onComplete: async (status) => {
      if (status.status === 'completed') {
        try {
          const task = await AITasksAPI.getTask(taskId!)
          if (task && task.result) {
            let compareResult: VersionCompareResult
            if (task.result.content) {
              try {
                compareResult =
                  typeof task.result.content === 'string'
                    ? JSON.parse(task.result.content)
                    : task.result.content
              } catch (e) {
                console.error('Failed to parse result:', e)
                compareResult = task.result.content
              }
            } else if (task.result.gpt4 || task.result.claude || task.result.domestic) {
              compareResult = task.result.gpt4 || task.result.claude || task.result.domestic
            } else {
              compareResult = task.result
            }
            setResult(compareResult)
            setLoading(false)
            message.success('版本比对完成！')
          } else {
            setError('任务结果为空')
            setLoading(false)
          }
        } catch (err) {
          console.error('Failed to fetch result:', err)
          setError('获取比对结果失败')
          setLoading(false)
        }
      } else if (status.status === 'failed') {
        setError(status.message || '比对失败')
        setLoading(false)
      }
    },
  })

  // 从任务结果中提取业务数据（兼容 content / 三槽位 / 直接结构）
  const extractTaskResult = (taskResult: any) => {
    if (taskResult.content) {
      try {
        return typeof taskResult.content === 'string'
          ? JSON.parse(taskResult.content)
          : taskResult.content
      } catch {
        return taskResult.content
      }
    }
    return taskResult.gpt4 || taskResult.claude || taskResult.domestic || taskResult
  }

  // 交叉分析任务轮询
  const { progress: crossProgress } = useTaskProgressPolling({
    taskId: crossTaskId || undefined,
    enabled: !!crossTaskId && crossLoading && !crossResult && !crossError,
    pollingInterval: 5000,
    onComplete: async (status) => {
      if (status.status === 'completed') {
        try {
          const task = await AITasksAPI.getTask(crossTaskId!)
          if (task && task.result) {
            setCrossResult(extractTaskResult(task.result))
            setCrossLoading(false)
            message.success('多标准交叉分析完成！')
          } else {
            setCrossError('任务结果为空')
            setCrossLoading(false)
          }
        } catch (err) {
          console.error('Failed to fetch cross result:', err)
          setCrossError('获取交叉分析结果失败')
          setCrossLoading(false)
        }
      } else if (status.status === 'failed') {
        setCrossError(status.message || '交叉分析失败')
        setCrossLoading(false)
      }
    },
  })

  const handleCrossCompare = async () => {
    if (crossSelectedIds.length < 2) {
      setCrossError('请至少选择2个文档')
      return
    }
    try {
      setCrossLoading(true)
      setCrossError(null)
      const task = await AITasksAPI.createTask({
        projectId,
        type: 'standard_cross_compare',
        input: { documentIds: crossSelectedIds },
      })
      setCrossTaskId(task.id)
      await apiFetch(`/projects/${projectId}`, {
        method: 'PATCH',
        body: JSON.stringify({ metadata: { crossCompareTaskId: task.id } }),
      })
    } catch (err: any) {
      console.error('Failed to start cross compare:', err)
      setCrossError(err.message || '启动交叉分析失败')
      setCrossLoading(false)
    }
  }

  // 加载项目文档
  const loadDocuments = useCallback(async () => {
    try {
      const response = await apiFetch(`/files/projects/${projectId}/documents/list`, {
        method: 'POST',
      })
      const loadedDocuments = Array.isArray(response)
        ? response
        : Array.isArray((response as any)?.data)
          ? (response as any).data
          : []
      setDocuments(loadedDocuments)
    } catch (err) {
      console.error('Failed to load documents:', err)
    }
  }, [projectId])

  // 检查是否有已保存的比对任务
  const loadSavedTask = useCallback(async () => {
    try {
      const project = await apiFetch(`/projects/${projectId}`)

      if (project.metadata?.versionCompareTaskId) {
        const savedTaskId = project.metadata.versionCompareTaskId
        setTaskId(savedTaskId)

        try {
          const task = await AITasksAPI.getTask(savedTaskId)
          if (task && task.status === 'completed' && task.result) {
            let compareResult: VersionCompareResult
            if (task.result.content) {
              compareResult =
                typeof task.result.content === 'string'
                  ? JSON.parse(task.result.content)
                  : task.result.content
            } else if (task.result.gpt4 || task.result.claude || task.result.domestic) {
              compareResult = task.result.gpt4 || task.result.claude || task.result.domestic
            } else {
              compareResult = task.result
            }
            setResult(compareResult)
          } else if (task.status === 'processing' || task.status === 'pending') {
            setLoading(true)
          } else if (task.status === 'failed') {
            setError(task.errorMessage || '版本比对任务失败，请重新比对。')
            setLoading(false)
          }
        } catch (err) {
          console.log('Failed to load saved task:', err)
        }
      }
      // 恢复交叉分析任务
      if (project.metadata?.crossCompareTaskId) {
        const savedCrossTaskId = project.metadata.crossCompareTaskId
        setCrossTaskId(savedCrossTaskId)
        try {
          const task = await AITasksAPI.getTask(savedCrossTaskId)
          if (task && task.status === 'completed' && task.result) {
            setCrossResult(extractTaskResult(task.result))
          } else if (task.status === 'processing' || task.status === 'pending') {
            setCrossLoading(true)
          } else if (task.status === 'failed') {
            setCrossError(task.errorMessage || '交叉分析任务失败，请重新分析。')
          }
        } catch (err) {
          console.log('Failed to load saved cross task:', err)
        }
      }
    } catch (err) {
      console.error('Failed to load project:', err)
    } finally {
      setInitializing(false)
    }
  }, [projectId])

  useEffect(() => {
    if (status !== 'authenticated') {
      return
    }

    loadDocuments()
    loadSavedTask()
  }, [status, loadDocuments, loadSavedTask])

  const handleCompare = async () => {
    if (!oldVersionId || !newVersionId) {
      setError('请选择两个文档进行比对')
      return
    }

    if (oldVersionId === newVersionId) {
      setError('请选择两个不同的文档')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const oldDoc = documents.find((d) => d.id === oldVersionId)
      const newDoc = documents.find((d) => d.id === newVersionId)

      if (!oldDoc || !newDoc) {
        setError('找不到选中的文档')
        setLoading(false)
        return
      }

      // 创建版本比对任务（传 documentIds，由后端按序加载完整文档，避免传全文）
      const task = await AITasksAPI.createTask({
        projectId,
        type: 'standard_version_compare',
        input: {
          documentIds: [oldDoc.id, newDoc.id],
        },
      })

      setTaskId(task.id)

      // 保存 taskId 到项目 metadata
      await apiFetch(`/projects/${projectId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          metadata: {
            versionCompareTaskId: task.id,
          },
        }),
      })
    } catch (err: any) {
      console.error('Failed to start comparison:', err)
      setError(err.message || '启动比对失败')
      setLoading(false)
    }
  }

  const getChangeTypeColor = (changeType: string) => {
    switch (changeType) {
      case 'MAJOR':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'MINOR':
        return 'bg-amber-100 text-amber-800 border-amber-200'
      default:
        return 'bg-slate-100 text-slate-800 border-[#E2E8F0]'
    }
  }

  const getChangeTypeLabel = (changeType: string) => {
    switch (changeType) {
      case 'MAJOR':
        return '重大变更'
      case 'MINOR':
        return '轻微变更'
      default:
        return changeType
    }
  }

  if (status === 'loading' || (status === 'authenticated' && initializing)) {
    return (
      <div className="w-full px-6 py-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-sm bg-slate-100 flex items-center justify-center">
            <GitCompare className="w-5 h-5 text-[#1E3A5F]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1E3A5F]">版本比对</h1>
            <p className="text-sm text-[#94A3B8]">比较两个标准文档的差异</p>
          </div>
        </div>
        <Card className="border border-[#E2E8F0] rounded-sm shadow-sm">
          <CardContent className="py-16 text-center">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-[#1E3A5F]" />
            <h3 className="text-xl font-semibold text-[#1E3A5F]">正在加载...</h3>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return (
      <div className="w-full px-6 py-8">
        <div className="bg-[#1E3A5F] rounded-sm p-8 mb-8 text-white">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/10 rounded-sm">
                <GitCompare className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold font-[var(--font-plus-jakarta)]">版本比对</h1>
                <p className="text-sm text-white/80 font-[var(--font-inter)]">
                  比较两个标准文档的差异
                </p>
              </div>
            </div>
          </div>
        </div>

        <Alert variant="destructive" className="mb-6 rounded-sm">
          <AlertCircle className="w-4 h-4" />
          <AlertTitle>登录已失效</AlertTitle>
          <AlertDescription>请先登录后再进行版本比对。</AlertDescription>
        </Alert>

        <Card className="border border-[#E2E8F0] rounded-sm shadow-sm">
          <CardContent className="py-16 text-center">
            <Button
              onClick={() => router.push('/login')}
              className="bg-[#1E3A5F] hover:bg-[#152a47] text-white px-6 rounded-sm"
            >
              去登录
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="w-full px-6 py-8">
      {/* 页面头部 */}
      <div className="bg-[#1E3A5F] rounded-sm p-8 mb-8 text-white">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/10 rounded-sm">
              <GitCompare className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-[var(--font-plus-jakarta)]">版本比对</h1>
              <p className="text-sm text-white/80 font-[var(--font-inter)]">
                比较两个标准文档的差异，识别新增、修改、删除的条款
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={() => router.back()}
            className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white rounded-sm"
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

      {/* 模式切换 */}
      <div className="mb-6 inline-flex rounded-lg border border-[#E2E8F0] bg-white p-1">
        <Button
          variant={mode === 'version' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setMode('version')}
          className={
            mode === 'version' ? 'bg-[#1E3A5F] text-white hover:bg-[#152a47]' : 'text-[#64748B]'
          }
        >
          <GitCompare className="w-4 h-4 mr-2" />
          版本比对（前后版本）
        </Button>
        <Button
          variant={mode === 'cross' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setMode('cross')}
          className={
            mode === 'cross' ? 'bg-[#1E3A5F] text-white hover:bg-[#152a47]' : 'text-[#64748B]'
          }
        >
          <Network className="w-4 h-4 mr-2" />
          多标准交叉分析（跨机构）
        </Button>
      </div>

      {mode === 'cross' ? (
        <>
          {crossError && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="w-4 h-4" />
              <AlertTitle>错误</AlertTitle>
              <AlertDescription>{crossError}</AlertDescription>
            </Alert>
          )}
          {!crossResult ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="border-2 border-dashed border-[#E2E8F0] rounded-lg p-12">
                  {documents.length < 2 ? (
                    <Alert className="text-left">
                      <AlertCircle className="w-4 h-4" />
                      <AlertTitle>提示</AlertTitle>
                      <AlertDescription>请先上传至少两个标准文档</AlertDescription>
                    </Alert>
                  ) : (
                    <CrossCompareForm
                      documents={documents}
                      selectedIds={crossSelectedIds}
                      onSelectionChange={setCrossSelectedIds}
                      onCompare={handleCrossCompare}
                      loading={crossLoading}
                      progressPercentage={crossProgress?.percentage}
                      progressMessage={crossProgress?.stageMessage || crossProgress?.message}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <CrossCompareResult result={crossResult} />
              <div className="mt-6 text-center">
                <Button
                  variant="outline"
                  onClick={() => {
                    setCrossResult(null)
                    setCrossTaskId(null)
                    setCrossError(null)
                    setCrossSelectedIds([])
                  }}
                >
                  <Network className="w-4 h-4 mr-2" />
                  重新分析
                </Button>
              </div>
            </>
          )}
        </>
      ) : !result ? (
        <Card className="border-0 shadow-[0_4px_6px_-1px_rgba(99,102,241,0.1),0_2px_4px_-1px_rgba(99,102,241,0.06)]">
          <CardContent className="p-6">
            <div className="border-2 border-dashed border-[#E2E8F0] rounded-lg p-12">
              {documents.length < 2 ? (
                <Alert className="mb-6 text-left">
                  <AlertCircle className="w-4 h-4" />
                  <AlertTitle>提示</AlertTitle>
                  <AlertDescription>请先上传至少两个文档，然后才能进行版本比对</AlertDescription>
                </Alert>
              ) : (
                <div className="max-w-2xl mx-auto">
                  <div className="text-center mb-8">
                    <FileText className="w-12 h-12 text-indigo-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-[#1E3A5F] mb-2">选择要比对的文档</h3>
                    <p className="text-sm text-[#94A3B8]">
                      已准备好 {documents.length} 个文档，请选择旧版本和新版本进行比对
                    </p>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-[#1E3A5F] mb-2">
                        旧版本（基准版本）
                      </label>
                      <Select value={oldVersionId} onValueChange={setOldVersionId}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="请选择旧版本文档" />
                        </SelectTrigger>
                        <SelectContent>
                          {documents.map((doc) => (
                            <SelectItem key={doc.id} value={doc.id}>
                              {doc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[#1E3A5F] mb-2">
                        新版本（对比版本）
                      </label>
                      <Select value={newVersionId} onValueChange={setNewVersionId}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="请选择新版本文档" />
                        </SelectTrigger>
                        <SelectContent>
                          {documents.map((doc) => (
                            <SelectItem key={doc.id} value={doc.id}>
                              {doc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="text-center mt-8">
                    <Button
                      onClick={handleCompare}
                      disabled={loading || !oldVersionId || !newVersionId}
                      className="bg-[#1E3A5F] hover:from-[#1E3A5F] hover:to-[#152a47] text-white px-6"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          比对中...
                        </>
                      ) : (
                        <>
                          <GitCompare className="w-4 h-4 mr-2" />
                          开始比对
                        </>
                      )}
                    </Button>
                  </div>

                  {loading && (
                    <div className="mt-8">
                      <Progress value={progress?.percentage || 0} className="h-2 mb-4" />
                      <p className="text-center text-sm text-[#94A3B8]">
                        {progress?.message || '正在进行版本比对...'}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 统计概览卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-green-100 rounded-lg">
                    <Plus className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-[#94A3B8]">新增条款</p>
                    <p className="text-2xl font-bold text-[#1E3A5F]">
                      {result.statistics.total_added}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-amber-100 rounded-lg">
                    <Edit className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm text-[#94A3B8]">修改条款</p>
                    <p className="text-2xl font-bold text-[#1E3A5F]">
                      {result.statistics.total_modified}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-red-100 rounded-lg">
                    <Minus className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm text-[#94A3B8]">删除条款</p>
                    <p className="text-2xl font-bold text-[#1E3A5F]">
                      {result.statistics.total_deleted}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-indigo-100 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm text-[#94A3B8]">变更率</p>
                    <p className="text-2xl font-bold text-[#1E3A5F]">
                      {(result.statistics.change_percentage * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {result.statistics.total_unchanged !== undefined && (
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-slate-100 rounded-lg">
                      <CheckCircle className="w-5 h-5 text-slate-600" />
                    </div>
                    <div>
                      <p className="text-sm text-[#94A3B8]">未变条款</p>
                      <p className="text-2xl font-bold text-[#1E3A5F]">
                        {result.statistics.total_unchanged}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {result.statistics.total_renumbered !== undefined &&
              result.statistics.total_renumbered > 0 && (
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-blue-100 rounded-lg">
                        <ArrowRightLeft className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-[#94A3B8]">重编号条款</p>
                        <p className="text-2xl font-bold text-[#1E3A5F]">
                          {result.statistics.total_renumbered}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
          </div>

          {result.alignment_meta && (
            <Alert className="mb-6">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>
                比对方式：
                {result.alignment_meta.mode === 'clause'
                  ? `条款级对齐（旧版 ${result.alignment_meta.old_unit_count} 条 / 新版 ${result.alignment_meta.new_unit_count} 条，AI 仅分析 ${result.alignment_meta.ai_analyzed_pairs} 个变更对）`
                  : result.alignment_meta.mode === 'paragraph'
                    ? '该文档无标准条款编号，已按段落对齐比对'
                    : '小型非结构化文档，已整文 AI 直比'}
                {result.alignment_meta.ai_batch_failures > 0 &&
                  `；有 ${result.alignment_meta.ai_batch_failures} 个分析批次失败，相关条款已标注需人工复核`}
              </AlertDescription>
            </Alert>
          )}

          {/* 比对结果详情 */}
          <Card className="border-0 shadow-sm">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList
                className={`grid w-full ${
                  result.renumbered_clauses && result.renumbered_clauses.length > 0
                    ? 'grid-cols-5'
                    : 'grid-cols-4'
                }`}
              >
                <TabsTrigger value="overview" className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  概述
                </TabsTrigger>
                <TabsTrigger value="added" className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  新增条款 ({result.added_clauses.length})
                </TabsTrigger>
                <TabsTrigger value="modified" className="flex items-center gap-2">
                  <Edit className="w-4 h-4" />
                  修改条款 ({result.modified_clauses.length})
                </TabsTrigger>
                <TabsTrigger value="deleted" className="flex items-center gap-2">
                  <Minus className="w-4 h-4" />
                  删除条款 ({result.deleted_clauses.length})
                </TabsTrigger>
                {result.renumbered_clauses && result.renumbered_clauses.length > 0 && (
                  <TabsTrigger value="renumbered" className="flex items-center gap-2">
                    <ArrowRightLeft className="w-4 h-4" />
                    重编号 ({result.renumbered_clauses.length})
                  </TabsTrigger>
                )}
              </TabsList>

              {/* 概述 */}
              <TabsContent value="overview" className="p-6">
                <h2 className="text-xl font-semibold text-[#1E3A5F] mb-6">版本比对概述</h2>

                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium text-[#1E3A5F] mb-2">版本信息</h3>
                    <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                      <p className="text-sm text-[#64748B]">
                        <span className="font-medium">旧版本：</span>
                        {result.version_info.old_version}
                      </p>
                      <p className="text-sm text-[#64748B]">
                        <span className="font-medium">新版本：</span>
                        {result.version_info.new_version}
                      </p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium text-[#1E3A5F] mb-2">总体变化</h3>
                    <p className="text-[#64748B]">{result.version_info.comparison_summary}</p>
                  </div>

                  <div className="border-t border-[#E2E8F0] pt-6">
                    <h3 className="text-lg font-medium text-[#1E3A5F] mb-3">迁移建议</h3>
                    <ul className="space-y-2">
                      {result.migration_recommendations?.map((rec, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="inline-block w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-sm font-medium flex items-center justify-center flex-shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <span className="text-[#64748B]">{rec}</span>
                        </li>
                      )) || <li className="text-[#94A3B8]">暂无迁移建议</li>}
                    </ul>
                  </div>
                </div>
              </TabsContent>

              {/* 新增条款 */}
              <TabsContent value="added" className="p-6">
                <h2 className="text-xl font-semibold text-[#1E3A5F] mb-6">新增条款</h2>
                {result.added_clauses.length === 0 ? (
                  <p className="text-center text-[#94A3B8] py-12">没有新增的条款</p>
                ) : (
                  <div className="space-y-4">
                    {result.added_clauses.map((clause, idx) => (
                      <Card key={idx} className="border-l-4 border-l-green-500">
                        <CardHeader>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-green-100 text-green-800 border-green-200">
                              {clause.clause_id}
                            </Badge>
                            <Badge className="bg-green-50 text-green-700">新增</Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div>
                            <h4 className="text-sm font-medium text-[#64748B] mb-1">条款内容</h4>
                            <p className="text-sm text-[#94A3B8]">{clause.clause_text}</p>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-[#64748B] mb-1">影响分析</h4>
                            <p className="text-sm text-[#94A3B8]">{clause.impact}</p>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-[#64748B] mb-1">
                              需要采取的行动
                            </h4>
                            <p className="text-sm text-[#94A3B8]">{clause.action_required}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* 修改条款 */}
              <TabsContent value="modified" className="p-6">
                <h2 className="text-xl font-semibold text-[#1E3A5F] mb-6">修改条款</h2>
                {result.modified_clauses.length === 0 ? (
                  <p className="text-center text-[#94A3B8] py-12">没有修改的条款</p>
                ) : (
                  <div className="space-y-4">
                    {result.modified_clauses.map((clause, idx) => (
                      <Card key={idx} className="border-l-4 border-l-amber-500">
                        <CardHeader>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                              {clause.clause_id}
                            </Badge>
                            <Badge className={getChangeTypeColor(clause.change_type)}>
                              {getChangeTypeLabel(clause.change_type)}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="grid md:grid-cols-2 gap-4">
                            <div className="bg-red-50 rounded-lg p-3">
                              <h4 className="text-sm font-medium text-red-700 mb-2">旧版本内容</h4>
                              <p className="text-sm text-red-600">{clause.old_text}</p>
                            </div>
                            <div className="bg-green-50 rounded-lg p-3">
                              <h4 className="text-sm font-medium text-green-700 mb-2">
                                新版本内容
                              </h4>
                              <p className="text-sm text-green-600">{clause.new_text}</p>
                            </div>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-[#64748B] mb-1">影响分析</h4>
                            <p className="text-sm text-[#94A3B8]">{clause.impact}</p>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-[#64748B] mb-1">迁移指南</h4>
                            <p className="text-sm text-[#94A3B8]">{clause.migration_guide}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* 删除条款 */}
              <TabsContent value="deleted" className="p-6">
                <h2 className="text-xl font-semibold text-[#1E3A5F] mb-6">删除条款</h2>
                {result.deleted_clauses.length === 0 ? (
                  <p className="text-center text-[#94A3B8] py-12">没有删除的条款</p>
                ) : (
                  <div className="space-y-4">
                    {result.deleted_clauses.map((clause, idx) => (
                      <Card key={idx} className="border-l-4 border-l-red-500">
                        <CardHeader>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-red-100 text-red-800 border-red-200">
                              {clause.clause_id}
                            </Badge>
                            <Badge className="bg-red-50 text-red-700">删除</Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div>
                            <h4 className="text-sm font-medium text-[#64748B] mb-1">原条款内容</h4>
                            <p className="text-sm text-[#94A3B8]">{clause.old_text}</p>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-[#64748B] mb-1">影响分析</h4>
                            <p className="text-sm text-[#94A3B8]">{clause.impact}</p>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-[#64748B] mb-1">替代方案</h4>
                            <p className="text-sm text-[#94A3B8]">{clause.alternative}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
              {/* 重编号条款 */}
              <TabsContent value="renumbered" className="p-6">
                <h2 className="text-xl font-semibold text-[#1E3A5F] mb-6">重编号条款</h2>
                <p className="text-sm text-[#94A3B8] mb-4">
                  以下条款在新版本中编号发生变化（系统按文本相似度自动匹配）。正文有变化的条款同时出现在“修改条款”中。
                </p>
                <div className="space-y-3">
                  {result.renumbered_clauses?.map((item, idx) => (
                    <Card key={idx} className="border-l-4 border-l-blue-500">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3 flex-wrap">
                          <Badge variant="outline" className="bg-slate-50">
                            {item.old_clause_id}
                          </Badge>
                          <ArrowRightLeft className="w-4 h-4 text-blue-500" />
                          <Badge variant="outline" className="bg-blue-50 text-blue-700">
                            {item.new_clause_id}
                          </Badge>
                          <Badge className="bg-blue-100 text-blue-800">
                            相似度 {(item.similarity * 100).toFixed(0)}%
                          </Badge>
                          {item.text_changed ? (
                            <Badge className="bg-amber-100 text-amber-800">正文有修改</Badge>
                          ) : (
                            <Badge className="bg-emerald-100 text-emerald-800">仅编号变化</Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
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
                setOldVersionId('')
                setNewVersionId('')
              }}
            >
              <GitCompare className="w-4 h-4 mr-2" />
              重新比对
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
