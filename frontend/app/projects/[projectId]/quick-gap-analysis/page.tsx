'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Card,
  Form,
  Input,
  Button,
  Spin,
  Alert,
  Tabs,
  Tag,
  Statistic,
  Row,
  Col,
  Progress,
  message,
  Space,
  Divider,
  Collapse,
  List,
} from 'antd'
import {
  SendOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  RocketOutlined,
  BulbOutlined,
  ArrowLeftOutlined,
  BarChartOutlined,
} from '@ant-design/icons'
import { AITasksAPI, AITask } from '@/lib/api/ai-tasks'
import { useTaskProgress } from '@/lib/hooks/useTaskProgress'
import { useAITaskCache } from '@/lib/hooks/useAITaskCache'
import { TaskAdapter } from '@/lib/adapters/task-adapter'
import { ProjectsAPI } from '@/lib/api/projects'

const { TextArea } = Input
const { TabPane } = Tabs

interface QuickGapAnalysisResult {
  gap_analysis: {
    overview: string
    compliance_rate: number
    total_requirements: number
    satisfied_requirements: number
    gap_requirements: number
  }
  gap_details: Array<{
    cluster_id: string
    cluster_name: string
    clause_id: string
    clause_text: string
    current_state: string
    gap: string
    priority: 'HIGH' | 'MEDIUM' | 'LOW'
  }>
  action_plan: Array<{
    action_id: string
    cluster_name: string
    gap_clauses: string[]
    priority: string
    action_items: string[]
    expected_impact: string
    estimated_effort: string
  }>
}

