'use client'

/**
 * 综述结果展示组件
 * 显示生成的综述内容、质量评分和一致性报告
 */

import { useState } from 'react'
import { Card, Descriptions, Tag, Progress, Collapse, Button, Space, Modal, message } from 'antd'
import { CheckCircleOutlined, WarningOutlined, InfoCircleOutlined, DownloadOutlined } from '@ant-design/icons'
import type { SummaryResult, GenerationResult, ConfidenceLevel, SelectedModel } from '@/lib/types/ai-generation'
import { AIGenerationAPI } from '@/lib/api/ai-generation'

const { Panel } = Collapse

interface SummaryResultDisplayProps {
  result: GenerationResult
  onReviewComplete?: () => void
}

export default function SummaryResultDisplay({ result, onReviewComplete }: SummaryResultDisplayProps) {
  const [reviewModalVisible, setReviewModalVisible] = useState(false)
  const [isReviewing, setIsReviewing] = useState(false)

  // Parse selectedResult if it's a string (defensive programming)
  const summaryResult: SummaryResult = typeof result.selectedResult === 'string'
    ? JSON.parse(result.selectedResult)
    : result.selectedResult as SummaryResult

  // 置信度颜色映射
  const getConfidenceColor = (level: ConfidenceLevel) => {
    switch (level) {
      case 'HIGH':
        return 'green'
      case 'MEDIUM':
        return 'orange'
      case 'LOW':
        return 'red'
    }
  }

  // 模型名称映射
  const getModelName = (model: SelectedModel) => {
    switch (model) {
      case 'gpt4':
        return 'GPT-4'
      case 'claude':
        return 'Claude'
      case 'domestic':
        return '通义千问'
    }
  }

  // 重要性标签
  const getImportanceTag = (importance: 'HIGH' | 'MEDIUM' | 'LOW') => {
    const config = {
      HIGH: { color: 'red', text: '高' },
      MEDIUM: { color: 'orange', text: '中' },
      LOW: { color: 'blue', text: '低' },
    }
    return <Tag color={config[importance].color}>{config[importance].text}</Tag>
  }

  // 处理审核
  const handleReview = async (status: 'APPROVED' | 'REJECTED') => {
    setIsReviewing(true)
    try {
      await AIGenerationAPI.updateReviewStatus(
        result.id,
        status,
        'current-user', // TODO: 从用户上下文获取
        undefined,
        status === 'REJECTED' ? '需要重新生成' : '质量符合要求'
      )
      message.success(status === 'APPROVED' ? '已批准' : '已拒绝')
      setReviewModalVisible(false)
      onReviewComplete?.()
    } catch (error) {
      message.error('审核失败')
    } finally {
      setIsReviewing(false)
    }
  }

  // 导出为Word
  const handleExportWord = () => {
    try {
      let htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>${summaryResult.title}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; line-height: 1.6; }
            h1 { color: #1890ff; }
            h2 { color: #262626; margin-top: 30px; border-bottom: 2px solid #1890ff; padding-bottom: 10px; }
            h3 { color: #595959; margin-top: 20px; }
            h4 { color: #8c8c8c; }
            .key-area { background-color: #f5f5f5; padding: 15px; margin: 10px 0; border-left: 4px solid #1890ff; }
            .meta-info { background-color: #fafafa; padding: 20px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <h1>${summaryResult.title}</h1>

          <div class="meta-info">
            <p><strong>生成时间：</strong>${new Date(result.createdAt).toLocaleString('zh-CN')}</p>
            <p><strong>合规级别：</strong>${summaryResult.compliance_level}</p>
          </div>

          <h2>概述</h2>
          <p>${summaryResult.overview}</p>

          <h2>关键领域</h2>
          ${summaryResult.key_areas.map(area => `
            <div class="key-area">
              <h4>${area.name} (${area.importance === 'HIGH' ? '高重要性' : area.importance === 'MEDIUM' ? '中重要性' : '低重要性'})</h4>
              <p>${area.description}</p>
            </div>
          `).join('')}

          <h2>适用范围</h2>
          <p>${summaryResult.scope}</p>

          <h2>关键要求</h2>
          <ul>
            ${summaryResult.key_requirements.map(req => `<li>${req}</li>`).join('')}
          </ul>

          <div class="meta-info">
            <h2>质量评分</h2>
            <p>结构一致性：${((result.qualityScores.structural || 0) * 100).toFixed(1)}%</p>
            <p>语义一致性：${((result.qualityScores.semantic || 0) * 100).toFixed(1)}%</p>
            <p>细节一致性：${((result.qualityScores.detail || 0) * 100).toFixed(1)}%</p>
          </div>
        </body>
        </html>
      `

      const blob = new Blob([htmlContent], { type: 'application/msword' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `summary_${result.taskId}.doc`
      link.click()
      URL.revokeObjectURL(url)

      message.success('综述已导出为Word文件！')
    } catch (error) {
      message.error('导出失败：' + (error instanceof Error ? error.message : '未知错误'))
    }
  }

  return (
    <div className="space-y-6">
      {/* 导出按钮 */}
      <Card size="small">
        <Space>
          <Button icon={<DownloadOutlined />} onClick={handleExportWord}>
            导出Word
          </Button>
        </Space>
      </Card>

      {/* 头部信息卡片 */}
      <Card title="生成信息" size="small">
        <Descriptions column={2} size="small">
          <Descriptions.Item label="任务ID">{result.taskId}</Descriptions.Item>
          <Descriptions.Item label="生成时间">
            {new Date(result.createdAt).toLocaleString('zh-CN')}
          </Descriptions.Item>
          <Descriptions.Item label="选中模型">
            <Tag color="blue">{getModelName(result.selectedModel)}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="置信度">
            <Tag color={getConfidenceColor(result.confidenceLevel)}>
              {result.confidenceLevel}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="审核状态">
            {result.reviewStatus === 'PENDING' && <Tag color="gold">待审核</Tag>}
            {result.reviewStatus === 'APPROVED' && <Tag color="green">已批准</Tag>}
            {result.reviewStatus === 'MODIFIED' && <Tag color="orange">已修改</Tag>}
            {result.reviewStatus === 'REJECTED' && <Tag color="red">已拒绝</Tag>}
          </Descriptions.Item>
          <Descriptions.Item label="版本">v{result.version}</Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 质量评分卡片 */}
      <Card title="质量评分" size="small">
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <div className="flex justify-between mb-2">
              <span>结构一致性 (要求 ≥90%)</span>
              <span className="font-semibold">
                {((result.qualityScores.structural || 0) * 100).toFixed(1)}%
              </span>
            </div>
            <Progress
              percent={parseFloat(((result.qualityScores.structural || 0) * 100).toFixed(1))}
              status={(result.qualityScores.structural || 0) >= 0.9 ? 'success' : 'exception'}
              strokeColor={(result.qualityScores.structural || 0) >= 0.9 ? '#52c41a' : '#faad14'}
            />
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <span>语义一致性 (要求 ≥80%)</span>
              <span className="font-semibold">
                {((result.qualityScores.semantic || 0) * 100).toFixed(1)}%
              </span>
            </div>
            <Progress
              percent={parseFloat(((result.qualityScores.semantic || 0) * 100).toFixed(1))}
              status={(result.qualityScores.semantic || 0) >= 0.8 ? 'success' : 'exception'}
              strokeColor={(result.qualityScores.semantic || 0) >= 0.8 ? '#52c41a' : '#faad14'}
            />
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <span>细节一致性 (要求 ≥60%)</span>
              <span className="font-semibold">
                {((result.qualityScores.detail || 0) * 100).toFixed(1)}%
              </span>
            </div>
            <Progress
              percent={parseFloat(((result.qualityScores.detail || 0) * 100).toFixed(1))}
              status={(result.qualityScores.detail || 0) >= 0.6 ? 'success' : 'exception'}
              strokeColor={(result.qualityScores.detail || 0) >= 0.6 ? '#52c41a' : '#faad14'}
            />
          </div>
        </Space>
      </Card>

      {/* 一致性报告卡片 */}
      <Card title="一致性报告" size="small">
        <Collapse ghost>
          <Panel
            header={
              <span>
                <CheckCircleOutlined className="text-green-500 mr-2" />
                一致点 ({result.consistencyReport.agreements.length})
              </span>
            }
            key="1"
          >
            <ul className="list-disc list-inside text-sm">
              {result.consistencyReport.agreements.map((item, index) => (
                <li key={index} className="mb-1">
                  {item}
                </li>
              ))}
            </ul>
          </Panel>

          {result.consistencyReport.disagreements.length > 0 && (
            <Panel
              header={
                <span>
                  <InfoCircleOutlined className="text-blue-500 mr-2" />
                  差异点 ({result.consistencyReport.disagreements.length})
                </span>
              }
              key="2"
            >
              <ul className="list-disc list-inside text-sm">
                {result.consistencyReport.disagreements.map((item, index) => (
                  <li key={index} className="mb-1">
                    {item}
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {result.consistencyReport.highRiskDisagreements.length > 0 && (
            <Panel
              header={
                <span>
                  <WarningOutlined className="text-red-500 mr-2" />
                  高风险差异 ({result.consistencyReport.highRiskDisagreements.length})
                </span>
              }
              key="3"
            >
              <ul className="list-disc list-inside text-sm">
                {result.consistencyReport.highRiskDisagreements.map((item, index) => (
                  <li key={index} className="mb-1 text-red-600 font-medium">
                    {item}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </Collapse>
      </Card>

      {/* 覆盖率报告（如果存在） */}
      {result.coverageReport && (
        <Card title="覆盖率报告" size="small">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span>覆盖率</span>
              <span className="text-2xl font-bold">
                {(result.coverageReport.coverageRate * 100).toFixed(1)}%
              </span>
            </div>
            <Progress
              percent={parseFloat((result.coverageReport.coverageRate * 100).toFixed(1))}
              status={result.coverageReport.coverageRate >= 0.95 ? 'success' : 'exception'}
            />
            <Descriptions column={1} size="small">
              <Descriptions.Item label="总条款数">
                {result.coverageReport.totalClauses}
              </Descriptions.Item>
              <Descriptions.Item label="已覆盖条款">
                {result.coverageReport.coveredClauses.length}
              </Descriptions.Item>
              {result.coverageReport.missingClauses.length > 0 && (
                <Descriptions.Item label="缺失条款">
                  <div className="text-red-600">
                    {result.coverageReport.missingClauses.join(', ')}
                  </div>
                </Descriptions.Item>
              )}
            </Descriptions>
          </div>
        </Card>
      )}

      {/* 综述内容卡片 */}
      <Card title="综述内容" size="small">
        <div className="space-y-6">
          {/* 标题 */}
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">{summaryResult.title}</h2>
          </div>

          {/* 概述 */}
          <div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">概述</h3>
            <p className="text-gray-600 leading-relaxed">{summaryResult.overview}</p>
          </div>

          {/* 关键领域 */}
          <div>
            <h3 className="text-lg font-semibold text-gray-700 mb-3">关键领域</h3>
            <div className="space-y-4">
              {summaryResult.key_areas.map((area, index) => (
                <Card key={index} size="small" className="bg-gray-50">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-semibold text-gray-800">{area.name}</h4>
                    {getImportanceTag(area.importance)}
                  </div>
                  <p className="text-sm text-gray-600">{area.description}</p>
                </Card>
              ))}
            </div>
          </div>

          {/* 适用范围 */}
          <div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">适用范围</h3>
            <p className="text-gray-600 leading-relaxed">{summaryResult.scope}</p>
          </div>

          {/* 关键要求 */}
          <div>
            <h3 className="text-lg font-semibold text-gray-700 mb-3">关键要求</h3>
            <ul className="list-disc list-inside space-y-2">
              {summaryResult.key_requirements.map((req, index) => (
                <li key={index} className="text-gray-600">
                  {req}
                </li>
              ))}
            </ul>
          </div>

          {/* 合规级别 */}
          <div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">合规级别说明</h3>
            <p className="text-gray-600 leading-relaxed">{summaryResult.compliance_level}</p>
          </div>
        </div>
      </Card>

      {/* 审核操作 */}
      {result.reviewStatus === 'PENDING' && (
        <Card size="small">
          <div className="flex justify-center gap-4">
            <Button type="primary" size="large" onClick={() => handleReview('APPROVED')}>
              批准使用
            </Button>
            <Button danger size="large" onClick={() => handleReview('REJECTED')}>
              拒绝并重新生成
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
