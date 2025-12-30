'use client'

/**
 * 落地措施生成与展示页面
 * 基于成熟度分析结果生成具体的改进措施
 */

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { exportActionPlanToExcel } from '@/lib/utils/export-action-plan'
import {
  Card,
  Button,
  message,
  Spin,
  Progress,
  Tag,
  Collapse,
  Steps,
  Space,
  Divider,
  Alert,
  Timeline,
  Descriptions,
  Empty,
  Statistic,
  Row,
  Col,
} from 'antd'
import {
  RocketOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DownloadOutlined,
  ArrowLeftOutlined,
  ThunderboltOutlined,
  BulbOutlined,
  SafetyOutlined,
  TeamOutlined,
  DollarOutlined,
  LineChartOutlined,
} from '@ant-design/icons'

const { Panel } = Collapse

interface ActionPlanMeasure {
  id: string
  clusterName: string
  clusterId: string
  currentLevel: number
  targetLevel: number
  gap: number
  priority: 'high' | 'medium' | 'low'
  title: string
  description: string
  implementationSteps: Array<{
    stepNumber: number
    title: string
    description: string
    duration: string
  }>
  timeline: string
  responsibleDepartment: string
  expectedImprovement: number
  resourcesNeeded: {
    budget?: string
    personnel?: string[]
    technology?: string[]
    training?: string
  }
  dependencies: {
    prerequisiteMeasures?: string[]
    externalDependencies?: string[]
  }
  risks: Array<{
    risk: string
    mitigation: string
  }>
  kpiMetrics: Array<{
    metric: string
    target: string
    measurementMethod: string
  }>
  status: string
  progress: number
  sortOrder: number
}

interface TaskStatus {
  taskId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  errorMessage?: string
  result?: any
  measures: ActionPlanMeasure[]
  createdAt: string
  completedAt?: string
}