export default function QuickGapAnalysisPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId as string
  const [form] = Form.useForm()

  const [currentTask, setCurrentTask] = useState<AITask | null>(null)
  const [analysisResult, setAnalysisResult] = useState<QuickGapAnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [standardDocument, setStandardDocument] = useState<any>(null)
  const [clusteringTaskId, setClusteringTaskId] = useState<string | null>(null)

  // 添加缓存Hook
  const cache = useAITaskCache()

  // 实时进度跟踪
  const { progress, message: progressMessage, isCompleted, isFailed } = useTaskProgress(
    currentTask?.id || null,
  )

  // 加载项目数据
  useEffect(() => {
    loadProjectData()
  }, [projectId])

  // 监听任务完成
  useEffect(() => {
    if (isCompleted && currentTask?.id) {
      loadTaskResult(currentTask.id)
      setGenerating(false)
    }
  }, [isCompleted])

  // 监听任务失败
  useEffect(() => {
    if (isFailed) {
      setError(progressMessage || '分析失败')
      setGenerating(false)
    }
  }, [isFailed, progressMessage])

  const loadProjectData = useCallback(async () => {
    try {
      const project = await ProjectsAPI.getProject(projectId)

      // 查找标准文档
      if (project.metadata?.uploadedDocuments && project.metadata?.uploadedDocuments.length > 0) {
        setStandardDocument(project.metadata?.uploadedDocuments[0])
      }

      // 查找聚类任务
      const tasks = await AITasksAPI.getTasksByProject(projectId)
      const clusteringTask = tasks
        .filter((t) => t.type === 'clustering' && t.status === 'completed')
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())[0]

      if (clusteringTask) {
        setClusteringTaskId(clusteringTask.id)
      }

      // 尝试从缓存加载分析结果
      const cachedAnalysis = cache.get(projectId, 'quick_gap_analysis')
      if (cachedAnalysis) {
        console.log('✅ 从缓存加载快速差距分析结果')
        setAnalysisResult(cachedAnalysis)
      }
    } catch (err: any) {
      console.error('Failed to load project data:', err)
    }
  }, [projectId, cache])

  const handleSubmit = async (values: any) => {
    if (!standardDocument) {
      message.error('项目没有标准文档，请先上传标准文档')
      return
    }

    try {
      setGenerating(true)
      setError(null)

      // 创建AI任务
      const newTask = await AITasksAPI.createTask({
        projectId,
        type: 'quick_gap_analysis',
        input: {
          currentStateDescription: values.description,
          standardDocument: {
            id: standardDocument.id,
            name: standardDocument.name,
            content: standardDocument.content,
          },
          clusteringTaskId: clusteringTaskId || undefined,
        },
      })

      setCurrentTask(newTask)
      message.success('差距分析任务已创建')
    } catch (err: any) {
      setError(err.message || '提交失败')
      setGenerating(false)
    }
  }

  const loadTaskResult = useCallback(async (taskId: string) => {
    try {
      const task = await AITasksAPI.getTask(taskId)
      if (task.result) {
        const result = TaskAdapter.toGenerationResult(task)
        const analysisResult = result.selectedResult as QuickGapAnalysisResult
        setAnalysisResult(analysisResult)

        // 缓存结果
        cache.set(projectId, 'quick_gap_analysis', taskId, analysisResult)

        message.success('差距分析完成')
      }
    } catch (err: any) {
      console.error('Failed to load task result:', err)
      setError('无法加载分析结果')
    }
  }, [projectId, cache])

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

  const getPriorityTag = useCallback((priority: string) => {
    const colors: Record<string, string> = {
      HIGH: 'red',
      MEDIUM: 'orange',
      LOW: 'green',
    }
    const labels: Record<string, string> = {
      HIGH: '高优先级',
      MEDIUM: '中优先级',
      LOW: '低优先级',
    }
    return <Tag color={colors[priority]}>{labels[priority] || priority}</Tag>
  }, [])

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 头部 */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.back()}>
            返回
          </Button>
          <div>
            <h1 className="text-2xl font-bold">超简版差距分析</h1>
            <p className="text-gray-500">输入您的现状描述，AI自动分析差距并生成改进措施</p>
          </div>
        </div>
      </div>

      {/* 输入表单 */}
      {!generating && !analysisResult && (
        <Card className="mb-6">
          <Form form={form} layout="vertical" onFinish={handleSubmit}>
            <Form.Item
              label="现状描述"
              name="description"
              rules={[
                { required: true, message: '请输入现状描述' },
                { min: 500, message: '现状描述至少需要500字' },
              ]}
              extra="请详细描述您组织当前的信息安全现状，包括已具备的能力、已实施的措施、存在的问题等"
            >
              <TextArea
                rows={15}
                placeholder={`示例描述模板：

一、组织基本情况
我们公司是一家中型互联网企业，员工约200人，主要从事电商业务。

二、已具备的安全能力
1. 基础网络安全：已部署防火墙、入侵检测系统
2. 访问控制：实施了基于角色的访问控制
3. 数据备份：重要数据每周备份一次

三、已实施的安全措施
1. 制度建设：制定了基本的安全管理制度
2. 人员培训：每半年进行一次安全培训
3. 应急响应：建立了基本的安全事件响应流程

四、存在的问题和不足
1. 缺乏系统的安全策略文档
2. 访问控制粒度较粗，难以满足细粒度要求
3. 数据加密措施不完善
4. 安全审计能力不足
5. 缺乏持续的安全监控机制

请根据您组织的实际情况，详细描述以上各方面内容...`}
                showCount
                maxLength={10000}
              />
            </Form.Item>

            {standardDocument && (
              <Alert
                message="将使用标准文档"
                description={standardDocument.name}
                type="info"
                showIcon
                className="mb-4"
              />
            )}

            {clusteringTaskId && (
              <Alert
                message="将使用聚类结果提供更精准的分析"
                type="success"
                showIcon
                className="mb-4"
              />
            )}

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SendOutlined />}
                loading={loading}
                size="large"
              >
                提交分析
              </Button>
            </Form.Item>
          </Form>
        </Card>
      )}

      {/* 生成进度 */}
      {generating && (
        <Card>
          <div className="text-center py-8">
            <Spin size="large" />
            <div className="mt-4">
              <p className="text-lg">正在分析差距，请稍候...</p>
              <Progress percent={progress} className="mt-2" />
              <p className="text-gray-500 mt-2">{progressMessage}</p>
            </div>
          </div>
        </Card>
      )}

      {/* 分析结果 */}
      {analysisResult && (
        <>
          {/* 总体统计 */}
          <Card className="mb-6" title={<BarChartOutlined /> + " 差距分析总览"}>
            <Row gutter={16}>
              <Col span={6}>
                <Statistic
                  title="合规率"
                  value={analysisResult.gap_analysis.compliance_rate * 100}
                  precision={1}
                  suffix="%"
                  valueStyle={{
                    color:
                      analysisResult.gap_analysis.compliance_rate >= 0.8
                        ? '#3f8600'
                        : analysisResult.gap_analysis.compliance_rate >= 0.6
                          ? '#faad14'
                          : '#cf1322',
                  }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="总要求"
                  value={analysisResult.gap_analysis.total_requirements}
                  suffix="项"
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="已满足"
                  value={analysisResult.gap_analysis.satisfied_requirements}
                  suffix="项"
                  valueStyle={{ color: '#3f8600' }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="差距"
                  value={analysisResult.gap_analysis.gap_requirements}
                  suffix="项"
                  valueStyle={{ color: '#cf1322' }}
                />
              </Col>
            </Row>
            <Divider />
            <Alert
              message={analysisResult.gap_analysis.overview}
              type="info"
              showIcon
            />
          </Card>

          {/* 详细结果 */}
          <Card>
            <Tabs defaultActiveKey="gaps">
              <TabPane tab={<span><WarningOutlined /> 差距详情</span>} key="gaps">
                {analysisResult.gap_details.length === 0 ? (
                  <Alert
                    message="未发现明显差距"
                    description="恭喜！您的组织现状已基本满足标准要求。"
                    type="success"
                    showIcon
                  />
                ) : (
                  <Collapse
                    accordion
                    items={analysisResult.gap_details.map((gap, index) => ({
                      key: index,
                      label: (
                        <div className="flex items-center justify-between">
                          <span>
                            {gap.cluster_name} - {gap.clause_id}
                          </span>
                          {getPriorityTag(gap.priority)}
                        </div>
                      ),
                      children: (
                        <div>
                          <p>
                            <strong>条款要求：</strong> {gap.clause_text}
                          </p>
                          <p>
                            <strong>当前现状：</strong> {gap.current_state}
                          </p>
                          <p>
                            <strong>差距描述：</strong>
                            <span style={{ color: '#cf1322' }}>{gap.gap}</span>
                          </p>
                        </div>
                      ),
                    }))}
                  />
                )}
              </TabPane>

              <TabPane tab={<span><RocketOutlined /> 改进措施</span>} key="actions">
                {analysisResult.action_plan.length === 0 ? (
                  <Alert
                    message="暂无改进措施"
                    description="由于未发现明显差距，暂无需要实施的改进措施。"
                    type="info"
                    showIcon
                  />
                ) : (
                  <Space direction="vertical" style={{ width: '100%' }} size="large">
                    {analysisResult.action_plan.map((action) => (
                      <Card
                        key={action.action_id}
                        size="small"
                        title={
                          <div className="flex items-center justify-between">
                            <span>
                              {action.action_id} - {action.cluster_name}
                            </span>
                            {getPriorityTag(action.priority)}
                          </div>
                        }
                      >
                        <p>
                          <strong>涉及条款：</strong>{' '}
                          {action.gap_clauses.join(', ')}
                        </p>
                        <p>
                          <strong>预期效果：</strong> {action.expected_impact}
                        </p>
                        <p>
                          <strong>预估工作量：</strong> {action.estimated_effort}
                        </p>
                        <Divider orientation="left" orientationMargin="0">
                          具体措施
                        </Divider>
                        <ul>
                          {action.action_items.map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      </Card>
                    ))}
                  </Space>
                )}
              </TabPane>
            </Tabs>
          </Card>
        </>
      )}

      {/* 错误提示 */}
      {error && (
        <Alert
          message="错误"
          description={error}
          type="error"
          showIcon
          closable
          onClose={() => setError(null)}
          className="mb-6"
        />
      )}
    </div>
  )
}
