'use client'

/**
 * 聚类结果展示组件
 * 显示聚类树形结构、覆盖率统计和高风险条款
 */

import React, { useState } from 'react'
import { Card, Collapse, Tag, Progress, Badge, Space, Statistic, Row, Col, Alert } from 'antd'
import {
  ClusterOutlined,
  FileTextOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  RobotOutlined,
} from '@ant-design/icons'
import type { GenerationResult } from '@/lib/types/ai-generation'
import MissingClausesHandler from './MissingClausesHandler'

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
  documents?: StandardDocument[] // 添加可选标记
}

export default function ClusteringResultDisplay({ result, documents = [] }: Props) {
  // 解析聚类结果 - 支持新旧两种数据格式
  let clusteringResult: ClusteringResult

  try {
    // 新格式：result.content 包含 JSON 字符串
    if (result.content) {
      if (typeof result.content === 'string') {
        console.log('📦 Parsing content string, length:', result.content.length)
        clusteringResult = JSON.parse(result.content)
      } else {
        clusteringResult = result.content
      }
    }
    // 旧格式：result.selectedResult
    else if (result.selectedResult) {
      if (typeof result.selectedResult === 'string') {
        clusteringResult = JSON.parse(result.selectedResult)
      } else {
        clusteringResult = result.selectedResult
      }
    }
    // 直接就是聚类结果
    else {
      clusteringResult = result as any
    }
  } catch (parseError) {
    console.error('❌ Failed to parse clustering result:', parseError)
    console.log('📄 Raw result:', result)
    return (
      <Alert
        message="数据解析失败"
        description={
          <div>
            <p>无法解析聚类结果数据</p>
            <p>错误: {parseError.message}</p>
            <details>
              <summary>查看原始数据</summary>
              <pre style={{ maxHeight: '300px', overflow: 'auto' }}>
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>
          </div>
        }
        type="error"
        showIcon
      />
    )
  }

  // 检查数据有效性
  if (!clusteringResult) {
    return (
      <Alert
        message="数据为空"
        description="聚类结果数据为空"
        type="error"
        showIcon
      />
    )
  }

  if (!clusteringResult.categories) {
    console.warn('⚠️ Missing categories in clustering result')
    console.log('📦 Available keys:', Object.keys(clusteringResult))
    return (
      <Alert
        message="数据格式错误"
        description={
          <div>
            <p>聚类结果数据格式不正确，缺少 categories 字段</p>
            <p>可用字段: {Object.keys(clusteringResult).join(', ')}</p>
            <details>
              <summary>查看完整数据</summary>
              <pre style={{ maxHeight: '400px', overflow: 'auto' }}>
                {JSON.stringify(clusteringResult, null, 2)}
              </pre>
            </details>
          </div>
        }
        type="error"
        showIcon
      />
    )
  }

  const { clustering_logic, coverage_summary: initialCoverage } = clusteringResult
  const [categories, setCategories] = useState<Category[]>(clusteringResult.categories)
  const [coverageSummary, setCoverageSummary] = useState(initialCoverage)

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
      alert('任务ID已复制到剪贴板！')
    }
  }

  // 导出聚类结果为CSV
  const handleExportCSV = () => {
    try {
      const csvRows: string[] = []

      // CSV Header
      csvRows.push('Category ID,Category Name,Cluster ID,Cluster Name,Importance,Risk Level,Clause ID,Source Document,Clause Text,Rationale')

      // 遍历三层结构导出数据
      categories.forEach((category) => {
        category.clusters.forEach((cluster) => {
          cluster.clauses.forEach((clause) => {
            const row = [
              category.id,
              category.name,
              cluster.id,
              cluster.name,
              cluster.importance,
              cluster.risk_level,
              clause.clause_id,
              clause.source_document_name,
              `"${clause.clause_text.replace(/"/g, '""')}"`, // 转义双引号
              `"${clause.rationale.replace(/"/g, '""')}"`,
            ]
            csvRows.push(row.join(','))
          })
        })
      })

      // 创建下载
      const csvContent = csvRows.join('\n')
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `clustering_result_${result.taskId}.csv`
      link.click()
      URL.revokeObjectURL(url)

      alert('聚类结果已导出为CSV文件！')
    } catch (error) {
      alert('导出失败：' + (error instanceof Error ? error.message : '未知错误'))
    }
  }

  // 跳转到矩阵生成页面
  const handleGenerateMatrix = () => {
    window.location.href = `/ai-generation/matrix?taskId=${result.taskId}`
  }

  // 处理聚类更新（当用户添加缺失条款时）
  const handleUpdateClustering = (updatedCategories: Category[]) => {
    setCategories(updatedCategories)

    // 重新计算覆盖率摘要
    const newCoverageSummary = recalculateCoverage(updatedCategories, documents)
    setCoverageSummary(newCoverageSummary)
  }

  // 重新计算覆盖率
  const recalculateCoverage = (
    cats: Category[],
    docs: StandardDocument[],
  ): ClusteringResult['coverage_summary'] => {
    const byDocument: Record<string, any> = {}

    docs.forEach((doc) => {
      // 从聚类中提取该文档的所有条款
      const docClauses = cats
        .flatMap((cat) => cat.clusters || [])
        .flatMap((cluster) => cluster.clauses || [])
        .filter((clause: any) => clause.source_document_id === doc.id)

      // ✅ 修复：统计文档实际条款数（去重）
      const allClauseMatches = doc.content.match(/第[一二三四五六七八九十百千]+条/g) || []
      const allClauseIds = [...new Set(allClauseMatches)] // 去重
      const actualClauseCount = allClauseIds.length

      // 统计唯一提取的条款（从聚类中）
      const uniqueClusteredIds = new Set<string>()
      docClauses.forEach((clause: any) => {
        uniqueClusteredIds.add(clause.clause_id)
      })

      // ✅ 修复：过滤掉AI生成的、文档中不存在的条款
      const validClusteredIds = Array.from(uniqueClusteredIds).filter(id =>
        allClauseIds.includes(id)
      )
      const finalClusteredCount = validClusteredIds.length

      // 找出缺失的条款
      const missingClauseIds = allClauseIds.filter((id) => !uniqueClusteredIds.has(id))

      byDocument[doc.id] = {
        total_clauses: actualClauseCount, // ✅ 使用去重后的条款数
        clustered_clauses: finalClusteredCount, // ✅ 确保不超过total_clauses
        missing_clause_ids: missingClauseIds,
      }
    })

    const totalClauses = Object.values(byDocument).reduce((sum: number, doc: any) => sum + doc.total_clauses, 0)
    const clusteredClauses = Object.values(byDocument).reduce((sum: number, doc: any) => sum + doc.clustered_clauses, 0)

    return {
      by_document: byDocument,
      overall: {
        total_clauses: totalClauses,
        clustered_clauses: clusteredClauses,
        coverage_rate: totalClauses > 0 ? clusteredClauses / totalClauses : 0,
      },
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
          <div className="space-y-3">
            <div>
              <span className="text-sm text-gray-600">任务ID：</span>
            </div>
            <div className="flex items-center gap-2">
              <code className="bg-gray-100 px-3 py-2 rounded font-mono text-sm flex-1 select-all">
                {result.taskId}
              </code>
              <button
                onClick={handleCopyTaskId}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm whitespace-nowrap"
              >
                复制ID
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleGenerateMatrix}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
              >
                🎯 生成成熟度矩阵
              </button>
              <button
                onClick={handleExportCSV}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 whitespace-nowrap"
              >
                📊 导出CSV
              </button>
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
              value={coverageSummary?.overall?.coverage_rate ? (coverageSummary.overall.coverage_rate * 100).toFixed(1) : '0.0'}
              suffix="%"
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: coverageSummary?.overall?.coverage_rate && coverageSummary.overall.coverage_rate >= 0.95 ? '#3f8600' : '#faad14' }}
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
              title="AI模型"
              value={(result as any).selectedModel || 'GPT4'}
              prefix={<RobotOutlined />}
            />
          </Col>
        </Row>
      </Card>

      {/* 质量分数 - 仅在存在时显示 */}
      {result.qualityScores && (
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
      )}

      {/* 覆盖率统计 */}
      <Card title="覆盖率统计">
        <div className="space-y-4">
          {/* 总体覆盖率 */}
          <div>
            <h4 className="font-semibold mb-2">总体覆盖率</h4>
            <Progress
              percent={coverageSummary?.overall?.coverage_rate ? (coverageSummary.overall.coverage_rate * 100).toFixed(1) as any : 0}
              status={coverageSummary?.overall?.coverage_rate && coverageSummary.overall.coverage_rate >= 0.95 ? 'success' : 'normal'}
              format={(percent) => `${percent}% (${coverageSummary?.overall?.clustered_clauses || 0}/${coverageSummary?.overall?.total_clauses || 0})`}
            />
          </div>

          {/* 按文档覆盖率 */}
          <div>
            <h4 className="font-semibold mb-2">各文档覆盖率</h4>
            {coverageSummary?.by_document && Object.entries(coverageSummary.by_document).map(([docId, stats]) => {
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
                  {stats.missing_clause_ids?.length > 0 && (
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

      {/* 缺失条款处理 */}
      {documents && documents.length > 0 && coverageSummary?.by_document && (
        <MissingClausesHandler
          taskId={result.taskId}
          coverageByDocument={coverageSummary.by_document}
          documents={documents}
          categories={categories}
          onUpdateClustering={handleUpdateClustering}
        />
      )}
    </div>
  )
}
