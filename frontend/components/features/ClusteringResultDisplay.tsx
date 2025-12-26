'use client'

/**
 * 聚类结果展示组件
 * 显示聚类树形结构、覆盖率统计和高风险条款
 */

import { Card, Collapse, Tag, Progress, Badge, Space, Statistic, Row, Col, Alert } from 'antd'
import {
  ClusterOutlined,
  FileTextOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import type { GenerationResult } from '@/lib/types/ai-generation'

const { Panel } = Collapse

interface StandardDocument {
  id: string
  name: string
  content: string
}

interface ClusterClause {
  source_document_id: string
  source_document_name: string
  clause_id: string
  clause_text: string
  rationale: string
}

interface Cluster {
  id: string
  name: string
  description: string
  clauses: ClusterClause[]
  importance: 'HIGH' | 'MEDIUM' | 'LOW'
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW'
}

interface ClusteringResult {
  clusters: Cluster[]
  clustering_logic: string
  coverage_summary: {
    by_document: Record<
      string,
      {
        total_clauses: number
        clustered_clauses: number
        missing_clause_ids: string[]
      }
    >
    overall: {
      total_clauses: number
      clustered_clauses: number
      coverage_rate: number
    }
  }
}

interface Props {
  result: GenerationResult
  documents: StandardDocument[]
}

export default function ClusteringResultDisplay({ result, documents }: Props) {
  // 解析聚类结果
  const clusteringResult: ClusteringResult =
    typeof result.selectedResult === 'string'
      ? JSON.parse(result.selectedResult)
      : result.selectedResult

  const { clusters, clustering_logic, coverage_summary } = clusteringResult

  // 风险级别颜色映射
  const riskColorMap = {
    HIGH: 'red',
    MEDIUM: 'orange',
    LOW: 'green',
  }

  // 重要性颜色映射
  const importanceColorMap = {
    HIGH: 'purple',
    MEDIUM: 'blue',
    LOW: 'default',
  }

  // 统计高风险聚类
  const highRiskClusters = clusters.filter((c) => c.risk_level === 'HIGH')

  return (
    <div className="space-y-6">
      {/* 基本信息 */}
      <Card>
        <Row gutter={16}>
          <Col span={6}>
            <Statistic
              title="聚类数量"
              value={clusters.length}
              prefix={<ClusterOutlined />}
              suffix="个"
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="覆盖率"
              value={(coverage_summary.overall.coverage_rate * 100).toFixed(1)}
              suffix="%"
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: coverage_summary.overall.coverage_rate >= 0.95 ? '#3f8600' : '#faad14' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="高风险聚类"
              value={highRiskClusters.length}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="选中模型"
              value={result.selectedModel}
              prefix={<FileTextOutlined />}
            />
          </Col>
        </Row>
      </Card>

      {/* 质量分数 */}
      <Card title="质量评分" size="small">
        <Row gutter={16}>
          <Col span={8}>
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2">结构一致性</p>
              <Progress
                type="circle"
                percent={(result.qualityScores.structural * 100).toFixed(1) as any}
                size={80}
                strokeColor="#52c41a"
              />
            </div>
          </Col>
          <Col span={8}>
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2">语义一致性</p>
              <Progress
                type="circle"
                percent={(result.qualityScores.semantic * 100).toFixed(1) as any}
                size={80}
                strokeColor="#1890ff"
              />
            </div>
          </Col>
          <Col span={8}>
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2">细节一致性</p>
              <Progress
                type="circle"
                percent={(result.qualityScores.detail * 100).toFixed(1) as any}
                size={80}
                strokeColor="#722ed1"
              />
            </div>
          </Col>
        </Row>
      </Card>

      {/* 覆盖率统计 */}
      <Card title="覆盖率统计">
        <div className="space-y-4">
          {/* 总体覆盖率 */}
          <div>
            <h4 className="font-semibold mb-2">总体覆盖率</h4>
            <Progress
              percent={(coverage_summary.overall.coverage_rate * 100).toFixed(1) as any}
              status={coverage_summary.overall.coverage_rate >= 0.95 ? 'success' : 'normal'}
              format={(percent) => `${percent}% (${coverage_summary.overall.clustered_clauses}/${coverage_summary.overall.total_clauses})`}
            />
          </div>

          {/* 按文档覆盖率 */}
          <div>
            <h4 className="font-semibold mb-2">各文档覆盖率</h4>
            {Object.entries(coverage_summary.by_document).map(([docId, stats]) => {
              const doc = documents.find((d) => d.id === docId)
              const coverageRate = stats.total_clauses > 0
                ? (stats.clustered_clauses / stats.total_clauses) * 100
                : 0

              return (
                <div key={docId} className="mb-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium">
                      {doc?.name || docId}
                    </span>
                    <span className="text-sm text-gray-500">
                      {stats.clustered_clauses}/{stats.total_clauses}
                    </span>
                  </div>
                  <Progress
                    percent={coverageRate.toFixed(1) as any}
                    size="small"
                    status={coverageRate >= 95 ? 'success' : 'normal'}
                  />
                  {stats.missing_clause_ids.length > 0 && (
                    <p className="text-xs text-red-500 mt-1">
                      遗漏条款: {stats.missing_clause_ids.join(', ')}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </Card>

      {/* 聚类逻辑说明 */}
      <Card title="聚类逻辑" size="small">
        <p className="text-sm text-gray-700 whitespace-pre-wrap">{clustering_logic}</p>
      </Card>

      {/* 聚类详情 */}
      <Card
        title={
          <Space>
            <span>聚类详情</span>
            <Tag color="blue">{clusters.length}个聚类</Tag>
          </Space>
        }
      >
        <Collapse accordion>
          {clusters.map((cluster, index) => (
            <Panel
              key={cluster.id}
              header={
                <div className="flex items-center justify-between w-full pr-4">
                  <Space>
                    <Badge count={index + 1} style={{ backgroundColor: '#52c41a' }} />
                    <span className="font-semibold">{cluster.name}</span>
                    <Tag color={importanceColorMap[cluster.importance]}>
                      {cluster.importance}
                    </Tag>
                    <Tag
                      color={riskColorMap[cluster.risk_level]}
                      icon={cluster.risk_level === 'HIGH' ? <WarningOutlined /> : null}
                    >
                      风险: {cluster.risk_level}
                    </Tag>
                  </Space>
                  <Tag>{cluster.clauses.length}个条款</Tag>
                </div>
              }
            >
              <div className="space-y-4">
                {/* 聚类描述 */}
                <Alert
                  message="聚类描述"
                  description={cluster.description}
                  type="info"
                  showIcon
                />

                {/* 条款列表 */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-gray-700">包含条款：</h4>
                  {cluster.clauses.map((clause) => (
                    <Card
                      key={`${clause.source_document_id}-${clause.clause_id}`}
                      size="small"
                      className={
                        cluster.risk_level === 'HIGH'
                          ? 'border-red-300 bg-red-50'
                          : cluster.risk_level === 'MEDIUM'
                          ? 'border-orange-300 bg-orange-50'
                          : 'border-gray-200'
                      }
                    >
                      <div className="space-y-2">
                        {/* 条款头部 */}
                        <div className="flex items-start justify-between">
                          <Space>
                            <Tag color="blue">{clause.source_document_name}</Tag>
                            <span className="font-mono text-sm font-semibold">
                              {clause.clause_id}
                            </span>
                          </Space>
                          {cluster.risk_level === 'HIGH' && (
                            <Tag color="red" icon={<WarningOutlined />}>
                              高风险
                            </Tag>
                          )}
                        </div>

                        {/* 条款内容 */}
                        <p className="text-sm text-gray-700">{clause.clause_text}</p>

                        {/* 归类理由 */}
                        <div className="text-xs text-gray-500 bg-gray-100 p-2 rounded">
                          <strong>归类理由：</strong>
                          {clause.rationale}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </Panel>
          ))}
        </Collapse>
      </Card>

      {/* 高风险提醒 */}
      {highRiskClusters.length > 0 && (
        <Alert
          message="高风险提醒"
          description={`检测到 ${highRiskClusters.length} 个高风险聚类，建议优先审查：${highRiskClusters.map((c) => c.name).join('、')}`}
          type="warning"
          showIcon
          icon={<WarningOutlined />}
        />
      )}
    </div>
  )
}
