'use client'

/**
 * 成熟度矩阵结果展示组件
 * 展示 N行 × 5列 的成熟度矩阵表格
 */

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CheckCircle, Edit, Save, X, PieChart } from 'lucide-react'
import type { GenerationResult } from '@/lib/types/ai-generation'

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
  const [editedMatrix, setEditedMatrix] = useState<MatrixRow[]>(result.selectedResult?.matrix || [])

  const matrixData: MatrixRow[] = editedMatrix
  const modelDescription = result.selectedResult?.maturity_model_description || ''
  const isOriginalMaturityModel =
    result.selectedResult?.generation_mode === 'original_maturity_model'
  const extractionSummary = result.selectedResult?.extraction_summary

  // 复制任务ID到剪贴板
  const handleCopyTaskId = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(result.taskId)
      toast.success('任务ID已复制到剪贴板！')
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

      toast.success('成熟度矩阵已导出为CSV文件！')
    } catch (error) {
      toast.error('导出失败：' + (error instanceof Error ? error.message : '未知错误'))
    }
  }

  // 跳转到问卷生成页面
  const handleGenerateQuestionnaire = () => {
    // 跳转到项目工作台的问卷生成页面，传递 matrixTaskId 和 projectId
    if (result.projectId) {
      window.location.href = `/projects/${result.projectId}/questionnaire?matrixTaskId=${result.taskId}`
    } else {
      // 兼容旧数据：如果没有 projectId，跳转到独立页面
      window.location.href = `/ai-generation/questionnaire?taskId=${result.taskId}`
    }
  }

  // 编辑单元格
  const handleEditCell = (rowId: string, levelKey: string) => {
    setEditingCell({ rowId, levelKey })
  }

  // 保存单元格编辑
  const handleSaveCell = () => {
    setEditingCell(null)
    toast.success('编辑已保存（本地）')
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
  const handleUpdatePractices = (rowId: string, levelKey: string, newPractices: string[]) => {
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
    const isEditing = editingCell?.rowId === row.cluster_id && editingCell?.levelKey === levelKey

    if (!level) {
      return <p className="text-sm text-gray-600 dark:text-gray-400">暂无数据</p>
    }

    return (
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-start">
          <p className="text-sm font-semibold flex-1">{level.name}</p>
          {!isEditing && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleEditCell(row.cluster_id, levelKey)}
            >
              <Edit className="w-4 h-4" />
            </Button>
          )}
        </div>

        {isEditing ? (
          <div className="flex flex-col gap-2">
            <div className="space-y-2">
              <Label htmlFor="description">级别描述</Label>
              <Input
                id="description"
                value={level.description}
                onChange={(e) => handleUpdateDescription(row.cluster_id, levelKey, e.target.value)}
                placeholder="级别描述"
                className="min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="practices">关键实践（每行一条）</Label>
              <Input
                id="practices"
                value={level.key_practices.join('\n')}
                onChange={(e) =>
                  handleUpdatePractices(
                    row.cluster_id,
                    levelKey,
                    e.target.value.split('\n').filter((p) => p.trim())
                  )
                }
                placeholder="关键实践（每行一条）"
                className="min-h-[100px]"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveCell}>
                <Save className="w-4 h-4 mr-2" />
                保存
              </Button>
              <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                <X className="w-4 h-4 mr-2" />
                取消
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-400">{level.description}</p>
            <div>
              <p className="text-xs font-semibold mb-1">关键实践：</p>
              <ul className="pl-4 m-0 space-y-1">
                {level.key_practices.map((practice, index) => (
                  <li key={index} className="text-xs text-gray-600 dark:text-gray-400">
                    {practice}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    )
  }

  const getConfidenceColor = (level: string) => {
    switch (level) {
      case 'HIGH':
        return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200'
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200'
      case 'LOW':
        return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  return (
    <div className="space-y-6">
      {/* 任务ID显示（重要：用于下一步问卷生成） */}
      <Alert className="bg-green-50 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
        <CheckCircle className="w-5 h-5" />
        <AlertDescription>
          <p className="font-semibold mb-3">
            {isOriginalMaturityModel
              ? '成熟度模型提取完成！下一步：生成调研问卷'
              : '矩阵生成完成！下一步：生成调研问卷'}
          </p>
          <div className="flex flex-col gap-3">
            <p className="text-sm text-gray-700 dark:text-gray-300">任务ID：</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-sm text-sm font-mono">
                {result.taskId}
              </code>
              <Button size="sm" variant="outline" onClick={handleCopyTaskId}>
                复制ID
              </Button>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleGenerateQuestionnaire}>
                生成调研问卷
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={handleExportCSV}
              >
                导出CSV
              </Button>
            </div>
          </div>
        </AlertDescription>
      </Alert>

      {isOriginalMaturityModel && (
        <Alert className="bg-blue-50 text-blue-900 border-blue-200 dark:bg-blue-950/30 dark:text-blue-200 dark:border-blue-800">
          <PieChart className="w-5 h-5" />
          <AlertDescription>
            <p className="font-semibold mb-1">已按原始标准成熟度模型提取</p>
            <p className="text-sm">
              系统检测到原标准内置成熟度等级，已按原文提取
              {extractionSummary?.row_count ?? matrixData.length}
              行成熟度模型，未调用AI重新生成等级定义。
            </p>
            {typeof extractionSummary?.skipped_process_description_clusters === 'number' && (
              <p className="mt-1 text-xs text-blue-800 dark:text-blue-300">
                已跳过 {extractionSummary.skipped_process_description_clusters} 个过程描述条目，
                仅保留等级标准进入后续问卷和差距分析。
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* 元数据信息 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-gray-600 dark:text-gray-400">任务ID</p>
            <p className="text-sm font-mono truncate">{result.taskId}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {isOriginalMaturityModel ? '生成方式' : '选中模型'}
            </p>
            <div className="mt-1">
              <Badge variant="outline">
                {isOriginalMaturityModel ? '原文提取' : result.selectedModel}
              </Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-gray-600 dark:text-gray-400">置信度</p>
            <div className="mt-1">
              <Badge className={getConfidenceColor(result.confidenceLevel)} variant="outline">
                {result.confidenceLevel}
              </Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-gray-600 dark:text-gray-400">矩阵规模</p>
            <p className="text-sm font-semibold">{matrixData.length} 聚类 × 5 级</p>
          </CardContent>
        </Card>
      </div>

      {/* 质量评分 */}
      {result.qualityScores && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">质量评分</h3>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">结构质量</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {(result.qualityScores.structural * 100).toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">语义质量</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {(result.qualityScores.semantic * 100).toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">细节质量</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {(result.qualityScores.detail * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 成熟度模型说明 */}
      {modelDescription && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">成熟度模型说明</h3>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 dark:text-gray-400">{modelDescription}</p>
          </CardContent>
        </Card>
      )}

      {/* 成熟度矩阵表格 */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">成熟度矩阵 ({matrixData.length} 行 × 5 列)</h3>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px] font-semibold">聚类</TableHead>
                  <TableHead className="min-w-[300px]">Level 1 (初始级)</TableHead>
                  <TableHead className="min-w-[300px]">Level 2 (可重复级)</TableHead>
                  <TableHead className="min-w-[300px]">Level 3 (已定义级)</TableHead>
                  <TableHead className="min-w-[300px]">Level 4 (可管理级)</TableHead>
                  <TableHead className="min-w-[300px]">Level 5 (优化级)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matrixData.map((row) => (
                  <TableRow key={row.cluster_id}>
                    <TableCell className="align-top">
                      <p className="text-sm font-semibold">{row.cluster_name}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">{row.cluster_id}</p>
                    </TableCell>
                    <TableCell className="align-top">{renderCellContent(row, 'level_1')}</TableCell>
                    <TableCell className="align-top">{renderCellContent(row, 'level_2')}</TableCell>
                    <TableCell className="align-top">{renderCellContent(row, 'level_3')}</TableCell>
                    <TableCell className="align-top">{renderCellContent(row, 'level_4')}</TableCell>
                    <TableCell className="align-top">{renderCellContent(row, 'level_5')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