export default function ActionPlanPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const surveyId = searchParams.get('surveyId')
  const targetMaturity = parseFloat(searchParams.get('targetMaturity') || '0')

  const [taskId, setTaskId] = useState<string | null>(null)
  const [taskStatus, setTaskStatus] = useState<TaskStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [polling, setPolling] = useState(false)

  // 启动生成任务
  useEffect(() => {
    if (surveyId && targetMaturity && !taskId) {
      startGeneration()
    }
  }, [surveyId, targetMaturity])

  // 轮询任务状态
  useEffect(() => {
    if (taskId && polling) {
      const interval = setInterval(() => {
        fetchTaskStatus()
      }, 3000) // 每3秒轮询一次

      return () => clearInterval(interval)
    }
  }, [taskId, polling])

  const startGeneration = async () => {
    if (!surveyId) {
      message.error('缺少问卷ID')
      return
    }

    setLoading(true)

    try {
      const response = await fetch(`http://localhost:3000/survey/${surveyId}/action-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetMaturity }),
      })

      const data = await response.json()

      if (data.success) {
        setTaskId(data.data.taskId)
        setPolling(true)
        message.success('落地措施生成任务已启动')
      } else {
        message.error(data.message || '启动生成任务失败')
      }
    } catch (error: any) {
      message.error('网络请求失败: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchTaskStatus = async () => {
    if (!taskId || !surveyId) return

    try {
      const response = await fetch(
        `http://localhost:3000/survey/${surveyId}/action-plan/task/${taskId}`,
      )
      const data = await response.json()

      if (data.success) {
        setTaskStatus(data.data)

        // 如果任务完成或失败，停止轮询
        if (data.data.status === 'completed' || data.data.status === 'failed') {
          setPolling(false)

          if (data.data.status === 'completed') {
            message.success('落地措施生成完成!')
          } else {
            message.error('生成失败: ' + data.data.errorMessage)
          }
        }
      }
    } catch (error: any) {
      console.error('获取任务状态失败:', error)
    }
  }

  const handleExportToExcel = () => {
    if (!taskStatus || !taskStatus.measures || taskStatus.measures.length === 0) {
      message.warning('没有可导出的措施数据')
      return
    }

    try {
      exportActionPlanToExcel(taskStatus.measures, targetMaturity, '成熟度改进措施计划')
      message.success('Excel文件已生成并下载!')
    } catch (error: any) {
      message.error('导出失败: ' + error.message)
      console.error('导出Excel失败:', error)
    }
  }

  const getPriorityColor = (priority: string) => {
    const colors = {
      high: 'red',
      medium: 'orange',
      low: 'blue',
    }
    return colors[priority as keyof typeof colors] || 'default'
  }

  const getPriorityText = (priority: string) => {
    const texts = {
      high: '高优先级',
      medium: '中优先级',
      low: '低优先级',
    }
    return texts[priority as keyof typeof texts] || priority
  }

  // 按聚类分组措施
  const groupedMeasures = taskStatus?.measures.reduce((acc, measure) => {
    if (!acc[measure.clusterName]) {
      acc[measure.clusterName] = []
    }
    acc[measure.clusterName].push(measure)
    return acc
  }, {} as Record<string, ActionPlanMeasure[]>) || {}

  const renderMeasureCard = (measure: ActionPlanMeasure, index: number) => (
    <Card
      key={measure.id}
      style={{ marginBottom: 16 }}
      bordered={false}
      className="measure-card"
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {/* 标题区域 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Tag color={getPriorityColor(measure.priority)}>
              {getPriorityText(measure.priority)}
            </Tag>
            <h3 style={{ margin: 0, fontSize: 16 }}>
              {index + 1}. {measure.title}
            </h3>
          </Space>
          <Space>
            <Tag icon={<LineChartOutlined />}>
              预期提升: +{measure.expectedImprovement.toFixed(1)}分
            </Tag>
            <Tag icon={<ClockCircleOutlined />}>{measure.timeline}</Tag>
          </Space>
        </div>

        {/* 描述 */}
        <Alert
          message={measure.description}
          type="info"
          showIcon
          icon={<BulbOutlined />}
        />

        {/* 详细信息折叠面板 */}
        <Collapse ghost>
          <Panel header="📋 实施步骤" key="steps">
            <Steps
              direction="vertical"
              current={-1}
              items={measure.implementationSteps.map((step) => ({
                title: step.title,
                description: (
                  <div>
                    <p>{step.description}</p>
                    <Tag color="cyan">预计耗时: {step.duration}</Tag>
                  </div>
                ),
              }))}
            />
          </Panel>

          <Panel header="💰 资源需求" key="resources">
            <Descriptions column={1} bordered size="small">
              {measure.resourcesNeeded.budget && (
                <Descriptions.Item label={<Space><DollarOutlined /> 预算</Space>}>
                  {measure.resourcesNeeded.budget}
                </Descriptions.Item>
              )}
              {measure.resourcesNeeded.personnel && measure.resourcesNeeded.personnel.length > 0 && (
                <Descriptions.Item label={<Space><TeamOutlined /> 人员</Space>}>
                  {measure.resourcesNeeded.personnel.join(', ')}
                </Descriptions.Item>
              )}
              {measure.resourcesNeeded.technology && measure.resourcesNeeded.technology.length > 0 && (
                <Descriptions.Item label="技术/工具">
                  {measure.resourcesNeeded.technology.map((tech, i) => (
                    <Tag key={i} color="blue">{tech}</Tag>
                  ))}
                </Descriptions.Item>
              )}
              {measure.resourcesNeeded.training && (
                <Descriptions.Item label="培训需求">
                  {measure.resourcesNeeded.training}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="负责部门">
                {measure.responsibleDepartment}
              </Descriptions.Item>
            </Descriptions>
          </Panel>

          {measure.risks && measure.risks.length > 0 && (
            <Panel header="⚠️ 风险与缓解" key="risks">
              <Timeline
                items={measure.risks.map((risk) => ({
                  color: 'red',
                  children: (
                    <div>
                      <strong style={{ color: '#ff4d4f' }}>风险: {risk.risk}</strong>
                      <br />
                      <span style={{ color: '#52c41a' }}>✓ 缓解措施: {risk.mitigation}</span>
                    </div>
                  ),
                }))}
              />
            </Panel>
          )}

          {measure.kpiMetrics && measure.kpiMetrics.length > 0 && (
            <Panel header="📊 KPI指标" key="kpi">
              <Space direction="vertical" style={{ width: '100%' }}>
                {measure.kpiMetrics.map((kpi, i) => (
                  <Card key={i} size="small" style={{ background: '#f0f5ff' }}>
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <strong>{kpi.metric}</strong>
                      <div>目标值: <Tag color="green">{kpi.target}</Tag></div>
                      <div style={{ fontSize: 12, color: '#666' }}>
                        测量方法: {kpi.measurementMethod}
                      </div>
                    </Space>
                  </Card>
                ))}
              </Space>
            </Panel>
          )}

          {measure.dependencies && (
            <Panel header="🔗 依赖关系" key="dependencies">
              <Space direction="vertical" style={{ width: '100%' }}>
                {measure.dependencies.externalDependencies &&
                 measure.dependencies.externalDependencies.length > 0 && (
                  <div>
                    <strong>外部依赖:</strong>
                    <ul>
                      {measure.dependencies.externalDependencies.map((dep, i) => (
                        <li key={i}>{dep}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </Space>
            </Panel>
          )}
        </Collapse>
      </Space>
    </Card>
  )

  return (
    <div style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>
      {/* 顶部导航 */}
      <div style={{ marginBottom: 24 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => router.back()}
          style={{ marginRight: 16 }}
        >
          返回成熟度分析
        </Button>
      </div>

      {/* 页面标题 */}
      <Card style={{ marginBottom: 24 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <RocketOutlined style={{ fontSize: 32, color: '#1890ff' }} />
              <div>
                <h1 style={{ margin: 0, fontSize: 28 }}>成熟度改进措施</h1>
                <p style={{ margin: '8px 0 0 0', color: '#666' }}>
                  基于差距分析生成的具体、可执行的改进计划
                </p>
              </div>
            </Space>
            {taskStatus?.status === 'completed' && (
              <Button
                type="primary"
                size="large"
                icon={<DownloadOutlined />}
                onClick={() => handleExportToExcel()}
              >
                导出措施报告
              </Button>
            )}
          </div>

          {/* 目标信息 */}
          {targetMaturity > 0 && (
            <Alert
              message={
                <span>
                  <strong>改进目标:</strong> 从当前成熟度提升至 <Tag color="blue">Level {targetMaturity.toFixed(1)}</Tag>
                </span>
              }
              type="success"
              showIcon
            />
          )}
        </Space>
      </Card>

      {/* 任务进度 */}
      {loading || (taskStatus && taskStatus.status !== 'completed') ? (
        <Card style={{ marginBottom: 24, textAlign: 'center' }}>
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Spin size="large" />
            <div>
              <h3>
                {taskStatus?.status === 'processing' ? '正在生成改进措施...' : '初始化任务...'}
              </h3>
              <Progress
                percent={taskStatus?.progress || 0}
                status="active"
                strokeColor={{ from: '#108ee9', to: '#87d068' }}
              />
              <p style={{ color: '#666', marginTop: 16 }}>
                AI正在基于您的成熟度分析结果,生成针对性的改进措施
              </p>
            </div>
          </Space>
        </Card>
      ) : null}

      {/* 生成失败 */}
      {taskStatus?.status === 'failed' && (
        <Card>
          <Empty
            description={
              <div>
                <h3>生成失败</h3>
                <p style={{ color: '#ff4d4f' }}>{taskStatus.errorMessage}</p>
                <Button type="primary" onClick={startGeneration}>
                  重新生成
                </Button>
              </div>
            }
          />
        </Card>
      )}

      {/* 措施展示 */}
      {taskStatus?.status === 'completed' && taskStatus.measures.length > 0 && (
        <>
          {/* 统计概览 */}
          <Card style={{ marginBottom: 24 }}>
            <Row gutter={16}>
              <Col span={6}>
                <Statistic
                  title="总计措施数量"
                  value={taskStatus.measures.length}
                  suffix="条"
                  valueStyle={{ color: '#1890ff' }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="涉及聚类"
                  value={Object.keys(groupedMeasures).length}
                  suffix="个"
                  valueStyle={{ color: '#52c41a' }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="高优先级措施"
                  value={taskStatus.measures.filter((m) => m.priority === 'high').length}
                  suffix="条"
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="预期总提升"
                  value={taskStatus.measures
                    .reduce((sum, m) => sum + m.expectedImprovement, 0)
                    .toFixed(1)}
                  suffix="分"
                  valueStyle={{ color: '#faad14' }}
                  prefix={<ThunderboltOutlined />}
                />
              </Col>
            </Row>
          </Card>

          {/* 按聚类分组展示措施 */}
          {Object.entries(groupedMeasures).map(([clusterName, measures]) => {
            const clusterGap = measures[0].gap
            const clusterCurrent = measures[0].currentLevel
            const clusterTarget = measures[0].targetLevel

            return (
              <Card
                key={clusterName}
                title={
                  <Space>
                    <SafetyOutlined />
                    <span style={{ fontSize: 18 }}>{clusterName}</span>
                    <Tag color="volcano">
                      当前 {clusterCurrent.toFixed(2)} → 目标 {clusterTarget.toFixed(1)} (差距 {clusterGap.toFixed(2)})
                    </Tag>
                  </Space>
                }
                style={{ marginBottom: 24 }}
                extra={<Tag color="blue">{measures.length} 条措施</Tag>}
              >
                {measures
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((measure, index) => renderMeasureCard(measure, index))}
              </Card>
            )
          })}
        </>
      )}

      {/* 空状态 */}
      {taskStatus?.status === 'completed' && taskStatus.measures.length === 0 && (
        <Card>
          <Empty description="未生成任何措施" />
        </Card>
      )}
    </div>
  )
}
