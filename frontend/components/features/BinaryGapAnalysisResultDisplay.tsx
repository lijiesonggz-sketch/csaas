'use client'

/**
 * 判断题差距分析结果展示组件
 * 展示基于判断题问卷的差距分析结果
 */

import { useState } from 'react'
import {
  Card,
  Collapse,
  Tag,
  Button,
  Progress,
  Row,
  Col,
  Statistic,
  Alert,
  List,
  Space,
  Divider,
  Descriptions,
  message,
} from 'antd'
import {
  CheckCircleOutlined,
  WarningOutlined,
  RiseOutlined,
  BulbOutlined,
  RocketOutlined,
  BarChartOutlined,
} from '@ant-design/icons'

const { Panel } = Collapse

interface BinaryGapAnalysisResult {
  total_clauses: number
  satisfied_clauses: number
  gap_clauses: number
  compliance_rate: number
  summary: {
    overview: string
    top_gap_clusters: string[]
    recommendations: string[]
  }
  gap_details: Array<{
    cluster_id: string
    cluster_name: string
    clause_id: string
    clause_text: string
    question_text: string
    user_answer: boolean
    gap: boolean
    priority: 'HIGH' | 'MEDIUM' | 'LOW'
  }>
  gap_clusters: Array<{
    cluster_id: string
    cluster_name: string
    total_clauses: number
    gap_clauses: number
    gap_rate: number
    priority: string
  }>
}

interface BinaryGapAnalysisResultDisplayProps {
  result: BinaryGapAnalysisResult
  onGenerateActionPlan?: () => void
  loading?: boolean
}

