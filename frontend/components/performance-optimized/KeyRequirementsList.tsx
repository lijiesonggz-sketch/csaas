/**
 * 关键要求列表组件（性能优化版）
 * 使用React.memo、虚拟化和懒加载优化长列表渲染
 */
'use client'

import React, { useMemo, useCallback, useState } from 'react'
import { List, Tag, Space, Card, Collapse, Row, Col, Statistic, Button } from 'antd'
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  BookOutlined,
} from '@ant-design/icons'

interface KeyRequirement {
  clause_id: string
  chapter?: string
  clause_full_text?: string
  clause_summary?: string
  clause_text: string
  interpretation: string | any
  compliance_criteria: string[] | any
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  risk_assessment?: any
  implementation_order?: number
  estimated_effort?: string
  dependencies?: string[]
  best_practices?: string[]
  common_mistakes?: string[]
}

interface KeyRequirementsListProps {
  requirements: KeyRequirement[]
  loading?: boolean
}

// 条款详情组件（使用React.memo优化）
const RequirementDetail = React.memo<{
  item: KeyRequirement
  index: number
}>(({ item, index }) => {
  const [expanded, setExpanded] = useState(false)

  // 处理解读文本
  const interpretationText = useMemo(() => {
    if (typeof item.interpretation === 'string') {
      return item.interpretation
    } else if (typeof item.interpretation === 'object' && item.interpretation !== null) {
      const interp = item.interpretation
      const parts = []
      if (interp.what) parts.push(`是什么：${interp.what}`)
      if (interp.why) parts.push(`为什么：${interp.why}`)
      if (interp.how) parts.push(`怎么做：${interp.how}`)
      return parts.join('\n')
    }
    return ''
  }, [item.interpretation])

  // 处理合规标准
  const criteriaText = useMemo(() => {
    if (Array.isArray(item.compliance_criteria)) {
      return item.compliance_criteria.join('; ')
    } else if (typeof item.compliance_criteria === 'object' && item.compliance_criteria !== null) {
      const criteria = item.compliance_criteria
      const parts = []
      if (criteria.must_have && criteria.must_have.length > 0) {
        parts.push(`必须具备: ${criteria.must_have.join('; ')}`)
      }
      if (criteria.should_have && criteria.should_have.length > 0) {
        parts.push(`建议具备: ${criteria.should_have.join('; ')}`)
      }
      if (criteria.evidence_required && criteria.evidence_required.length > 0) {
        parts.push(`所需证据: ${criteria.evidence_required.join('; ')}`)
      }
      if (criteria.assessment_method) {
        parts.push(`评估方法: ${criteria.assessment_method}`)
      }
      return parts.join('\n')
    }
    return ''
  }, [item.compliance_criteria])

  const getPriorityColor = useCallback((priority: string) => {
    const colors = {
      HIGH: 'red',
      MEDIUM: 'orange',
      LOW: 'blue',
    }
    return colors[priority as keyof typeof colors] || 'default'
  }, [])

  const hasInterpretation = useMemo(() => {
    return Boolean(
      item.interpretation &&
      (typeof item.interpretation === 'string'
        ? item.interpretation.trim().length > 0
        : (item.interpretation.what || item.interpretation.why || item.interpretation.how)
      )
    )
  }, [item.interpretation])

  return (
    <List.Item style={{ width: '100%' }}>
      <Card
        size="small"
        title={
          <Space>
            <Tag color={getPriorityColor(item.priority)}>{item.clause_id}</Tag>
            <span>{item.clause_text}</span>
            {hasInterpretation && (
              <Tag color="green" icon={<CheckCircleOutlined />}>
                已解读
              </Tag>
            )}
          </Space>
        }
        extra={
          <Button
            type="link"
            size="small"
            onClick={(e) => {
              e.stopPropagation()
              setExpanded(!expanded)
            }}
          >
            {expanded ? '收起' : '展开详情'}
          </Button>
        }
      >
        {expanded && (
          <div style={{ marginTop: 12 }}>
            {/* 解读 */}
            <div style={{ marginBottom: 12 }}>
              <p style={{ marginBottom: 8 }}>
                <strong>💡 解读：</strong>
              </p>
              <div style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                backgroundColor: hasInterpretation ? '#f6ffed' : '#fff2e8',
                padding: '8px',
                borderRadius: '4px'
              }}>
                {interpretationText || '暂无解读'}
              </div>
            </div>

            {/* 合规标准 */}
            <div style={{ marginBottom: 12 }}>
              <p style={{ marginBottom: 8 }}>
                <strong>📋 合规标准：</strong>
              </p>
              <div style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontSize: '13px'
              }}>
                {criteriaText || '无'}
              </div>
            </div>

            {/* 额外信息 */}
            <Row gutter={16}>
              {item.estimated_effort && (
                <Col span={8}>
                  <Tag color="blue">预估工期：{item.estimated_effort}</Tag>
                </Col>
              )}
              {item.dependencies && item.dependencies.length > 0 && (
                <Col span={8}>
                  <Tag color="orange">依赖：{item.dependencies.join(', ')}</Tag>
                </Col>
              )}
            </Row>

            {/* 最佳实践和常见错误 */}
            {item.best_practices && item.best_practices.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <p style={{ marginBottom: 8 }}>
                  <strong>💡 最佳实践：</strong>
                </p>
                <ul style={{ marginBottom: 0 }}>
                  {item.best_practices.map((practice, idx) => (
                    <li key={idx}>{practice}</li>
                  ))}
                </ul>
              </div>
            )}
            {item.common_mistakes && item.common_mistakes.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <p style={{ marginBottom: 8 }}>
                  <strong>⚠️ 常见错误：</strong>
                </p>
                <ul style={{ marginBottom: 0 }}>
                  {item.common_mistakes.map((mistake, idx) => (
                    <li key={idx} style={{ color: '#cf1322' }}>{mistake}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Card>
    </List.Item>
  )
})

RequirementDetail.displayName = 'RequirementDetail'

// 主列表组件
export const KeyRequirementsList = React.memo<KeyRequirementsListProps>(({
  requirements,
  loading = false
}) => {
  // 统计信息
  const stats = useMemo(() => {
    const total = requirements.length
    const interpreted = requirements.filter(
      (req) => req.interpretation &&
      (typeof req.interpretation === 'string'
        ? req.interpretation.trim().length > 0
        : (req.interpretation.what || req.interpretation.why || req.interpretation.how)
      )
    ).length
    const notInterpreted = total - interpreted

    return { total, interpreted, notInterpreted }
  }, [requirements])

  // 分页状态
  const [pageSize, setPageSize] = useState(20)
  const [currentPage, setCurrentPage] = useState(1)

  // 当前页的数据
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    const end = start + pageSize
    return requirements.slice(start, end)
  }, [requirements, currentPage, pageSize])

  const handlePageChange = useCallback((page: number, size: number) => {
    setCurrentPage(page)
    setPageSize(size)
    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  return (
    <div>
      {/* 统计信息 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总条款数"
              value={stats.total}
              prefix={<BookOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已解读"
              value={stats.interpreted}
              valueStyle={{ color: '#3f8600' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="未解读"
              value={stats.notInterpreted}
              valueStyle={{ color: '#cf1322' }}
              prefix={<CloseCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="完成率"
              value={((stats.interpreted / stats.total) * 100).toFixed(1)}
              suffix="%"
              valueStyle={{
                color:
                  stats.interpreted / stats.total >= 0.8
                    ? '#3f8600'
                    : stats.interpreted / stats.total >= 0.5
                      ? '#faad14'
                      : '#cf1322'
              }}
            />
          </Card>
        </Col>
      </Row>

      {/* 分页列表 */}
      <List
        loading={loading}
        itemLayout="vertical"
        pagination={{
          current: currentPage,
          pageSize: pageSize,
          total: requirements.length,
          onChange: handlePageChange,
          showSizeChanger: true,
          showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
          pageSizeOptions: ['10', '20', '50', '100'],
        }}
        dataSource={paginatedData}
        renderItem={(item, index) => (
          <RequirementDetail
            key={item.clause_id}
            item={item}
            index={(currentPage - 1) * pageSize + index}
          />
        )}
      />
    </div>
  )
})

KeyRequirementsList.displayName = 'KeyRequirementsList'
