'use client'

import React, { useState, useEffect } from 'react'
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
  PlusOutlined,
  MinusOutlined,
  EditOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  FileWordOutlined,
} from '@ant-design/icons'
import { AITasksAPI, AITask } from '@/lib/api/ai-tasks'
import { useTaskProgress } from '@/lib/hooks/useTaskProgress'
import { TaskAdapter } from '@/lib/adapters/task-adapter'
import { ProjectsAPI } from '@/lib/api/projects'
import {
  exportStandardInterpretationToExcel,
  exportStandardInterpretationToWord,
  exportRelatedStandardsToExcel,
  exportRelatedStandardsToWord,
  exportVersionCompareToExcel,
  exportVersionCompareToWord,
} from '@/lib/utils/exportUtils'

const { TabPane } = Tabs
const { Dragger } = Upload
const { Option } = Select

interface StandardInterpretationResult {
  overview: {
    background: string
    scope: string
    core_objectives: string[]
    target_audience: string[]
  }
  key_terms: Array<{
    term: string
    definition: string
    explanation: string
  }>
  key_requirements: Array<{
    clause_id: string
    clause_text: string
    interpretation: string
    compliance_criteria: string[]
    priority: 'HIGH' | 'MEDIUM' | 'LOW'
  }>
  implementation_guidance: {
    preparation: string[]
    implementation_steps: Array<{
      phase: string
      steps: string[]
    }>
    best_practices: string[]
    common_pitfalls: string[]
    timeline_estimate: string
    resource_requirements: string
  }
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

  const [standardDocument, setStandardDocument] = useState<any>(null)
  const [oldVersionDocument, setOldVersionDocument] = useState<any>(null)
  const [newVersionDocument, setNewVersionDocument] = useState<any>(null)

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
      setError(progressMessage || '生成失败')
      setLoading(false)
    }
  }, [isFailed, progressMessage])

  const loadProjectData = async () => {
    try {
      const project = await ProjectsAPI.getProject(projectId)
      if (project.metadata?.uploadedDocuments && project.metadata?.uploadedDocuments.length > 0) {
        setStandardDocument(project.metadata?.uploadedDocuments[0])
      }
    } catch (err: any) {
      console.error('Failed to load project data:', err)
    }
  }

  // 加载现有的已完成任务
  const loadExistingTasks = async () => {
    try {
      const tasks = await AITasksAPI.getTasksByProject(projectId)

      // 查找已完成的任务并加载结果
      for (const task of tasks) {
        if (
          task.status === 'completed' &&
          task.result &&
          (task.type === 'standard_interpretation' ||
            task.type === 'standard_related_search' ||
            task.type === 'standard_version_compare')
        ) {
          const result = TaskAdapter.toGenerationResult(task)

          if (task.type === 'standard_interpretation' && !interpretationResult) {
            setInterpretationResult(result.selectedResult as StandardInterpretationResult)
            console.log('✅ 加载已存在的标准解读结果')
          } else if (task.type === 'standard_related_search' && !relatedStandardsResult) {
            setRelatedStandardsResult(result.selectedResult as RelatedStandardsResult)
            console.log('✅ 加载已存在的关联标准搜索结果')
          } else if (task.type === 'standard_version_compare' && !versionCompareResult) {
            setVersionCompareResult(result.selectedResult as VersionCompareResult)
            console.log('✅ 加载已存在的版本比对结果')
          }

          // 设置当前任务（用于进度跟踪）
          if (!currentTask) {
            setCurrentTask(task)
          }
        }
      }
    } catch (err: any) {
      console.error('Failed to load existing tasks:', err)
    }
  }

  const handleGenerateInterpretation = async () => {
    if (!standardDocument) {
      message.error('项目没有标准文档，请先上传标准文档')
      return
    }

    try {
      setLoading(true)
      setError(null)
      setActiveTab('interpretation')

      const newTask = await AITasksAPI.createTask({
        projectId,
        type: 'standard_interpretation',
        input: {
          standardDocument: {
            id: standardDocument.id,
            name: standardDocument.name,
            content: standardDocument.content,
          },
        },
      })

      setCurrentTask(newTask)
      message.success('标准解读任务已创建')
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

  const getPriorityColor = (priority: string) => {
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
  }

  const getRelationTypeTag = (type: string) => {
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
  }

  // 标准解读导出处理函数
  const handleExportInterpretationToExcel = () => {
    if (interpretationResult) {
      try {
        exportStandardInterpretationToExcel(interpretationResult, `${standardDocument?.name || '标准'}-解读.xlsx`)
        message.success('正在导出Excel...')
      } catch (err) {
        console.error('Export to Excel error:', err)
        message.error('导出Excel失败')
      }
    }
  }

  const handleExportInterpretationToWord = () => {
    if (interpretationResult) {
      try {
        exportStandardInterpretationToWord(interpretationResult, `${standardDocument?.name || '标准'}-解读.docx`)
        message.success('正在导出Word...')
      } catch (err) {
        console.error('Export to Word error:', err)
        message.error('导出Word失败')
      }
    }
  }

  // 关联标准导出处理函数
  const handleExportRelatedStandardsToExcel = () => {
    if (relatedStandardsResult) {
      try {
        exportRelatedStandardsToExcel(relatedStandardsResult, `${standardDocument?.name || '标准'}-关联标准.xlsx`)
        message.success('正在导出Excel...')
      } catch (err) {
        console.error('Export to Excel error:', err)
        message.error('导出Excel失败')
      }
    }
  }

  const handleExportRelatedStandardsToWord = () => {
    if (relatedStandardsResult) {
      try {
        exportRelatedStandardsToWord(relatedStandardsResult, `${standardDocument?.name || '标准'}-关联标准.docx`)
        message.success('正在导出Word...')
      } catch (err) {
        console.error('Export to Word error:', err)
        message.error('导出Word失败')
      }
    }
  }

  // 版本比对导出处理函数
  const handleExportVersionCompareToExcel = () => {
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
  }

  const handleExportVersionCompareToWord = () => {
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
  }

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
        <Space size="middle">
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
                            <p>
                              <strong>解读：</strong> {item.interpretation}
                            </p>
                            <p>
                              <strong>合规标准：</strong>
                              <ul>
                                {item.compliance_criteria.map((criteria, idx) => (
                                  <li key={idx}>{criteria}</li>
                                ))}
                              </ul>
                            </p>
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
                      children: <p>{interpretationResult.implementation_guidance.resource_requirements}</p>,
                    },
                  ]}
                />
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