export default function BinaryGapAnalysisResultDisplay({
  result,
  onGenerateActionPlan,
  loading = false,
}: BinaryGapAnalysisResultDisplayProps) {
  const [showAllGaps, setShowAllGaps] = useState(false)

  // 按优先级排序差距
  const sortedGapDetails = [...result.gap_details].sort((a, b) => {
    const priorityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 }
    return priorityOrder[b.priority] - priorityOrder[a.priority]
  })

  // 显示的差距（默认只显示前10个）
  const displayedGaps = showAllGaps ? sortedGapDetails : sortedGapDetails.slice(0, 10)

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

  const getPriorityTag = (priority: string) => {
    const labels: Record<string, string> = {
      HIGH: '高优先级',
      MEDIUM: '中优先级',
      LOW: '低优先级',
    }
    return <Tag color={getPriorityColor(priority)}>{labels[priority] || priority}</Tag>
  }

  const getComplianceRateColor = (rate: number) => {
    if (rate >= 0.8) return '#52c41a'
    if (rate >= 0.6) return '#faad14'
    return '#f5222d'
  }

  return (
    <div className="space-y-6">
      {/* 总体统计 */}
      <Card>
        <Row gutter={16}>
          <Col span={6}>
            <Statistic
              title="合规率"
              value={result.compliance_rate * 100}
              precision={1}
              suffix="%"
              valueStyle={{ color: getComplianceRateColor(result.compliance_rate) }}
              prefix={<BarChartOutlined />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="总条款"
              value={result.total_clauses}
              suffix="项"
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="已满足"
              value={result.satisfied_clauses}
              suffix="项"
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="差距条款"
              value={result.gap_clauses}
              suffix="项"
              valueStyle={{ color: '#f5222d' }}
              prefix={<WarningOutlined />}
            />
          </Col>
        </Row>

        {result.summary.overview && (
          <>
            <Divider />
            <Alert
              message={result.summary.overview}
              type="info"
              showIcon
              className="mb-4"
            />
          </>
        )}
      </Card>

      {/* 差距聚类汇总 */}
      {result.gap_clusters.length > 0 && (
        <Card title={<span><WarningOutlined /> 差距聚类汇总</span>}>
          <Row gutter={[16, 16]}>
            {result.gap_clusters.map((cluster) => (
              <Col span={8} key={cluster.cluster_id}>
                <Card size="small" className="h-full">
                  <Statistic
                    title={<span className="text-base">{cluster.cluster_name}</span>}
                    value={cluster.gap_rate * 100}
                    precision={1}
                    suffix="%"
                    valueStyle={{
                      color: cluster.gap_rate >= 0.5 ? '#f5222d' : cluster.gap_rate >= 0.3 ? '#faad14' : '#52c41a',
                    }}
                  />
                  <div className="mt-2 text-sm text-gray-600">
                    {cluster.gap_clauses} / {cluster.total_clauses} 条款未满足
                  </div>
                  <div className="mt-1">{getPriorityTag(cluster.priority)}</div>
                </Card>
              </Col>
            ))}
          </Row>

          {result.summary.top_gap_clusters && result.summary.top_gap_clusters.length > 0 && (
            <>
              <Divider />
              <Alert
                message="差距最严重的聚类"
                description={
                  <ul className="mb-0">
                    {result.summary.top_gap_clusters.map((cluster, idx) => (
                      <li key={idx}>{cluster}</li>
                    ))}
                  </ul>
                }
                type="warning"
                showIcon
              />
            </>
          )}
        </Card>
      )}

      {/* 具体差距详情 */}
      {result.gap_details.length > 0 && (
        <Card
          title={<span><WarningOutlined /> 差距详情</span>}
          extra={
            <Button type="link" onClick={() => setShowAllGaps(!showAllGaps)}>
              {showAllGaps ? '收起' : `查看全部 (${result.gap_details.length})`}
            </Button>
          }
        >
          <List
            itemLayout="horizontal"
            dataSource={displayedGaps}
            renderItem={(item) => (
              <List.Item>
                <List.Item.Meta
                  title={
                    <Space>
                      <Tag>{item.cluster_name}</Tag>
                      <Tag>{item.clause_id}</Tag>
                      {getPriorityTag(item.priority)}
                    </Space>
                  }
                  description={
                    <div className="space-y-2">
                      <p>
                        <strong>条款要求：</strong> {item.clause_text}
                      </p>
                      <p>
                        <strong>问题：</strong> {item.question_text}
                      </p>
                      <p>
                        <strong>用户回答：</strong>{' '}
                        <Tag color={item.user_answer ? 'green' : 'red'}>
                          {item.user_answer ? '有' : '没有'}
                        </Tag>
                        {item.gap && (
                          <Tag color="red" className="ml-2">
                            存在差距
                          </Tag>
                        )}
                      </p>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        </Card>
      )}

      {/* 无差距情况 */}
      {result.gap_details.length === 0 && (
        <Card>
          <Alert
            message="恭喜！未发现明显差距"
            description="您的组织现状已基本满足标准要求。"
            type="success"
            showIcon
          />
        </Card>
      )}

      {/* 改进建议 */}
      {result.summary.recommendations && result.summary.recommendations.length > 0 && (
        <Card title={<span><BulbOutlined /> 改进建议</span>}>
          <ul>
            {result.summary.recommendations.map((rec, idx) => (
              <li key={idx} className="mb-2">
                {rec}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* 生成改进措施按钮 */}
      {onGenerateActionPlan && result.gap_details.length > 0 && (
        <Card>
          <div className="text-center">
            <Space direction="vertical" size="large">
              <div>
                <RocketOutlined className="text-4xl text-blue-500" />
                <div className="mt-2 text-lg">需要改进措施吗？</div>
                <div className="text-sm text-gray-500">
                  基于以上差距分析，AI可以为您生成针对性的改进措施
                </div>
              </div>
              <Button
                type="primary"
                size="large"
                icon={<RiseOutlined />}
                onClick={onGenerateActionPlan}
                loading={loading}
              >
                生成改进措施
              </Button>
            </Space>
          </div>
        </Card>
      )}
    </div>
  )
}
