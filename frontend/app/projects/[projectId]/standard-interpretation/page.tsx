'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Card,
  Button,
  Spin,
  Alert,
  Tabs,
  Tag,
  Row,
  Col,
  List,
  Collapse,
  Descriptions,
  Timeline,
  message,
  Space,
  Divider,
  Select,
  Upload,
  Progress,
  Statistic,
} from 'antd'
import {
  ArrowLeftOutlined,
  BookOutlined,
  SearchOutlined,
  DiffOutlined,
  FileTextOutlined,
  UploadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  PlusOutlined,
  MinusOutlined,
  EditOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  FileWordOutlined,
} from '@ant-design/icons'
import { AITasksAPI, AITask } from '@/lib/api/ai-tasks'
import { useTaskProgress } from '@/lib/hooks/useTaskProgress'
import { useAITaskCache } from '@/lib/hooks/useAITaskCache'
import { TaskAdapter } from '@/lib/adapters/task-adapter'
import { ProjectsAPI } from '@/lib/api/projects'
import { apiFetch } from '@/lib/utils/api'
import {
  exportStandardInterpretationToExcel,
  exportStandardInterpretationToWord,
  exportRelatedStandardsToExcel,
  exportRelatedStandardsToWord,
  exportVersionCompareToExcel,
  exportVersionCompareToWord,
} from '@/lib/utils/exportUtils'
import { KeyRequirementsList } from '@/components/performance-optimized/KeyRequirementsList'

const { TabPane } = Tabs
const { Dragger } = Upload
const { Option } = Select

interface StandardInterpretationResult {
  overview: {
    background: string
    scope: string
    core_objectives: string[]
    target_audience: string[]
    key_changes?: string
  }
  key_terms: Array<{
    term: string
    definition: string
    explanation: string
    examples?: string[]
  }>
  key_requirements: Array<{
    clause_id: string
    chapter?: string
    clause_full_text?: string
    clause_summary?: string
    clause_text: string // 兼容旧字段
    interpretation: string | any // 兼容旧格式
    compliance_criteria: string[] | any // 兼容旧格式
    priority: 'HIGH' | 'MEDIUM' | 'LOW'
    risk_assessment?: any
    implementation_order?: number
    estimated_effort?: string
    dependencies?: string[]
    best_practices?: string[]
    common_mistakes?: string[]
  }>
  implementation_guidance: {
    preparation: string[]
    implementation_steps: Array<{
      phase: string
      steps: string[]
      order?: number
      duration?: string
      objectives?: string[]
      deliverables?: string[]
    }>
    best_practices: string[]
    common_pitfalls: string[]
    timeline_estimate: string
    resource_requirements: string | any
    checklists?: any
    evidence_templates?: any[]
  }
  risk_matrix?: any
  implementation_roadmap?: any
}

interface RelatedStandardsResult {
  related_standards: Array<{
    clause_id: string
    clause_text: string
    related_standards: Array<{
      standard_code: string
      standard_name: string
      relation_type: 'REFERENCE' | 'SUPPLEMENT' | 'CONFLICT' | 'SYNERGY'
      relevance_score: number
      description: string
    }>
  }>
  summary: {
    total_related_standards: number
    national_standards_count: number
    industry_standards_count: number
    top_relations: string[]
  }
}

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
  }
  migration_recommendations: string[]
}

