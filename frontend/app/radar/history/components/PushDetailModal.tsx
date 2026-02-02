'use client'

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  Divider,
  IconButton,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import dayjs from 'dayjs'
import { PushHistoryItem } from '@/lib/api/radar'

interface PushDetailModalProps {
  open: boolean
  push: PushHistoryItem | null
  onClose: () => void
  onMarkAsRead?: (pushId: string) => void
}

/**
 * 推送详情弹窗组件
 *
 * Story 5.4 - AC 6: 推送详情查看
 * HIGH-2 修复: 实现推送详情弹窗
 */
export default function PushDetailModal({
  open,
  push,
  onClose,
  onMarkAsRead,
}: PushDetailModalProps) {
  if (!push) return null

  const handleMarkAsRead = () => {
    if (onMarkAsRead && !push.isRead) {
      onMarkAsRead(push.id)
    }
  }

  const getRadarTypeLabel = (type: string) => {
    switch (type) {
      case 'tech':
        return '技术雷达'
      case 'industry':
        return '行业雷达'
      case 'compliance':
        return '合规雷达'
      default:
        return type
    }
  }

  const getRadarTypeColor = (type: string) => {
    switch (type) {
      case 'tech':
        return 'primary'
      case 'industry':
        return 'success'
      case 'compliance':
        return 'warning'
      default:
        return 'default'
    }
  }

  const getRelevanceLabel = (level: string) => {
    switch (level) {
      case 'high':
        return '高相关'
      case 'medium':
        return '中相关'
      case 'low':
        return '低相关'
      default:
        return level
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">{push.title}</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {/* 基础信息 */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
            <Chip
              label={getRadarTypeLabel(push.radarType)}
              color={getRadarTypeColor(push.radarType) as any}
              size="small"
            />
            <Chip label={getRelevanceLabel(push.relevanceLevel)} size="small" variant="outlined" />
            {push.isRead && <Chip label="已读" size="small" color="default" />}
          </Box>
          <Typography variant="body2" color="text.secondary">
            推送时间: {dayjs(push.sentAt).format('YYYY-MM-DD HH:mm:ss')}
          </Typography>
          {push.readAt && (
            <Typography variant="body2" color="text.secondary">
              阅读时间: {dayjs(push.readAt).format('YYYY-MM-DD HH:mm:ss')}
            </Typography>
          )}
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* 摘要 */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            摘要
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {push.summary}
          </Typography>
        </Box>

        {/* 信息来源 */}
        {push.sourceName && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              信息来源
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {push.sourceName}
            </Typography>
            {push.sourceUrl && (
              <Typography variant="body2">
                <a href={push.sourceUrl} target="_blank" rel="noopener noreferrer">
                  查看原文
                </a>
              </Typography>
            )}
          </Box>
        )}

        {/* 关联薄弱项 */}
        {push.weaknessCategories && push.weaknessCategories.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              关联薄弱项
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {push.weaknessCategories.map((category, index) => (
                <Chip key={index} label={category} size="small" />
              ))}
            </Box>
          </Box>
        )}

        {/* 技术雷达特有: ROI 分析 */}
        {push.radarType === 'tech' && push.roiScore !== undefined && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              ROI 分析
            </Typography>
            <Typography variant="body2" color="text.secondary">
              ROI 评分: {(push.roiScore * 100).toFixed(0)}%
            </Typography>
          </Box>
        )}

        {/* 行业雷达特有: 同业机构信息 */}
        {push.radarType === 'industry' && push.matchedPeers && push.matchedPeers.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              关注的同业机构
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {push.matchedPeers.map((peer, index) => (
                <Chip key={index} label={peer} size="small" color="success" />
              ))}
            </Box>
          </Box>
        )}

        {/* 合规雷达特有: 风险级别 */}
        {push.radarType === 'compliance' && push.riskLevel && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              风险级别
            </Typography>
            <Chip
              label={push.riskLevel === 'high' ? '高风险' : push.riskLevel === 'medium' ? '中风险' : '低风险'}
              color={push.riskLevel === 'high' ? 'error' : push.riskLevel === 'medium' ? 'warning' : 'success'}
              size="small"
            />
          </Box>
        )}

        {/* 相关性评分 */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            相关性评分
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {(push.relevanceScore * 100).toFixed(0)}% - {getRelevanceLabel(push.relevanceLevel)}
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions>
        {!push.isRead && (
          <Button onClick={handleMarkAsRead} color="primary">
            标记为已读
          </Button>
        )}
        <Button onClick={onClose}>关闭</Button>
      </DialogActions>
    </Dialog>
  )
}
