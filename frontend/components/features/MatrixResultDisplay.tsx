'use client'

/**
 * 成熟度矩阵结果展示组件
 * 展示 N行 × 5列 的成熟度矩阵表格
 */

import { useState } from 'react'
import { Card, Table, Tag, Collapse, Button, Modal, Input, message, Alert } from 'antd'
import { EditOutlined, SaveOutlined, CloseOutlined, CheckCircleOutlined } from '@ant-design/icons'
import type { GenerationResult } from '@/lib/types/ai-generation'

const { Panel } = Collapse
const { TextArea } = Input

interface MatrixRow {
  cluster_id: string
  cluster_name: string
  levels: {
    level_1: MaturityLevel
    level_2: MaturityLevel
    level_3: MaturityLevel
    level_4: MaturityLevel
    level_5: MaturityLevel
  }
}

interface MaturityLevel {
  name: string
  description: string
  key_practices: string[]
}

interface MatrixResultDisplayProps {
  result: GenerationResult
}

export default function MatrixResultDisplay({ result }: MatrixResultDisplayProps) {
  const [editingCell, setEditingCell] = useState<{ rowId: string; levelKey: string } | null>(null)
  const [editedMatrix, setEditedMatrix] = useState<MatrixRow[]>(
    result.selectedResult?.matrix || []
  )

  const matrixData: MatrixRow[] = editedMatrix
  const modelDescription = result.selectedResult?.maturity_model_description || ''

  // 复制任务ID到剪贴板
  const handleCopyTaskId = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(result.taskId)
      alert('任务ID已复制到剪贴板！')
    }
  }

  // 导出成熟度矩阵为CSV
  const handleExportCSV = () => {
    try {
      const csvRows: string[] = []

      // CSV Header
      csvRows.push('Cluster ID,Cluster Name,Level,Level Name,Description,Key Practices')

      // 遍历矩阵数据
      matrixData.forEach((row) => {
        // 遍历5个级别
        ;['level_1', 'level_2', 'level_3', 'level_4', 'level_5'].forEach((levelKey, index) => {
          const level = row.levels[levelKey as keyof typeof row.levels]
          if (level) {
            const practices = level.key_practices.join('; ')
            const csvRow = [
              row.cluster_id,
              row.cluster_name,
              `Level ${index + 1}`,
              level.name,
              `"${level.description.replace(/"/g, '""')}"`,
              `"${practices.replace(/"/g, '""')}"`,
            ]
            csvRows.push(csvRow.join(','))
          }
        })
      })

      // 创建下载
      const csvContent = csvRows.join('\n')
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `maturity_matrix_${result.taskId}.csv`
      link.click()
      URL.revokeObjectURL(url)

      alert('成熟度矩阵已导出为CSV文件！')
    } catch (error) {
      alert('导出失败：' + (error instanceof Error ? error.message : '未知错误'))
    }
  }

  // 跳转到问卷生成页面
  const handleGenerateQuestionnaire = () => {
    window.location.href = `/ai-generation/questionnaire?taskId=${result.taskId}`
  }

  // 编辑单元格
  const handleEditCell = (rowId: string, levelKey: string) => {
    setEditingCell({ rowId, levelKey })
  }

  // 保存单元格编辑
  const handleSaveCell = () => {
    setEditingCell(null)
    message.success('编辑已保存（本地）')
  }

  // 取消编辑
  const handleCancelEdit = () => {
    // 恢复原始数据
    setEditedMatrix(result.selectedResult?.matrix || [])
    setEditingCell(null)
  }

  // 更新描述
  const handleUpdateDescription = (rowId: string, levelKey: string, newDescription: string) => {
    setEditedMatrix((prevMatrix) =>
      prevMatrix.map((row) => {
        if (row.cluster_id === rowId) {
          return {
            ...row,
            levels: {
              ...row.levels,
              [levelKey]: {
                ...row.levels[levelKey as keyof typeof row.levels],
                description: newDescription,
              },
            },
          }
        }
        return row
      })
    )
  }

  // 更新关键实践
  const handleUpdatePractices = (
    rowId: string,
    levelKey: string,
    newPractices: string[]
  ) => {
    setEditedMatrix((prevMatrix) =>
      prevMatrix.map((row) => {
        if (row.cluster_id === rowId) {
          return {
            ...row,
            levels: {
              ...row.levels,
              [levelKey]: {
                ...row.levels[levelKey as keyof typeof row.levels],
                key_practices: newPractices,
              },
            },
          }
        }
        return row
      })
    )
  }

  // 渲染单元格内容
  const renderCellContent = (row: MatrixRow, levelKey: string) => {
    const level = row.levels[levelKey as keyof typeof row.levels]
    const isEditing =
      editingCell?.rowId === row.cluster_id && editingCell?.levelKey === levelKey

    if (!level) {
      return <div className="text-gray-400 text-sm">暂无数据</div>
    }

    return (
      <div className="space-y-2">
        <div className="flex justify-between items-start">
          <div className="font-semibold text-gray-700 flex-1">{level.name}</div>
          {!isEditing && (
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEditCell(row.cluster_id, levelKey)}
            />
          )}
        </div>

        {isEditing ? (
          <div className="space-y-2">
            <TextArea
              value={level.description}
              onChange={(e) =>
                handleUpdateDescription(row.cluster_id, levelKey, e.target.value)
              }
              rows={3}
              placeholder="级别描述"
            />
            <TextArea
              value={level.key_practices.join('\n')}
              onChange={(e) =>
                handleUpdatePractices(
                  row.cluster_id,
                  levelKey,
                  e.target.value.split('\n').filter((p) => p.trim())
                )
              }
              rows={4}
              placeholder="关键实践（每行一条）"
            />
            <div className="flex gap-2">
              <Button
                type="primary"
                size="small"
                icon={<SaveOutlined />}
                onClick={handleSaveCell}
              >
                保存
              </Button>
              <Button
                size="small"
                icon={<CloseOutlined />}
                onClick={handleCancelEdit}
              >
                取消
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-600">{level.description}</p>
            <div className="text-xs text-gray-500 space-y-1">
              <div className="font-medium">关键实践：</div>
              <ul className="list-disc list-inside pl-2">
                {level.key_practices.map((practice, index) => (
                  <li key={index}>{practice}</li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    )
  }

  // 表格列定义
  const columns = [
    {
      title: '聚类',
      dataIndex: 'cluster_name',
      key: 'cluster_name',
      width: 200,
      fixed: 'left' as const,
      render: (text: string, record: MatrixRow) => (
        <div>
          <div className="font-semibold text-gray-800">{text}</div>
          <div className="text-xs text-gray-500 mt-1">{record.cluster_id}</div>
        </div>
      ),
    },
    {
      title: 'Level 1 (初始级)',
      key: 'level_1',
      width: 300,
      render: (_: any, record: MatrixRow) => renderCellContent(record, 'level_1'),
    },
    {
      title: 'Level 2 (可重复级)',
      key: 'level_2',
      width: 300,
      render: (_: any, record: MatrixRow) => renderCellContent(record, 'level_2'),
    },
    {
      title: 'Level 3 (已定义级)',
      key: 'level_3',
      width: 300,
      render: (_: any, record: MatrixRow) => renderCellContent(record, 'level_3'),
    },
    {
      title: 'Level 4 (可管理级)',
      key: 'level_4',
      width: 300,
      render: (_: any, record: MatrixRow) => renderCellContent(record, 'level_4'),
    },
    {
      title: 'Level 5 (优化级)',
      key: 'level_5',
      width: 300,
      render: (_: any, record: MatrixRow) => renderCellContent(record, 'level_5'),
    },
  ]

  return (
    <div className="space-y-6">
      {/* 任务ID显示（重要：用于下一步问卷生成） */}
      <Alert
        message={
          <div>
            <strong>✅ 矩阵生成完成！下一步：生成调研问卷</strong>
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
                onClick={handleGenerateQuestionnaire}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
              >
                🎯 生成调研问卷
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

      {/* 元数据信息 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card size="small">
          <div className="text-xs text-gray-500">任务ID</div>
          <div className="text-sm font-mono truncate">{result.taskId}</div>
        </Card>
        <Card size="small">
          <div className="text-xs text-gray-500">选中模型</div>
          <div className="text-sm font-semibold">
            <Tag color="blue">{result.selectedModel}</Tag>
          </div>
        </Card>
        <Card size="small">
          <div className="text-xs text-gray-500">置信度</div>
          <div className="text-sm">
            <Tag
              color={
                result.confidenceLevel === 'HIGH'
                  ? 'green'
                  : result.confidenceLevel === 'MEDIUM'
                    ? 'orange'
                    : 'red'
              }
            >
              {result.confidenceLevel}
            </Tag>
          </div>
        </Card>
        <Card size="small">
          <div className="text-xs text-gray-500">矩阵规模</div>
          <div className="text-sm font-semibold">
            {matrixData.length} 聚类 × 5 级
          </div>
        </Card>
      </div>

      {/* 质量评分 */}
      {result.qualityScores && (
        <Card title="质量评分" size="small">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-gray-500">结构质量</div>
              <div className="text-xl font-bold text-blue-600">
                {(result.qualityScores.structural * 100).toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">语义质量</div>
              <div className="text-xl font-bold text-green-600">
                {(result.qualityScores.semantic * 100).toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">细节质量</div>
              <div className="text-xl font-bold text-purple-600">
                {(result.qualityScores.detail * 100).toFixed(1)}%
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* 成熟度模型说明 */}
      {modelDescription && (
        <Card title="成熟度模型说明" size="small">
          <p className="text-sm text-gray-700">{modelDescription}</p>
        </Card>
      )}

      {/* 成熟度矩阵表格 */}
      <Card title={`成熟度矩阵 (${matrixData.length} 行 × 5 列)`}>
        <div className="overflow-x-auto">
          <Table
            columns={columns}
            dataSource={matrixData}
            rowKey="cluster_id"
            pagination={false}
            scroll={{ x: 1800 }}
            size="small"
            bordered
          />
        </div>
      </Card>
    </div>
  )
}