export default function StandardInterpretationPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId as string

  const [activeTab, setActiveTab] = useState('interpretation')
  const [currentTask, setCurrentTask] = useState<AITask | null>(null)
  const [interpretationResult, setInterpretationResult] = useState<StandardInterpretationResult | null>(null)
  const [relatedStandardsResult, setRelatedStandardsResult] = useState<RelatedStandardsResult | null>(null)
  const [versionCompareResult, setVersionCompareResult] = useState<VersionCompareResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [interpretationMode, setInterpretationMode] = useState<'basic' | 'detailed' | 'enterprise'>('enterprise')

  const [standardDocument, setStandardDocument] = useState<any>(null)
  const [oldVersionDocument, setOldVersionDocument] = useState<any>(null)
  const [newVersionDocument, setNewVersionDocument] = useState<any>(null)

  // 添加缓存Hook
  const cache = useAITaskCache()

  // 实时进度跟踪
  const { progress, message: progressMessage, isCompleted, isFailed } = useTaskProgress(
    currentTask?.id || null,
  )

  // 加载项目数据和历史任务
  useEffect(() => {
    loadProjectData()
    loadExistingTasks()
  }, [projectId])

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
      console.error('❌ 任务失败:', progressMessage)
      setError(progressMessage || '生成失败，请查看控制台获取详细信息')
      setLoading(false)
    }
  }, [isFailed, progressMessage])

  const loadProjectData = async () => {
    try {
      const project = await apiFetch(`/projects/${projectId}`)
      if (project.metadata?.uploadedDocuments && project.metadata?.uploadedDocuments.length > 0) {
        setStandardDocument(project.metadata?.uploadedDocuments[0])
      }
    } catch (err: any) {
      console.error('Failed to load project data:', err)
    }
  }

  // 加载现有的已完成任务（带缓存）
  const loadExistingTasks = useCallback(async () => {
    try {
      // 尝试从缓存加载
      const cachedInterpretation = cache.get(projectId, 'standard_interpretation')
      const cachedRelated = cache.get(projectId, 'standard_related_search')
      const cachedVersion = cache.get(projectId, 'standard_version_compare')

      if (cachedInterpretation) {
        console.log('✅ 从缓存加载标准解读结果')
        setInterpretationResult(cachedInterpretation)
      }
      if (cachedRelated) {
        console.log('✅ 从缓存加载关联标准结果')
        setRelatedStandardsResult(cachedRelated)
      }
      if (cachedVersion) {
        console.log('✅ 从缓存加载版本比对结果')
        setVersionCompareResult(cachedVersion)
      }

      const tasks = await AITasksAPI.getTasksByProject(projectId)

      // 按创建时间倒序排序，优先加载最新的任务
      const sortedTasks = tasks.sort((a, b) => {
        const dateA = new Date(a.created_at || 0).getTime()
        const dateB = new Date(b.created_at || 0).getTime()
        return dateB - dateA // 降序，最新的在前
      })

      console.log(`📋 找到 ${sortedTasks.length} 个任务`)

      // 分别查找每种类型的最新已完成任务
      let latestInterpretationTask: any = null
      let latestRelatedStandardsTask: any = null
      let latestVersionCompareTask: any = null

      for (const task of sortedTasks) {
        if (
          task.status === 'completed' &&
          task.result &&
          (task.type === 'standard_interpretation' ||
            task.type === 'standard_related_search' ||
            task.type === 'standard_version_compare')
        ) {
          const result = TaskAdapter.toGenerationResult(task)

          if (task.type === 'standard_interpretation' && !latestInterpretationTask) {
            latestInterpretationTask = task
            const interpretationResult = result.selectedResult as StandardInterpretationResult
            setInterpretationResult(interpretationResult)

            // 缓存结果
            cache.set(projectId, 'standard_interpretation', task.id, interpretationResult)

            const mode = task.input?.interpretationMode || 'unknown'
            console.log(`✅ 加载标准解读结果 (模式: ${mode}, 创建时间: ${task.created_at})`)
          } else if (task.type === 'standard_related_search' && !latestRelatedStandardsTask) {
            latestRelatedStandardsTask = task
            const relatedResult = result.selectedResult as RelatedStandardsResult
            setRelatedStandardsResult(relatedResult)

            // 缓存结果
            cache.set(projectId, 'standard_related_search', task.id, relatedResult)

            console.log('✅ 加载关联标准搜索结果')
          } else if (task.type === 'standard_version_compare' && !latestVersionCompareTask) {
            latestVersionCompareTask = task
            const versionResult = result.selectedResult as VersionCompareResult
            setVersionCompareResult(versionResult)

            // 缓存结果
            cache.set(projectId, 'standard_version_compare', task.id, versionResult)

            console.log('✅ 加载版本比对结果')
          }

          // 找到了所有类型的最新任务后就可以停止了
          if (
            latestInterpretationTask &&
            latestRelatedStandardsTask &&
            latestVersionCompareTask
          ) {
            break
          }
        }
      }

      // 设置当前任务为最新的任务（用于进度跟踪）
      if (!currentTask && latestInterpretationTask) {
        setCurrentTask(latestInterpretationTask)
      }
    } catch (err: any) {
      console.error('Failed to load existing tasks:', err)
    }
  }, [projectId, currentTask, cache])

  const handleGenerateInterpretation = async () => {
    if (!standardDocument) {
      message.error('项目没有标准文档，请先上传标准文档')
      return
    }

    try {
      setLoading(true)
      setError(null)
      setActiveTab('interpretation')

      // 清除旧的结果，避免混淆
      setInterpretationResult(null)
      console.log(`🔄 清除旧结果，准备生成新的${interpretationMode}模式解读`)

      const newTask = await AITasksAPI.createTask({
        projectId,
        type: 'standard_interpretation',
        input: {
          standardDocument: {
            id: standardDocument.id,
            name: standardDocument.name,
            content: standardDocument.content,
          },
          interpretationMode, // 添加解读模式
          useTwoPhaseMode: true, // 启用两阶段模式，确保100%条款覆盖
          batchSize: 10, // 批次大小：每批解读10个条款
        },
      })

      setCurrentTask(newTask)
      message.success(`标准解读任务已创建（${interpretationMode === 'enterprise' ? '企业级' : interpretationMode === 'detailed' ? '详细' : '基础'}模式）`)
    } catch (err: any) {
      setError(err.message || '提交失败')
      setLoading(false)
    }
  }

  const handleSearchRelatedStandards = async () => {
    if (!interpretationResult) {
      message.error('请先生成标准解读')
      return
    }

    if (!standardDocument) {
      message.error('项目没有标准文档')
      return
    }

    try {
      setLoading(true)
      setError(null)
      setActiveTab('related')

      const newTask = await AITasksAPI.createTask({
        projectId,
        type: 'standard_related_search',
        input: {
          standardDocument: {
            id: standardDocument.id,
            name: standardDocument.name,
            content: standardDocument.content,
          },
          interpretationTaskId: currentTask?.id,
        },
      })

      setCurrentTask(newTask)
      message.success('关联标准搜索任务已创建')
    } catch (err: any) {
      setError(err.message || '提交失败')
      setLoading(false)
    }
  }

  const handleVersionCompare = async () => {
    if (!oldVersionDocument || !newVersionDocument) {
      message.error('请先选择两个版本进行比对')
      return
    }

    try {
      setLoading(true)
      setError(null)
      setActiveTab('version')

      const newTask = await AITasksAPI.createTask({
        projectId,
        type: 'standard_version_compare',
        input: {
          oldVersion: {
            id: oldVersionDocument.id,
            name: oldVersionDocument.name,
            content: oldVersionDocument.content,
          },
          newVersion: {
            id: newVersionDocument.id,
            name: newVersionDocument.name,
            content: newVersionDocument.content,
          },
        },
      })

      setCurrentTask(newTask)
      message.success('版本比对任务已创建')
    } catch (err: any) {
      setError(err.message || '提交失败')
      setLoading(false)
    }
  }

  const loadTaskResult = async (taskId: string, retries = 3) => {
    try {
      const task = await AITasksAPI.getTask(taskId)
      console.log('📥 加载任务结果:', task.id, 'status:', task.status, 'has result:', !!task.result)

      if (task.result) {
        const result = TaskAdapter.toGenerationResult(task)

        if (task.type === 'standard_interpretation') {
          setInterpretationResult(result.selectedResult as StandardInterpretationResult)
          message.success('标准解读完成')
        } else if (task.type === 'standard_related_search') {
          setRelatedStandardsResult(result.selectedResult as RelatedStandardsResult)
          message.success('关联标准搜索完成')
        } else if (task.type === 'standard_version_compare') {
          setVersionCompareResult(result.selectedResult as VersionCompareResult)
          message.success('版本比对完成')
        }
      } else if (task.status === 'completed' && !task.result && retries > 0) {
        // 任务已完成但结果还没准备好，等待后重试
        console.log('⏳ 任务已完成但结果未准备好，2秒后重试...', `剩余重试次数: ${retries - 1}`)
        setTimeout(() => {
          loadTaskResult(taskId, retries - 1)
        }, 2000)
      } else {
        console.warn('⚠️ 任务结果为空:', task)
        setError('任务已完成，但结果加载失败，请刷新页面重试')
      }
    } catch (err: any) {
      console.error('Failed to load task result:', err)
      setError('无法加载结果')
    }
  }

  const getPriorityColor = useCallback((priority: string) => {
    switch (priority) {
      case 'HIGH':
        return 'red'
      case 'MEDIUM':
        return 'orange'
      case 'LOW':
        return 'green'
      default:
        return 'default'
    }
  }, [])

  const getRelationTypeTag = useCallback((type: string) => {
    const colors: Record<string, string> = {
      REFERENCE: 'blue',
      SUPPLEMENT: 'green',
      CONFLICT: 'red',
      SYNERGY: 'purple',
    }
    const labels: Record<string, string> = {
      REFERENCE: '引用',
      SUPPLEMENT: '补充',
      CONFLICT: '冲突',
      SYNERGY: '协同',
    }
    return <Tag color={colors[type]}>{labels[type] || type}</Tag>
  }, [])

  // 标准解读导出处理函数
  const handleExportInterpretationToExcel = useCallback(() => {
    if (interpretationResult) {
      try {
        exportStandardInterpretationToExcel(interpretationResult, `${standardDocument?.name || '标准'}-解读.xlsx`)
        message.success('正在导出Excel...')
      } catch (err) {
        console.error('Export to Excel error:', err)
        message.error('导出Excel失败')
      }
    }
  }, [interpretationResult, standardDocument?.name])

  const handleExportInterpretationToWord = useCallback(() => {
    if (interpretationResult) {
      try {
        exportStandardInterpretationToWord(interpretationResult, `${standardDocument?.name || '标准'}-解读.docx`)
        message.success('正在导出Word...')
      } catch (err) {
        console.error('Export to Word error:', err)
        message.error('导出Word失败')
      }
    }
  }, [interpretationResult, standardDocument?.name])

  // 关联标准导出处理函数
  const handleExportRelatedStandardsToExcel = useCallback(() => {
    if (relatedStandardsResult) {
      try {
        exportRelatedStandardsToExcel(relatedStandardsResult, `${standardDocument?.name || '标准'}-关联标准.xlsx`)
        message.success('正在导出Excel...')
      } catch (err) {
        console.error('Export to Excel error:', err)
        message.error('导出Excel失败')
      }
    }
  }, [relatedStandardsResult, standardDocument?.name])

  const handleExportRelatedStandardsToWord = useCallback(() => {
    if (relatedStandardsResult) {
      try {
        exportRelatedStandardsToWord(relatedStandardsResult, `${standardDocument?.name || '标准'}-关联标准.docx`)
        message.success('正在导出Word...')
      } catch (err) {
        console.error('Export to Word error:', err)
        message.error('导出Word失败')
      }
    }
  }, [relatedStandardsResult, standardDocument?.name])

  // 版本比对导出处理函数
  const handleExportVersionCompareToExcel = useCallback(() => {
    if (versionCompareResult) {
      try {
        const filename = `${versionCompareResult.version_info.old_version}-${versionCompareResult.version_info.new_version}-比对.xlsx`
        exportVersionCompareToExcel(versionCompareResult, filename)
        message.success('正在导出Excel...')
      } catch (err) {
        console.error('Export to Excel error:', err)
        message.error('导出Excel失败')
      }
    }
  }, [versionCompareResult])

  const handleExportVersionCompareToWord = useCallback(() => {
    if (versionCompareResult) {
      try {
        const filename = `${versionCompareResult.version_info.old_version}-${versionCompareResult.version_info.new_version}-比对.docx`
        exportVersionCompareToWord(versionCompareResult, filename)
        message.success('正在导出Word...')
      } catch (err) {
        console.error('Export to Word error:', err)
        message.error('导出Word失败')
      }
    }
  }, [versionCompareResult])

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 头部 */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.back()}>
            返回
          </Button>
          <div>
            <h1 className="text-2xl font-bold">标准解读</h1>
            <p className="text-gray-500">深度解读标准、关联标准搜索、版本比对</p>
          </div>
        </div>
      </div>

      {/* 操作按钮 */}
      <Card className="mb-6">
        <Space size="middle" style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space size="middle">
            <div>
              <span style={{ marginRight: 8 }}>解读模式：</span>
              <Select
                defaultValue="enterprise"
                style={{ width: 180 }}
                onChange={(value) => setInterpretationMode(value)}
              >
                <Option value="basic">基础解读（快速）</Option>
                <Option value="detailed">详细解读（全面）</Option>
                <Option value="enterprise">企业级解读（深度）</Option>
              </Select>
            </div>
            <Button
              type="primary"
              icon={<BookOutlined />}
              onClick={handleGenerateInterpretation}
              loading={loading && activeTab === 'interpretation'}
            >
              生成标准解读
            </Button>
            <Button
              icon={<SearchOutlined />}
              onClick={handleSearchRelatedStandards}
              loading={loading && activeTab === 'related'}
              disabled={!interpretationResult}
            >
              搜索关联标准
            </Button>
            <Button
              icon={<DiffOutlined />}
              onClick={handleVersionCompare}
              loading={loading && activeTab === 'version'}
            >
              版本比对
            </Button>
          </Space>
        </Space>
        {interpretationMode !== 'enterprise' && (
          <Alert
            message="模式说明"
            description={
              interpretationMode === 'basic'
                ? '基础解读：快速生成标准概要和关键条款解读，适合快速了解标准'
                : '详细解读：包含完整的条款解读、风险评估和实施指引，适合深入理解标准'
            }
            type="info"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}
      </Card>

      {/* 生成进度 */}
      {loading && (
        <Card className="mb-6">
          <div className="text-center py-8">
            <Spin size="large" />
            <div className="mt-4">
              <p className="text-lg">正在生成，请稍候...</p>
              <Progress percent={progress} className="mt-2" />
              <p className="text-gray-500 mt-2">{progressMessage}</p>
            </div>
          </div>
        </Card>
      )}

      {/* 结果展示 */}
      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          {/* 标准解读 */}
          <TabPane tab={<span><BookOutlined /> 标准解读</span>} key="interpretation">
            {!interpretationResult ? (
              <Alert
                message="暂无解读结果"
                description="点击「生成标准解读」按钮开始分析标准文档"
                type="info"
                showIcon
              />
            ) : (
              <>
                {/* 导出按钮 */}
                <Card className="mb-4">
                  <Space>
                    <Button
                      type="primary"
                      icon={<FileExcelOutlined />}
                      onClick={handleExportInterpretationToExcel}
                    >
                      导出Excel
                    </Button>
                    <Button
                      type="default"
                      icon={<FileWordOutlined />}
                      onClick={handleExportInterpretationToWord}
                    >
                      导出Word
                    </Button>
                  </Space>
                </Card>

                {/* 概述 */}
                <Divider orientation="left">概述</Divider>
                <Descriptions bordered column={1}>
                  <Descriptions.Item label="制定背景">
                    {interpretationResult.overview.background}
                  </Descriptions.Item>
                  <Descriptions.Item label="适用范围">
                    {interpretationResult.overview.scope}
                  </Descriptions.Item>
                  <Descriptions.Item label="核心目标">
                    <ul>
                      {interpretationResult.overview.core_objectives.map((obj, idx) => (
                        <li key={idx}>{obj}</li>
                      ))}
                    </ul>
                  </Descriptions.Item>
                  <Descriptions.Item label="目标受众">
                    {interpretationResult.overview.target_audience.join('、')}
                  </Descriptions.Item>
                </Descriptions>

                {/* 关键术语 */}
                <Divider orientation="left">关键术语</Divider>
                <Collapse
                  accordion
                  items={interpretationResult.key_terms.map((term, index) => ({
                    key: index,
                    label: term.term,
                    children: (
                      <div>
                        <p>
                          <strong>定义：</strong> {term.definition}
                        </p>
                        <p>
                          <strong>解释：</strong> {term.explanation}
                        </p>
                      </div>
                    ),
                  }))}
                />

                {/* 关键要求 */}
                <Divider orientation="left">关键要求</Divider>

                {/* 统计信息 */}
                <Row gutter={16} style={{ marginBottom: 16 }}>
                  <Col span={6}>
                    <Card>
                      <Statistic
                        title="总条款数"
                        value={interpretationResult.key_requirements.length}
                        prefix={<BookOutlined />}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card>
                      <Statistic
                        title="已解读条款"
                        value={interpretationResult.key_requirements.filter(
                          (req) => req.interpretation &&
                          (typeof req.interpretation === 'string'
                            ? req.interpretation.trim().length > 0
                            : (req.interpretation.what || req.interpretation.why || req.interpretation.how)
                          )
                        ).length}
                        valueStyle={{ color: '#3f8600' }}
                        prefix={<CheckCircleOutlined />}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card>
                      <Statistic
                        title="未解读条款"
                        value={interpretationResult.key_requirements.filter(
                          (req) => !req.interpretation ||
                          (typeof req.interpretation === 'string'
                            ? req.interpretation.trim().length === 0
                            : !req.interpretation.what && !req.interpretation.why && !req.interpretation.how
                          )
                        ).length}
                        valueStyle={{ color: '#cf1322' }}
                        prefix={<CloseCircleOutlined />}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card>
                      <Statistic
                        title="解读完成率"
                        value={(
                          (interpretationResult.key_requirements.filter(
                            (req) => req.interpretation &&
                            (typeof req.interpretation === 'string'
                              ? req.interpretation.trim().length > 0
                              : (req.interpretation.what || req.interpretation.why || req.interpretation.how)
                            )
                          ).length / interpretationResult.key_requirements.length) * 100
                        ).toFixed(1)}
                        suffix="%"
                        valueStyle={{
                          color:
                            (interpretationResult.key_requirements.filter(
                              (req) => req.interpretation &&
                              (typeof req.interpretation === 'string'
                                ? req.interpretation.trim().length > 0
                                : (req.interpretation.what || req.interpretation.why || req.interpretation.how)
                              )
                            ).length / interpretationResult.key_requirements.length) >= 0.8
                              ? '#3f8600'
                              : (interpretationResult.key_requirements.filter(
                                  (req) => req.interpretation &&
                                  (typeof req.interpretation === 'string'
                                    ? req.interpretation.trim().length > 0
                                    : (req.interpretation.what || req.interpretation.why || req.interpretation.how)
                                  )
                                ).length / interpretationResult.key_requirements.length) >= 0.5
                                ? '#faad14'
                                : '#cf1322'
                        }}
                      />
                    </Card>
                  </Col>
                </Row>

                <List
                  itemLayout="horizontal"
                  dataSource={interpretationResult.key_requirements}
                  renderItem={(item) => (
                    <List.Item>
                      <List.Item.Meta
                        title={
                          <Space>
                            <Tag color={getPriorityColor(item.priority)}>{item.clause_id}</Tag>
                            <span>{item.clause_text}</span>
                          </Space>
                        }
                        description={
                          <div>
                            {/* 显示完整的条款原文 - 新增字段 */}
                            {item.clause_full_text && (
                              <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#f5f5f5', borderRadius: 4 }}>
                                <p style={{ margin: 0, color: '#595959', fontStyle: 'italic' }}>
                                  <strong>📄 原始条款：</strong>
                                </p>
                                <p style={{ margin: '8px 0 0 0', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                                  {item.clause_full_text}
                                </p>
                              </div>
                            )}

                            {/* 显示章节信息 */}
                            {item.chapter && (
                              <Tag color="blue" style={{ marginBottom: 8 }}>
                                {item.chapter}
                              </Tag>
                            )}

                            {/* 显示条款总结 */}
                            {item.clause_summary && (
                              <p style={{ marginBottom: 12, color: '#595959' }}>
                                <strong>总结：</strong> {item.clause_summary}
                              </p>
                            )}

                            {/* 解读部分 - 兼容旧格式（字符串）和新格式（对象） */}
                            {typeof item.interpretation === 'string' ? (
                              <p>
                                <strong>解读：</strong> {item.interpretation}
                              </p>
                            ) : (
                              <div>
                                <p>
                                  <strong>是什么（What）：</strong> {item.interpretation.what}
                                </p>
                                <p>
                                  <strong>为什么（Why）：</strong> {item.interpretation.why}
                                </p>
                                <p>
                                  <strong>怎么做（How）：</strong> {item.interpretation.how}
                                </p>
                              </div>
                            )}

                            {/* 合规标准部分 - 兼容旧格式（数组）和新格式（对象） */}
                            <div>
                              <p style={{ marginBottom: 8 }}>
                                <strong>合规标准：</strong>
                              </p>
                              {Array.isArray(item.compliance_criteria) ? (
                                <ul>
                                  {item.compliance_criteria.map((criteria, idx) => (
                                    <li key={idx}>{criteria}</li>
                                  ))}
                                </ul>
                              ) : (
                                <div>
                                  <div style={{ marginBottom: 8 }}>
                                    <strong>必须有：</strong>
                                    <ul>
                                      {item.compliance_criteria.must_have?.map((item, idx) => (
                                        <li key={idx}>{item}</li>
                                      ))}
                                    </ul>
                                  </div>
                                  <div style={{ marginBottom: 8 }}>
                                    <strong>建议有：</strong>
                                    <ul>
                                      {item.compliance_criteria.should_have?.map((item, idx) => (
                                        <li key={idx}>{item}</li>
                                      ))}
                                    </ul>
                                  </div>
                                  <div style={{ marginBottom: 8 }}>
                                    <strong>需要的证据：</strong>
                                    <ul>
                                      {item.compliance_criteria.evidence_required?.map((item, idx) => (
                                        <li key={idx}>{item}</li>
                                      ))}
                                    </ul>
                                  </div>
                                  <div>
                                    <strong>评估方法：</strong> {item.compliance_criteria.assessment_method}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* 风险评估 - 新增字段 */}
                            {item.risk_assessment && (
                              <div style={{ marginTop: 16 }}>
                                <Divider style={{ margin: '8px 0' }} />
                                <p>
                                  <strong>⚠️ 风险评估</strong>
                                </p>
                                {item.risk_assessment.non_compliance_risks && item.risk_assessment.non_compliance_risks.length > 0 && (
                                  <div>
                                    <p style={{ color: '#cf1322' }}>
                                      <strong>不合规风险：</strong>
                                    </p>
                                    <ul>
                                      {item.risk_assessment.non_compliance_risks.map((risk, idx) => (
                                        <li key={idx}>
                                          <strong>{risk.risk}</strong> - {risk.consequence}
                                          <br />
                                          <small>概率：{risk.probability} | 缓解措施：{risk.mitigation}</small>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {item.risk_assessment.implementation_risks && item.risk_assessment.implementation_risks.length > 0 && (
                                  <div>
                                    <p style={{ color: '#faad14' }}>
                                      <strong>实施风险：</strong>
                                    </p>
                                    <ul>
                                      {item.risk_assessment.implementation_risks.map((risk, idx) => (
                                        <li key={idx}>
                                          <strong>{risk.risk}</strong> - {risk.consequence}
                                          <br />
                                          <small>预防措施：{risk.prevention}</small>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* 实施顺序和工作量 - 新增字段 */}
                            {item.implementation_order && (
                              <Tag color="blue" style={{ marginTop: 8 }}>
                                实施顺序：第{item.implementation_order}步
                              </Tag>
                            )}
                            {item.estimated_effort && (
                              <Tag color="green" style={{ marginTop: 8, marginLeft: 8 }}>
                                预估工期：{item.estimated_effort}
                              </Tag>
                            )}
                            {item.dependencies && item.dependencies.length > 0 && (
                              <Tag color="orange" style={{ marginTop: 8, marginLeft: 8 }}>
                                依赖：{item.dependencies.join(', ')}
                              </Tag>
                            )}

                            {/* 最佳实践和常见错误 - 新增字段 */}
                            {item.best_practices && item.best_practices.length > 0 && (
                              <div style={{ marginTop: 12 }}>
                                <p>
                                  <strong>💡 最佳实践：</strong>
                                </p>
                                <ul>
                                  {item.best_practices.map((practice, idx) => (
                                    <li key={idx}>{practice}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {item.common_mistakes && item.common_mistakes.length > 0 && (
                              <div style={{ marginTop: 12 }}>
                                <p>
                                  <strong>⚠️ 常见错误：</strong>
                                </p>
                                <ul>
                                  {item.common_mistakes.map((mistake, idx) => (
                                    <li key={idx} style={{ color: '#cf1322' }}>
                                      {mistake}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />

                {/* 实施指引 */}
                <Divider orientation="left">实施指引</Divider>
                <Collapse
                  items={[
                    {
                      key: 'preparation',
                      label: '准备工作',
                      children: (
                        <ul>
                          {interpretationResult.implementation_guidance.preparation.map((step, idx) => (
                            <li key={idx}>{step}</li>
                          ))}
                        </ul>
                      ),
                    },
                    {
                      key: 'steps',
                      label: '实施步骤',
                      children: (
                        <Timeline>
                          {interpretationResult.implementation_guidance.implementation_steps.map((phase, idx) => (
                            <Timeline.Item key={idx}>
                              <p>
                                <strong>{phase.phase}</strong>
                              </p>
                              <ul>
                                {phase.steps.map((step, stepIdx) => (
                                  <li key={stepIdx}>{step}</li>
                                ))}
                              </ul>
                            </Timeline.Item>
                          ))}
                        </Timeline>
                      ),
                    },
                    {
                      key: 'practices',
                      label: '最佳实践',
                      children: (
                        <ul>
                          {interpretationResult.implementation_guidance.best_practices.map((practice, idx) => (
                            <li key={idx}>{practice}</li>
                          ))}
                        </ul>
                      ),
                    },
                    {
                      key: 'pitfalls',
                      label: '常见误区',
                      children: (
                        <ul>
                          {interpretationResult.implementation_guidance.common_pitfalls.map((pitfall, idx) => (
                            <li key={idx}>{pitfall}</li>
                          ))}
                        </ul>
                      ),
                    },
                    {
                      key: 'timeline',
                      label: '预估时间',
                      children: <p>{interpretationResult.implementation_guidance.timeline_estimate}</p>,
                    },
                    {
                      key: 'resources',
                      label: '所需资源',
                      children: typeof interpretationResult.implementation_guidance.resource_requirements ===
                      'string' ? (
                        <p>{interpretationResult.implementation_guidance.resource_requirements}</p>
                      ) : (
                        <div>
                          <p>
                            <strong>团队配置：</strong>
                            {interpretationResult.implementation_guidance.resource_requirements.team}
                          </p>
                          <p>
                            <strong>预算估算：</strong>
                            {interpretationResult.implementation_guidance.resource_requirements.budget}
                          </p>
                          <p>
                            <strong>工具平台：</strong>
                            {interpretationResult.implementation_guidance.resource_requirements.tools}
                          </p>
                        </div>
                      ),
                    },
                  ]}
                />

                {/* 检查清单 - 新增字段 */}
                {interpretationResult.implementation_guidance.checklists && (
                  <>
                    <Divider orientation="left">检查清单</Divider>
                    <Card>
                      <Row gutter={16}>
                        <Col span={12}>
                          <h4>📄 文档清单</h4>
                          <ul>
                            {interpretationResult.implementation_guidance.checklists.document_checklist.map(
                              (doc, idx) => (
                                <li key={idx}>{doc}</li>
                              ),
                            )}
                          </ul>
                        </Col>
                        <Col span={12}>
                          <h4>💻 系统清单</h4>
                          <ul>
                            {interpretationResult.implementation_guidance.checklists.system_checklist.map(
                              (sys, idx) => (
                                <li key={idx}>{sys}</li>
                              ),
                            )}
                          </ul>
                        </Col>
                      </Row>
                      <Row gutter={16} style={{ marginTop: 16 }}>
                        <Col span={12}>
                          <h4>⚙️ 流程清单</h4>
                          <ul>
                            {interpretationResult.implementation_guidance.checklists.process_checklist.map(
                              (proc, idx) => (
                                <li key={idx}>{proc}</li>
                              ),
                            )}
                          </ul>
                        </Col>
                        <Col span={12}>
                          <h4>🗣️ 访谈准备</h4>
                          <ul>
                            {interpretationResult.implementation_guidance.checklists.interview_preparation.map(
                              (interview, idx) => (
                                <li key={idx}>{interview}</li>
                              ),
                            )}
                          </ul>
                        </Col>
                      </Row>
                    </Card>
                  </>
                )}

                {/* 证据模板 - 新增字段 */}
                {interpretationResult.implementation_guidance.evidence_templates &&
                  interpretationResult.implementation_guidance.evidence_templates.length > 0 && (
                    <>
                      <Divider orientation="left">证据模板</Divider>
                      <List
                        dataSource={interpretationResult.implementation_guidance.evidence_templates}
                        renderItem={(template: any) => (
                          <List.Item>
                            <List.Item.Meta
                              title={<Tag color="blue">{template.clause}</Tag>}
                              description={
                                <div>
                                  <p>
                                    <strong>类型：</strong> {template.evidence_type}
                                  </p>
                                  <p>
                                    <strong>说明：</strong> {template.description}
                                  </p>
                                  <p>
                                    <strong>参考：</strong> {template.sample_reference}
                                  </p>
                                </div>
                              }
                            />
                          </List.Item>
                        )}
                      />
                    </>
                  )}

                {/* 风险矩阵 - 新增字段 */}
                {interpretationResult.risk_matrix && (
                  <>
                    <Divider orientation="left">风险矩阵</Divider>
                    <Card>
                      <Row gutter={16} style={{ marginBottom: 16 }}>
                        <Col span={24}>
                          <h4 style={{ color: '#cf1322' }}>🔴 高风险条款</h4>
                          <Space wrap>
                            {interpretationResult.risk_matrix.high_risk_clauses.map((clause: string, idx: number) => (
                              <Tag key={idx} color="red">
                                {clause}
                              </Tag>
                            ))}
                          </Space>
                        </Col>
                      </Row>

                      {interpretationResult.risk_matrix.common_failures &&
                        interpretationResult.risk_matrix.common_failures.length > 0 && (
                          <Row gutter={16} style={{ marginTop: 16 }}>
                            <Col span={24}>
                              <h4>⚠️ 常见失败点</h4>
                              <List
                                dataSource={interpretationResult.risk_matrix.common_failures}
                                renderItem={(failure: any) => (
                                  <List.Item>
                                    <List.Item.Meta
                                      title={<Tag color="orange">{failure.clause}</Tag>}
                                      description={
                                        <div>
                                          <p>
                                            <strong>失败点：</strong> {failure.failure_point}
                                          </p>
                                          <p>
                                            <strong>后果：</strong> {failure.consequence}
                                          </p>
                                          <p>
                                            <strong>改进建议：</strong> {failure.mitigation}
                                          </p>
                                        </div>
                                      }
                                    />
                                  </List.Item>
                                )}
                              />
                            </Col>
                          </Row>
                        )}

                      <Row gutter={16} style={{ marginTop: 16 }}>
                        <Col span={24}>
                          <h4>🎯 审计重点关注</h4>
                          <ul>
                            {interpretationResult.risk_matrix.audit_focus_areas.map((area: string, idx: number) => (
                              <li key={idx}>{area}</li>
                            ))}
                          </ul>
                        </Col>
                      </Row>
                    </Card>
                  </>
                )}

                {/* 实施路径规划 - 新增字段 */}
                {interpretationResult.implementation_roadmap && (
                  <>
                    <Divider orientation="left">实施路径规划</Divider>
                    <Card>
                      <Timeline>
                        {interpretationResult.implementation_roadmap.phase_1_foundation && (
                          <Timeline.Item color="blue">
                            <p>
                              <strong>阶段1：{interpretationResult.implementation_roadmap.phase_1_foundation.name}</strong>
                            </p>
                            <p>时长：{interpretationResult.implementation_roadmap.phase_1_foundation.duration}</p>
                            <p>重点：{interpretationResult.implementation_roadmap.phase_1_foundation.focus}</p>
                            <p>
                              涉及条款：{interpretationResult.implementation_roadmap.phase_1_foundation.clauses?.join(', ') || '无'}
                            </p>
                            <div>
                              <p>交付物：</p>
                              <ul>
                                {interpretationResult.implementation_roadmap.phase_1_foundation.deliverables?.map(
                                  (item: string, idx: number) => (
                                    <li key={idx}>{item}</li>
                                  ),
                                ) || <li>无</li>}
                              </ul>
                            </div>
                          </Timeline.Item>
                        )}

                        {interpretationResult.implementation_roadmap.phase_2_digitalization && (
                          <Timeline.Item color="green">
                            <p>
                              <strong>阶段2：{interpretationResult.implementation_roadmap.phase_2_digitalization.name}</strong>
                            </p>
                            <p>时长：{interpretationResult.implementation_roadmap.phase_2_digitalization.duration}</p>
                            <p>重点：{interpretationResult.implementation_roadmap.phase_2_digitalization.focus}</p>
                            <p>
                              涉及条款：{interpretationResult.implementation_roadmap.phase_2_digitalization.clauses?.join(', ') || '无'}
                            </p>
                            <div>
                              <p>交付物：</p>
                              <ul>
                                {interpretationResult.implementation_roadmap.phase_2_digitalization.deliverables?.map(
                                  (item: string, idx: number) => (
                                    <li key={idx}>{item}</li>
                                  ),
                                ) || <li>无</li>}
                              </ul>
                            </div>
                          </Timeline.Item>
                        )}

                        {interpretationResult.implementation_roadmap.phase_3_automation && (
                          <Timeline.Item color="orange">
                            <p>
                              <strong>阶段3：{interpretationResult.implementation_roadmap.phase_3_automation.name}</strong>
                            </p>
                            <p>时长：{interpretationResult.implementation_roadmap.phase_3_automation.duration}</p>
                            <p>重点：{interpretationResult.implementation_roadmap.phase_3_automation.focus}</p>
                            <p>
                              涉及条款：{interpretationResult.implementation_roadmap.phase_3_automation.clauses?.join(', ') || '无'}
                            </p>
                            <div>
                              <p>交付物：</p>
                              <ul>
                                {interpretationResult.implementation_roadmap.phase_3_automation.deliverables?.map(
                                  (item: string, idx: number) => (
                                    <li key={idx}>{item}</li>
                                  ),
                                ) || <li>无</li>}
                              </ul>
                            </div>
                          </Timeline.Item>
                        )}

                        {interpretationResult.implementation_roadmap.phase_4_optimization && (
                          <Timeline.Item color="purple">
                            <p>
                              <strong>阶段4：{interpretationResult.implementation_roadmap.phase_4_optimization.name}</strong>
                            </p>
                            <p>时长：{interpretationResult.implementation_roadmap.phase_4_optimization.duration}</p>
                            <p>重点：{interpretationResult.implementation_roadmap.phase_4_optimization.focus}</p>
                            <p>
                              涉及条款：{interpretationResult.implementation_roadmap.phase_4_optimization.clauses?.join(', ') || '无'}
                            </p>
                            <div>
                              <p>交付物：</p>
                              <ul>
                                {interpretationResult.implementation_roadmap.phase_4_optimization.deliverables?.map(
                                  (item: string, idx: number) => (
                                    <li key={idx}>{item}</li>
                                  ),
                                ) || <li>无</li>}
                              </ul>
                            </div>
                          </Timeline.Item>
                        )}
                      </Timeline>
                    </Card>
                  </>
                )}
              </>
            )}
          </TabPane>

          {/* 关联标准 */}
          <TabPane tab={<span><SearchOutlined /> 关联标准</span>} key="related">
            {!relatedStandardsResult ? (
              <Alert
                message="暂无关联标准结果"
                description="先完成标准解读，然后点击「搜索关联标准」按钮"
                type="info"
                showIcon
              />
            ) : (
              <>
                {/* 导出按钮 */}
                <Card className="mb-4">
                  <Space>
                    <Button
                      type="primary"
                      icon={<FileExcelOutlined />}
                      onClick={handleExportRelatedStandardsToExcel}
                    >
                      导出Excel
                    </Button>
                    <Button
                      type="default"
                      icon={<FileWordOutlined />}
                      onClick={handleExportRelatedStandardsToWord}
                    >
                      导出Word
                    </Button>
                  </Space>
                </Card>

                <Row gutter={16} className="mb-4">
                  <Col span={6}>
                    <Card>
                      <Statistic
                        title="关联标准总数"
                        value={relatedStandardsResult.summary.total_related_standards}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card>
                      <Statistic
                        title="国家标准"
                        value={relatedStandardsResult.summary.national_standards_count}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card>
                      <Statistic
                        title="行业标准"
                        value={relatedStandardsResult.summary.industry_standards_count}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card>
                      <Statistic
                        title="最常被关联的条款"
                        value={relatedStandardsResult.summary.top_relations.length}
                        suffix="个"
                      />
                    </Card>
                  </Col>
                </Row>

                <Collapse
                  accordion
                  items={relatedStandardsResult.related_standards.map((item, index) => ({
                    key: index,
                    label: (
                      <Space>
                        <Tag>{item.clause_id}</Tag>
                        <span>{item.clause_text.substring(0, 50)}...</span>
                      </Space>
                    ),
                    children: (
                      <List
                        size="small"
                        dataSource={item.related_standards}
                        renderItem={(standard) => (
                          <List.Item>
                            <List.Item.Meta
                              title={
                                <Space>
                                  {getRelationTypeTag(standard.relation_type)}
                                  <span>{standard.standard_code}</span>
                                  <Tag color="blue">{(standard.relevance_score * 100).toFixed(0)}%相关度</Tag>
                                </Space>
                              }
                              description={
                                <div>
                                  <p>
                                    <strong>标准名称：</strong> {standard.standard_name}
                                  </p>
                                  <p>
                                    <strong>关联说明：</strong> {standard.description}
                                  </p>
                                </div>
                              }
                            />
                          </List.Item>
                        )}
                      />
                    ),
                  }))}
                />
              </>
            )}
          </TabPane>

          {/* 版本比对 */}
          <TabPane tab={<span><DiffOutlined /> 版本比对</span>} key="version">
            {!versionCompareResult ? (
              <div>
                <Alert
                  message="暂无版本比对结果"
                  description="选择两个版本的标准文档进行比对"
                  type="info"
                  showIcon
                  className="mb-4"
                />
                <Card title="选择版本">
                  <Space direction="vertical" style={{ width: '100%' }} size="large">
                    <div>
                      <p className="mb-2">
                        <strong>旧版本：</strong>
                      </p>
                      <Select
                        style={{ width: '100%' }}
                        placeholder="选择旧版本"
                        onChange={(value) => setOldVersionDocument(value)}
                      >
                        {/* 这里需要从项目文档中加载 */}
                      </Select>
                    </div>
                    <div>
                      <p className="mb-2">
                        <strong>新版本：</strong>
                      </p>
                      <Select
                        style={{ width: '100%' }}
                        placeholder="选择新版本"
                        onChange={(value) => setNewVersionDocument(value)}
                      >
                        {/* 这里需要从项目文档中加载 */}
                      </Select>
                    </div>
                  </Space>
                </Card>
              </div>
            ) : (
              <>
                {/* 导出按钮 */}
                <Card className="mb-4">
                  <Space>
                    <Button
                      type="primary"
                      icon={<FileExcelOutlined />}
                      onClick={handleExportVersionCompareToExcel}
                    >
                      导出Excel
                    </Button>
                    <Button
                      type="default"
                      icon={<FileWordOutlined />}
                      onClick={handleExportVersionCompareToWord}
                    >
                      导出Word
                    </Button>
                  </Space>
                </Card>

                <Card className="mb-4" title="版本信息">
                  <Descriptions bordered column={2}>
                    <Descriptions.Item label="旧版本">
                      {versionCompareResult.version_info.old_version}
                    </Descriptions.Item>
                    <Descriptions.Item label="新版本">
                      {versionCompareResult.version_info.new_version}
                    </Descriptions.Item>
                    <Descriptions.Item label="总体变化" span={2}>
                      {versionCompareResult.version_info.comparison_summary}
                    </Descriptions.Item>
                  </Descriptions>
                </Card>

                <Row gutter={16} className="mb-4">
                  <Col span={6}>
                    <Card>
                      <Statistic
                        title="新增条款"
                        value={versionCompareResult.statistics.total_added}
                        prefix={<PlusOutlined />}
                        valueStyle={{ color: '#3f8600' }}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card>
                      <Statistic
                        title="修改条款"
                        value={versionCompareResult.statistics.total_modified}
                        prefix={<EditOutlined />}
                        valueStyle={{ color: '#faad14' }}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card>
                      <Statistic
                        title="删除条款"
                        value={versionCompareResult.statistics.total_deleted}
                        prefix={<MinusOutlined />}
                        valueStyle={{ color: '#cf1322' }}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card>
                      <Statistic
                        title="变化比例"
                        value={versionCompareResult.statistics.change_percentage * 100}
                        precision={1}
                        suffix="%"
                      />
                    </Card>
                  </Col>
                </Row>

                <Tabs defaultActiveKey="added">
                  <TabPane tab={<span><PlusOutlined /> 新增</span>} key="added">
                    <List
                      dataSource={versionCompareResult.added_clauses}
                      renderItem={(item) => (
                        <List.Item>
                          <List.Item.Meta
                            title={<Tag>{item.clause_id}</Tag>}
                            description={
                              <div>
                                <p>{item.clause_text}</p>
                                <p>
                                  <strong>影响：</strong> {item.impact}
                                </p>
                                <p>
                                  <strong>需要采取的行动：</strong> {item.action_required}
                                </p>
                              </div>
                            }
                          />
                        </List.Item>
                      )}
                    />
                  </TabPane>

                  <TabPane tab={<span><EditOutlined /> 修改</span>} key="modified">
                    <List
                      dataSource={versionCompareResult.modified_clauses}
                      renderItem={(item) => (
                        <List.Item>
                          <List.Item.Meta
                            title={
                              <Space>
                                <Tag>{item.clause_id}</Tag>
                                <Tag color={item.change_type === 'MAJOR' ? 'red' : 'orange'}>
                                  {item.change_type === 'MAJOR' ? '重大修改' : '轻微修改'}
                                </Tag>
                              </Space>
                            }
                            description={
                              <div>
                                <p>
                                  <strong>旧版本：</strong> {item.old_text}
                                </p>
                                <p>
                                  <strong>新版本：</strong> {item.new_text}
                                </p>
                                <p>
                                  <strong>影响：</strong> {item.impact}
                                </p>
                                <p>
                                  <strong>迁移建议：</strong> {item.migration_guide}
                                </p>
                              </div>
                            }
                          />
                        </List.Item>
                      )}
                    />
                  </TabPane>

                  <TabPane tab={<span><MinusOutlined /> 删除</span>} key="deleted">
                    <List
                      dataSource={versionCompareResult.deleted_clauses}
                      renderItem={(item) => (
                        <List.Item>
                          <List.Item.Meta
                            title={<Tag>{item.clause_id}</Tag>}
                            description={
                              <div>
                                <p>{item.old_text}</p>
                                <p>
                                  <strong>影响：</strong> {item.impact}
                                </p>
                                <p>
                                  <strong>替代方案：</strong> {item.alternative}
                                </p>
                              </div>
                            }
                          />
                        </List.Item>
                      )}
                    />
                  </TabPane>
                </Tabs>

                <Card className="mt-4" title="迁移建议">
                  <ul>
                    {versionCompareResult.migration_recommendations.map((rec, idx) => (
                      <li key={idx}>{rec}</li>
                    ))}
                  </ul>
                </Card>
              </>
            )}
          </TabPane>
        </Tabs>
      </Card>

      {/* 错误提示 */}
      {error && (
        <Alert
          message="错误"
          description={error}
          type="error"
          showIcon
          closable
          onClose={() => setError(null)}
          className="mt-6"
        />
      )}
    </div>
  )
}
