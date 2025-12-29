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

interface Category {
  id: string
  name: string
  description: string
  clusters: Cluster[]
}

interface ClusteringResult {
  categories: Category[] // 第一层：大归类
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

  const { categories, clustering_logic, coverage_summary } = clusteringResult

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

  // 从三层结构中提取所有聚类
  const allClusters = categories.flatMap((cat) => cat.clusters)
  const totalClusters = allClusters.length

  // 统计高风险聚类
  const highRiskClusters = allClusters.filter((c) => c.risk_level === 'HIGH')

  // 复制任务ID到剪贴板
  const handleCopyTaskId = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(result.taskId)
      // 这里应该使用message.success，但需要先导入
      alert('任务ID已复制到剪贴板！')
    }
  }

  return (
    <div className="space-y-6">
      {/* 任务ID显示（重要：用于下一步矩阵生成） */}
      <Alert
        message={
          <div>
            <strong>✅ 聚类任务完成！下一步：生成成熟度矩阵</strong>
          </div>
        }
        description={
          <div className="space-y-2">
            <div>
              <span className="text-sm text-gray-600">请复制以下任务ID，用于生成成熟度矩阵：</span>
            </div>
            <div className="flex items-center gap-2">
              <code className="bg-gray-100 px-3 py-2 rounded font-mono text-sm flex-1 select-all">
                {result.taskId}
              </code>
              <button
                onClick={handleCopyTaskId}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
              >
                复制ID
              </button>
            </div>
            <div className="text-xs text-gray-500">
              💡 提示：访问 <a href="/ai-generation/matrix" className="text-blue-600 underline">/ai-generation/matrix</a> 页面，粘贴此ID开始生成成熟度矩阵
            </div>
          </div>
        }
        type="success"
        showIcon
        icon={<CheckCircleOutlined />}
      />

      {/* 基本信息 */}
      <Card>
        <Row gutter={16}>
          <Col span={4}>
            <Statistic
              title="大类数量"
              value={categories.length}
              prefix={<FileTextOutlined />}
              suffix="个"
            />
          </Col>
          <Col span={5}>
            <Statistic
              title="聚类数量"
              value={totalClusters}
              prefix={<ClusterOutlined />}
              suffix="个"
            />
          </Col>
          <Col span={5}>
            <Statistic
              title="覆盖率"
              value={(coverage_summary.overall.coverage_rate * 100).toFixed(1)}
              suffix="%"
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: coverage_summary.overall.coverage_rate >= 0.95 ? '#3f8600' : '#faad14' }}
            />
          </Col>
          <Col span={5}>
            <Statistic
              title="高风险聚类"
              value={highRiskClusters.length}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Col>
          <Col span={5}>
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

      {/* 聚类详情（三层结构展示）*/}
      <Card
        title={
          <Space>
            <span>聚类详情（三层结构）</span>
            <Tag color="purple">{categories.length}个大类</Tag>
            <Tag color="blue">{totalClusters}个聚类</Tag>
          </Space>
        }
      >
        <Collapse accordion defaultActiveKey={categories[0]?.id}>
          {categories.map((category, categoryIndex) => (
            <Panel
              key={category.id}
              header={
                <div className="flex items-center justify-between w-full pr-4">
                  <Space>
                    <Badge
                      count={categoryIndex + 1}
                      style={{ backgroundColor: '#722ed1' }}
                    />
                    <span className="font-bold text-lg">{category.name}</span>
                    <Tag color="purple">大类</Tag>
                  </Space>
                  <Tag color="blue">{category.clusters.length}个聚类</Tag>
                </div>
              }
            >
              <div className="space-y-4">
                {/* 大类描述 */}
                <Alert
                  message="大类描述"
                  description={category.description}
                  type="info"
                  showIcon
                  className="mb-4"
                />

                {/* 该大类下的所有聚类 */}
                <Collapse accordion>
                  {category.clusters.map((cluster, clusterIndex) => (
                    <Panel
                      key={cluster.id}
                      header={
                        <div className="flex items-center justify-between w-full pr-4">
                          <Space>
                            <Badge
                              count={clusterIndex + 1}
                              style={{ backgroundColor: '#52c41a' }}
                            />
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
                          type="success"
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
