'use client'

/**
 * 成熟度矩阵结果展示组件
 * 展示 N行 × 5列 的成熟度矩阵表格
 */

import { useState } from 'react'
import { toast } from 'sonner'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Chip from '@mui/material/Chip'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import Stack from '@mui/material/Stack'
import EditIcon from '@mui/icons-material/Edit'
import SaveIcon from '@mui/icons-material/Save'
import CloseIcon from '@mui/icons-material/Close'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
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
  const [editedMatrix, setEditedMatrix] = useState<MatrixRow[]>(
    result.selectedResult?.matrix || []
  )

  const matrixData: MatrixRow[] = editedMatrix
  const modelDescription = result.selectedResult?.maturity_model_description || ''

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
      return <Typography variant="body2" color="text.secondary">暂无数据</Typography>
    }

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Typography variant="subtitle2" fontWeight="bold" sx={{ flex: 1 }}>
            {level.name}
          </Typography>
          {!isEditing && (
            <IconButton size="small" onClick={() => handleEditCell(row.cluster_id, levelKey)}>
              <EditIcon fontSize="small" />
            </IconButton>
          )}
        </Box>

        {isEditing ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <TextField
              value={level.description}
              onChange={(e) =>
                handleUpdateDescription(row.cluster_id, levelKey, e.target.value)
              }
              multiline
              rows={3}
              placeholder="级别描述"
              size="small"
              fullWidth
            />
            <TextField
              value={level.key_practices.join('\n')}
              onChange={(e) =>
                handleUpdatePractices(
                  row.cluster_id,
                  levelKey,
                  e.target.value.split('\n').filter((p) => p.trim())
                )
              }
              multiline
              rows={4}
              placeholder="关键实践（每行一条）"
              size="small"
              fullWidth
            />
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                size="small"
                startIcon={<SaveIcon />}
                onClick={handleSaveCell}
              >
                保存
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<CloseIcon />}
                onClick={handleCancelEdit}
              >
                取消
              </Button>
            </Stack>
          </Box>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary">
              {level.description}
            </Typography>
            <Box>
              <Typography variant="caption" fontWeight="bold" display="block" gutterBottom>
                关键实践：
              </Typography>
              <Box component="ul" sx={{ pl: 2, m: 0 }}>
                {level.key_practices.map((practice, index) => (
                  <Typography component="li" variant="caption" key={index}>
                    {practice}
                  </Typography>
                ))}
              </Box>
            </Box>
          </>
        )}
      </Box>
    )
  }

  const getConfidenceColor = (level: string): 'success' | 'warning' | 'error' => {
    switch (level) {
      case 'HIGH':
        return 'success'
      case 'MEDIUM':
        return 'warning'
      case 'LOW':
        return 'error'
      default:
        return 'warning'
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* 任务ID显示（重要：用于下一步问卷生成） */}
      <Alert severity="success" icon={<CheckCircleIcon />}>
        <Typography variant="subtitle1" fontWeight="bold">
          矩阵生成完成！下一步：生成调研问卷
        </Typography>
        <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">任务ID：</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              component="code"
              sx={{
                bgcolor: 'grey.100',
                px: 2,
                py: 1,
                borderRadius: 1,
                fontFamily: 'monospace',
                flex: 1,
                userSelect: 'all',
              }}
            >
              {result.taskId}
            </Box>
            <Button variant="outlined" size="small" onClick={handleCopyTaskId}>
              复制ID
            </Button>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="contained" fullWidth onClick={handleGenerateQuestionnaire}>
              生成调研问卷
            </Button>
            <Button variant="contained" color="success" onClick={handleExportCSV}>
              导出CSV
            </Button>
          </Box>
        </Box>
      </Alert>

      {/* 元数据信息 */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
        <Card>
          <CardContent>
            <Typography variant="caption" color="text.secondary">任务ID</Typography>
            <Typography variant="body2" fontFamily="monospace" noWrap>
              {result.taskId}
            </Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="caption" color="text.secondary">选中模型</Typography>
            <Box sx={{ mt: 0.5 }}>
              <Chip label={result.selectedModel} color="primary" size="small" />
            </Box>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="caption" color="text.secondary">置信度</Typography>
            <Box sx={{ mt: 0.5 }}>
              <Chip
                label={result.confidenceLevel}
                color={getConfidenceColor(result.confidenceLevel)}
                size="small"
              />
            </Box>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="caption" color="text.secondary">矩阵规模</Typography>
            <Typography variant="body2" fontWeight="bold">
              {matrixData.length} 聚类 × 5 级
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* 质量评分 */}
      {result.qualityScores && (
        <Card>
          <CardHeader title="质量评分" />
          <CardContent>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">结构质量</Typography>
                <Typography variant="h5" fontWeight="bold" color="primary.main">
                  {(result.qualityScores.structural * 100).toFixed(1)}%
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">语义质量</Typography>
                <Typography variant="h5" fontWeight="bold" color="success.main">
                  {(result.qualityScores.semantic * 100).toFixed(1)}%
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">细节质量</Typography>
                <Typography variant="h5" fontWeight="bold" color="secondary.main">
                  {(result.qualityScores.detail * 100).toFixed(1)}%
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* 成熟度模型说明 */}
      {modelDescription && (
        <Card>
          <CardHeader title="成熟度模型说明" />
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              {modelDescription}
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* 成熟度矩阵表格 */}
      <Card>
        <CardHeader title={`成熟度矩阵 (${matrixData.length} 行 × 5 列)`} />
        <CardContent>
          <TableContainer component={Paper} sx={{ maxWidth: '100%', overflowX: 'auto' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ minWidth: 200, fontWeight: 'bold' }}>聚类</TableCell>
                  <TableCell sx={{ minWidth: 300 }}>Level 1 (初始级)</TableCell>
                  <TableCell sx={{ minWidth: 300 }}>Level 2 (可重复级)</TableCell>
                  <TableCell sx={{ minWidth: 300 }}>Level 3 (已定义级)</TableCell>
                  <TableCell sx={{ minWidth: 300 }}>Level 4 (可管理级)</TableCell>
                  <TableCell sx={{ minWidth: 300 }}>Level 5 (优化级)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {matrixData.map((row) => (
                  <TableRow key={row.cluster_id}>
                    <TableCell sx={{ verticalAlign: 'top' }}>
                      <Typography variant="subtitle2" fontWeight="bold">
                        {row.cluster_name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {row.cluster_id}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ verticalAlign: 'top' }}>
                      {renderCellContent(row, 'level_1')}
                    </TableCell>
                    <TableCell sx={{ verticalAlign: 'top' }}>
                      {renderCellContent(row, 'level_2')}
                    </TableCell>
                    <TableCell sx={{ verticalAlign: 'top' }}>
                      {renderCellContent(row, 'level_3')}
                    </TableCell>
                    <TableCell sx={{ verticalAlign: 'top' }}>
                      {renderCellContent(row, 'level_4')}
                    </TableCell>
                    <TableCell sx={{ verticalAlign: 'top' }}>
                      {renderCellContent(row, 'level_5')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  )
}
