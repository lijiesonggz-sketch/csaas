'use client'

/**
 * 综述结果展示组件
 * 展示AI生成的综述内容和审核功能
 */

import { useState } from 'react'
import { toast } from 'sonner'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import ListItemIcon from '@mui/material/ListItemIcon'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import InfoIcon from '@mui/icons-material/Info'
import LinearProgress from '@mui/material/LinearProgress'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import DownloadIcon from '@mui/icons-material/Download'
import type { GenerationResult, SummaryResult } from '@/lib/types/ai-generation'

interface SummaryResultDisplayProps {
  result: GenerationResult
  onReviewComplete?: () => void
}

export default function SummaryResultDisplay({ result, onReviewComplete }: SummaryResultDisplayProps) {
  const summaryResult: SummaryResult = typeof result.selectedResult === 'string'
    ? JSON.parse(result.selectedResult)
    : result.selectedResult as SummaryResult

  const handleApprove = async () => {
    try {
      toast.success('综述已通过审核')
      onReviewComplete?.()
    } catch (error) {
      toast.error('审核操作失败')
    }
  }

  const handleReject = async () => {
    try {
      toast.info('综述已驳回，请重新生成')
      onReviewComplete?.()
    } catch (error) {
      toast.error('审核操作失败')
    }
  }

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
            h1 { color: #1976d2; }
            h2 { color: #262626; margin-top: 30px; border-bottom: 2px solid #1976d2; padding-bottom: 10px; }
            h3 { color: #595959; margin-top: 20px; }
            .key-area { background-color: #f5f5f5; padding: 15px; margin: 10px 0; border-left: 4px solid #1976d2; }
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

      toast.success('综述已导出为Word文件！')
    } catch (error) {
      toast.error('导出失败：' + (error instanceof Error ? error.message : '未知错误'))
    }
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

  const getModelName = (model: string) => {
    switch (model) {
      case 'gpt4':
        return 'GPT-4'
      case 'claude':
        return 'Claude'
      case 'domestic':
        return '通义千问'
      default:
        return model
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* 导出按钮 */}
      <Card>
        <CardContent>
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleExportWord}>
            导出Word
          </Button>
        </CardContent>
      </Card>

      {/* 头部信息卡片 */}
      <Card>
        <CardHeader title="生成信息" />
        <CardContent>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
            <Typography variant="body2"><strong>任务ID:</strong> {result.taskId}</Typography>
            <Typography variant="body2"><strong>生成时间:</strong> {new Date(result.createdAt).toLocaleString('zh-CN')}</Typography>
            <Typography variant="body2"><strong>选中模型:</strong> <Chip size="small" color="primary" label={getModelName(result.selectedModel)} /></Typography>
            <Typography variant="body2"><strong>置信度:</strong> <Chip size="small" color={getConfidenceColor(result.confidenceLevel)} label={result.confidenceLevel} /></Typography>
            <Typography variant="body2"><strong>审核状态:</strong>
              {result.reviewStatus === 'PENDING' && <Chip size="small" color="warning" label="待审核" />}
              {result.reviewStatus === 'APPROVED' && <Chip size="small" color="success" label="已批准" />}
              {result.reviewStatus === 'MODIFIED' && <Chip size="small" color="info" label="已修改" />}
              {result.reviewStatus === 'REJECTED' && <Chip size="small" color="error" label="已拒绝" />}
            </Typography>
            <Typography variant="body2"><strong>版本:</strong> v{result.version}</Typography>
          </Box>
        </CardContent>
      </Card>

      {/* 质量评分卡片 */}
      {result.qualityScores && (
        <Card>
          <CardHeader title="质量评分" />
          <CardContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">结构一致性 (要求 ≥90%)</Typography>
                  <Typography variant="body2" fontWeight="bold">{((result.qualityScores?.structural || 0) * 100).toFixed(1)}%</Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={parseFloat(((result.qualityScores?.structural || 0) * 100).toFixed(1))}
                  color={(result.qualityScores?.structural || 0) >= 0.9 ? 'success' : 'error'}
                />
              </Box>

              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">语义一致性 (要求 ≥80%)</Typography>
                  <Typography variant="body2" fontWeight="bold">{((result.qualityScores?.semantic || 0) * 100).toFixed(1)}%</Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={parseFloat(((result.qualityScores?.semantic || 0) * 100).toFixed(1))}
                  color={(result.qualityScores?.semantic || 0) >= 0.8 ? 'success' : 'error'}
                />
              </Box>

              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">细节一致性 (要求 ≥60%)</Typography>
                  <Typography variant="body2" fontWeight="bold">{((result.qualityScores?.detail || 0) * 100).toFixed(1)}%</Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={parseFloat(((result.qualityScores?.detail || 0) * 100).toFixed(1))}
                  color={(result.qualityScores?.detail || 0) >= 0.6 ? 'success' : 'error'}
                />
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* 综述内容卡片 */}
      <Card>
        <CardHeader
          title={summaryResult.title}
          action={
            result.reviewStatus === 'PENDING' && (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button variant="contained" color="success" startIcon={<CheckCircleIcon />} onClick={handleApprove}>
                  批准
                </Button>
                <Button variant="outlined" color="error" startIcon={<CancelIcon />} onClick={handleReject}>
                  驳回
                </Button>
              </Box>
            )
          }
        />
        <CardContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* 概述 */}
            <Box>
              <Typography variant="h6" gutterBottom color="primary.main">概述</Typography>
              <Typography variant="body1">{summaryResult.overview}</Typography>
            </Box>

            <Divider />

            {/* 关键领域 */}
            <Box>
              <Typography variant="h6" gutterBottom color="primary.main">关键领域</Typography>
              {summaryResult.key_areas.map((area, index) => (
                <Card key={index} variant="outlined" sx={{ mb: 2, bgcolor: 'grey.50' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Typography variant="subtitle1" fontWeight="bold">{area.name}</Typography>
                      <Chip
                        size="small"
                        color={area.importance === 'HIGH' ? 'error' : area.importance === 'MEDIUM' ? 'warning' : 'info'}
                        label={area.importance === 'HIGH' ? '高' : area.importance === 'MEDIUM' ? '中' : '低'}
                      />
                    </Box>
                    <Typography variant="body2" color="text.secondary">{area.description}</Typography>
                  </CardContent>
                </Card>
              ))}
            </Box>

            <Divider />

            {/* 适用范围 */}
            <Box>
              <Typography variant="h6" gutterBottom color="primary.main">适用范围</Typography>
              <Typography variant="body1">{summaryResult.scope}</Typography>
            </Box>

            <Divider />

            {/* 关键要求 */}
            <Box>
              <Typography variant="h6" gutterBottom color="primary.main">关键要求</Typography>
              <List>
                {summaryResult.key_requirements.map((req, index) => (
                  <ListItem key={index} sx={{ py: 0.5 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <CheckCircleIcon color="success" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary={req} />
                  </ListItem>
                ))}
              </List>
            </Box>

            <Divider />

            {/* 合规级别 */}
            <Box>
              <Typography variant="h6" gutterBottom color="primary.main">合规级别说明</Typography>
              <Typography variant="body1">{summaryResult.compliance_level}</Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}
