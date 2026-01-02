'use client'

/**
 * 缺失条款处理组件
 * 用于显示和分配缺失的条款到聚类
 */

import { useState } from 'react'
import { Card, Select, Button, Modal, Form, Input, Space, Alert, Tag, Divider } from 'antd'
import { PlusOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons'

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

interface DocumentCoverage {
  total_clauses: number
  clustered_clauses: number
  missing_clause_ids: string[]
}

interface MissingClauseInfo {
  clauseId: string
  documentId: string
  documentName: string
  clauseText: string
}

interface Props {
  taskId: string // 任务ID，用于保存到后端
  coverageByDocument: Record<string, DocumentCoverage>
  documents: Array<{ id: string; name: string; content: string }>
  categories: Category[]
  onUpdateClustering: (updatedCategories: Category[]) => void
}

export default function MissingClausesHandler({
  taskId,
  coverageByDocument,
  documents,
  categories,
  onUpdateClustering,
}: Props) {
  const [assignModalVisible, setAssignModalVisible] = useState(false)
  const [newClusterModalVisible, setNewClusterModalVisible] = useState(false)
  const [selectedMissingClause, setSelectedMissingClause] = useState<MissingClauseInfo | null>(null)
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null)
  const [assignments, setAssignments] = useState<Record<string, string>>({}) // clauseId -> clusterId
  const [saving, setSaving] = useState(false) // 保存到后端的状态
  const [saveError, setSaveError] = useState<string | null>(null) // 保存错误
  const [form] = Form.useForm()

  // 提取所有缺失条款信息
  const extractMissingClauses = (): MissingClauseInfo[] => {
    const missingClauses: MissingClauseInfo[] = []

    // 遍历每个文档
    documents.forEach((doc) => {
      // 从文档内容中提取所有条款ID
      const allClauseMatches = doc.content.match(/第[一二三四五六七八九十百千]+条/g) || []
      const allClauseIds = [...new Set(allClauseMatches)] // 去重

      // 从categories中提取该文档已聚类的条款ID
      const clusteredClauseIds = new Set<string>()
      categories.forEach((category) => {
        category.clusters.forEach((cluster) => {
          cluster.clauses.forEach((clause) => {
            if (clause.source_document_id === doc.id) {
              clusteredClauseIds.add(clause.clause_id)
            }
          })
        })
      })

      // 找出缺失的条款
      const missingIds = allClauseIds.filter((id) => !clusteredClauseIds.has(id))

      if (missingIds.length > 0) {
        missingIds.forEach((clauseId) => {
          // 从文档内容中提取条款文本（修复：从条款标题提取到下一个条款标题之前）
          const regex = new RegExp(`${clauseId}([\\s\\S]*?)(?=第[一二三四五六七八九十百千]+条|$)`, 'i')
          const match = doc.content.match(regex)
          let clauseText = '条款内容未找到'

          if (match) {
            // 提取内容并截断到合理长度（最多300字）
            clauseText = match[1].trim().substring(0, 300)
            // 如果截断了，添加省略号
            if (match[1].trim().length > 300) {
              clauseText += '...'
            }
          }

          missingClauses.push({
            clauseId,
            documentId: doc.id,
            documentName: doc.name,
            clauseText,
          })
        })
      }
    })

    return missingClauses
  }

  const missingClauses = extractMissingClauses()

  // 检查是否有覆盖率不完整的情况
  const hasIncompleteCoverage = Object.values(coverageByDocument).some(
    (stats) => (stats.missing_clause_ids?.length || 0) > 0 || stats.clustered_clauses < stats.total_clauses
  )
  const getClusterOptions = () => {
    return categories.flatMap((category) => ({
      category,
      clusters: category.clusters,
    }))
  }

  // 处理分配到现有聚类
  const handleAssignToCluster = (missingClause: MissingClauseInfo) => {
    setSelectedMissingClause(missingClause)
    setAssignModalVisible(true)
  }

  // 确认分配
  const confirmAssign = () => {
    if (!selectedMissingClause || !selectedClusterId) return

    // 更新分配记录
    setAssignments({
      ...assignments,
      [selectedMissingClause.clauseId]: selectedClusterId,
    })

    setAssignModalVisible(false)
    setSelectedMissingClause(null)
    setSelectedClusterId(null)
  }

  // 处理新建聚类
  const handleCreateNewCluster = (missingClause: MissingClauseInfo) => {
    setSelectedMissingClause(missingClause)
    setNewClusterModalVisible(true)
  }

  // 确认新建聚类
  const confirmCreateCluster = async () => {
    if (!selectedMissingClause) return

    try {
      const values = await form.validateFields()

      // 找到第一个大类，或者让用户选择
      const targetCategory = categories[0]

      // 创建新聚类
      const newCluster: Cluster = {
        id: `cluster_${Date.now()}`,
        name: values.clusterName,
        description: values.clusterDescription || '用户手动创建的聚类',
        clauses: [
          {
            source_document_id: selectedMissingClause.documentId,
            source_document_name: selectedMissingClause.documentName,
            clause_id: selectedMissingClause.clauseId,
            clause_text: selectedMissingClause.clauseText,
            rationale: values.rationale || '用户手动添加的缺失条款',
          },
        ],
        importance: values.importance || 'MEDIUM',
        risk_level: values.riskLevel || 'MEDIUM',
      }

      // 更新categories
      const updatedCategories = categories.map((cat) => {
        if (cat.id === targetCategory.id) {
          return {
            ...cat,
            clusters: [...cat.clusters, newCluster],
          }
        }
        return cat
      })

      // 移除已处理的缺失条款
      setAssignments({
        ...assignments,
        [selectedMissingClause.clauseId]: newCluster.id,
      })

      // 通知父组件更新
      onUpdateClustering(updatedCategories)

      setNewClusterModalVisible(false)
      form.resetFields()
      setSelectedMissingClause(null)
    } catch (error) {
      console.error('Failed to create cluster:', error)
    }
  }

  // 批量应用所有分配并保存到后端
  const handleApplyAllAssignments = async () => {
    setSaving(true)
    setSaveError(null)

    try {
      // 1. 构建更新后的categories
      const updatedCategories = categories.map((category) => ({
        ...category,
        clusters: category.clusters.map((cluster) => {
          // 找到应该分配到这个聚类的缺失条款
          const newClauses = Object.entries(assignments)
            .filter(([_, clusterId]) => clusterId === cluster.id)
            .map(([clauseId, _]) => {
              const missingClause = missingClauses.find((mc) => mc.clauseId === clauseId)
              if (!missingClause) return null

              return {
                source_document_id: missingClause.documentId,
                source_document_name: missingClause.documentName,
                clause_id: missingClause.clauseId,
                clause_text: missingClause.clauseText,
                rationale: '用户手动添加的缺失条款',
              }
            })
            .filter(Boolean) as ClusterClause[]

          return {
            ...cluster,
            clauses: [...cluster.clauses, ...newClauses],
          }
        }),
      }))

      // 2. 保存到后端
      const response = await fetch(`/api/ai-generation/clustering/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          categories: updatedCategories,
        }),
      })

      if (!response.ok) {
        throw new Error(`保存失败: ${response.statusText}`)
      }

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || '保存失败')
      }

      // 3. 更新前端状态
      onUpdateClustering(updatedCategories)
      setAssignments({})

      // 4. 显示成功消息
      alert('✅ 聚类结果已保存到数据库！')
    } catch (error: any) {
      console.error('保存聚类结果失败:', error)
      setSaveError(error.message || '保存失败，请重试')
      alert(`❌ 保存失败: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  if (missingClauses.length === 0) {
    // 没有明确的缺失条款，但检查覆盖率是否完整
    if (hasIncompleteCoverage) {
      const incompleteDocs = Object.entries(coverageByDocument)
        .filter(([_, stats]) => stats.clustered_clauses < stats.total_clauses)
        .map(([docId, stats]) => {
          const doc = documents.find((d) => d.id === docId)
          return `${doc?.name || docId} (${stats.clustered_clauses}/${stats.total_clauses})`
        })

      return (
        <Alert
          message="ℹ️ 覆盖率统计信息"
          description={
            <div>
              <p>以下文档的覆盖率统计显示可能存在差异：</p>
              <ul className="list-disc ml-5 mt-2">
                {incompleteDocs.map((doc, idx) => (
                  <li key={idx}>{doc}</li>
                ))}
              </ul>
              <p className="mt-2 text-sm text-gray-600">
                注意：文档中所有"第XX条"格式的条款都已被聚类。差异可能来自统计方法或非标准格式的条款。
              </p>
            </div>
          }
          type="info"
          showIcon
        />
      )
    }

    return (
      <Alert
        message="✅ 所有条款已完整覆盖"
        description="没有缺失的条款需要处理"
        type="success"
        showIcon
        icon={<CheckCircleOutlined />}
      />
    )
  }

  return (
    <div className="space-y-4">
      <Alert
        message="⚠️ 发现缺失条款"
        description={`共发现 ${missingClauses.length} 个缺失条款，您可以手动将其分配到现有聚类或新建聚类`}
        type="warning"
        showIcon
        icon={<ExclamationCircleOutlined />}
      />

      <Card title="缺失条款列表" size="small">
        <div className="space-y-4">
          {missingClauses.map((missingClause, index) => {
            const isAssigned = assignments[missingClause.clauseId]

            return (
              <Card
                key={missingClause.clauseId}
                size="small"
                type="inner"
                className={isAssigned ? 'border-green-400 bg-green-50' : ''}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <Space>
                      <Tag color="blue">{missingClause.documentName}</Tag>
                      <span className="font-mono font-semibold">{missingClause.clauseId}</span>
                      {isAssigned && (
                        <Tag color="green" icon={<CheckCircleOutlined />}>
                          已分配
                        </Tag>
                      )}
                    </Space>
                  </div>

                  <p className="text-sm text-gray-700">{missingClause.clauseText}</p>

                  {!isAssigned && (
                    <div className="flex gap-2">
                      <Button
                        size="small"
                        type="primary"
                        onClick={() => handleAssignToCluster(missingClause)}
                      >
                        分配到现有聚类
                      </Button>
                      <Button
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={() => handleCreateNewCluster(missingClause)}
                      >
                        新建聚类
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            )
          })}
        </div>

        {Object.keys(assignments).length > 0 && (
          <>
            <Divider />
            <div className="flex justify-end">
              <Button type="primary" size="large" onClick={handleApplyAllAssignments}>
                应用所有分配 ({Object.keys(assignments).length})
              </Button>
            </div>
          </>
        )}
      </Card>

      {/* 分配到现有聚类的对话框 */}
      <Modal
        title={`分配条款到聚类: ${selectedMissingClause?.clauseId}`}
        open={assignModalVisible}
        onOk={confirmAssign}
        onCancel={() => {
          setAssignModalVisible(false)
          setSelectedMissingClause(null)
          setSelectedClusterId(null)
        }}
        width={800}
      >
        <div className="space-y-4">
          {selectedMissingClause && (
            <>
              <Alert
                message="条款内容"
                description={selectedMissingClause.clauseText}
                type="info"
              />

              <div>
                <label className="block text-sm font-medium mb-2">选择目标聚类：</label>
                <Select
                  placeholder="请选择聚类"
                  size="large"
                  className="w-full"
                  value={selectedClusterId}
                  onChange={setSelectedClusterId}
                  showSearch
                  optionFilterProp="label"
                >
                  {getClusterOptions().map(({ category, clusters }) => (
                    <Select.OptGroup key={category.id} label={category.name}>
                      {clusters.map((cluster) => (
                        <Select.Option
                          key={cluster.id}
                          value={cluster.id}
                          label={`${category.name} / ${cluster.name}`}
                        >
                          {cluster.name} ({cluster.clauses.length}个条款)
                        </Select.Option>
                      ))}
                    </Select.OptGroup>
                  ))}
                </Select>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* 新建聚类的对话框 */}
      <Modal
        title={`新建聚类: ${selectedMissingClause?.clauseId}`}
        open={newClusterModalVisible}
        onOk={confirmCreateCluster}
        onCancel={() => {
          setNewClusterModalVisible(false)
          form.resetFields()
          setSelectedMissingClause(null)
        }}
        width={700}
      >
        {selectedMissingClause && (
          <Form form={form} layout="vertical">
            <Alert
              message="条款内容"
              description={selectedMissingClause.clauseText}
              type="info"
              className="mb-4"
            />

            <Form.Item
              label="聚类名称"
              name="clusterName"
              rules={[{ required: true, message: '请输入聚类名称' }]}
            >
              <Input placeholder="例如：访问控制管理" />
            </Form.Item>

            <Form.Item label="聚类描述" name="clusterDescription">
              <Input.TextArea
                rows={3}
                placeholder="描述该聚类的作用和范围（可选）"
              />
            </Form.Item>

            <Form.Item label="归类理由" name="rationale">
              <Input.TextArea
                rows={2}
                placeholder="说明为什么将这些条款归入此聚类（可选）"
              />
            </Form.Item>

            <Form.Item label="重要性" name="importance" initialValue="MEDIUM">
              <Select>
                <Select.Option value="HIGH">高</Select.Option>
                <Select.Option value="MEDIUM">中</Select.Option>
                <Select.Option value="LOW">低</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item label="风险级别" name="riskLevel" initialValue="MEDIUM">
              <Select>
                <Select.Option value="HIGH">高</Select.Option>
                <Select.Option value="MEDIUM">中</Select.Option>
                <Select.Option value="LOW">低</Select.Option>
              </Select>
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  )
}
