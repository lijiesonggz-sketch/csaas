'use client'

import React from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Chip,
  Button,
  Grid,
  Avatar,
  IconButton,
  Divider,
} from '@mui/material'
import {
  Close,
  Bookmark,
  BookmarkBorder,
  CheckCircle,
  Business,
  AttachMoney,
  Schedule,
  EmojiEvents,
  Lightbulb,
  Link as LinkIcon,
  CalendarToday,
  TrendingUp,
} from '@mui/icons-material'
import { PeerMonitoringPush } from './PeerMonitoringCard'

/**
 * 详情弹窗扩展的数据结构
 */
interface PeerMonitoringDetail extends PeerMonitoringPush {
  peerBackground?: string
  learnablePoints?: string[]
  isBookmarked: boolean
}

/**
 * PeerMonitoringDetailModal组件属性
 */
interface PeerMonitoringDetailModalProps {
  open: boolean
  push: PeerMonitoringDetail
  onClose: () => void
  onBookmark: () => void
  onMarkAsRead: () => void
}

/**
 * PeerMonitoringDetailModal组件 - 同业动态详情弹窗
 *
 * Story 8.6 - AC3
 *
 * 功能：
 * - 显示完整同业案例信息
 * - 同业机构背景
 * - 技术实践详细描述
 * - 投入成本/实施周期/效果
 * - 可借鉴点总结
 * - 信息来源和发布日期
 * - 相关技术标签
 * - 收藏功能
 * - 标记已读功能
 */
export const PeerMonitoringDetailModal = React.memo(function PeerMonitoringDetailModal({
  open,
  push,
  onClose,
  onBookmark,
  onMarkAsRead,
}: PeerMonitoringDetailModalProps) {
  // 优先级配置
  const priorityConfig: Record<string, { label: string; color: 'error' | 'warning' | 'default' }> = {
    high: { label: '高优先级', color: 'error' },
    medium: { label: '中优先级', color: 'warning' },
    low: { label: '低优先级', color: 'default' },
  }

  const priority = priorityConfig[push.priorityLevel] || { label: '普通', color: 'default' }

  // 相关性评分显示
  const relevancePercent = Math.round((push.relevanceScore || 0) * 100)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      scroll="paper"
    >
      {/* 标题区域 */}
      <DialogTitle sx={{ pb: 1, pr: 6 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
          {push.peerLogo ? (
            <Avatar
              src={push.peerLogo}
              alt={push.peerName}
              sx={{ width: 48, height: 48 }}
            />
          ) : (
            <Avatar sx={{ width: 48, height: 48, bgcolor: 'primary.main' }}>
              <Business sx={{ color: 'white', fontSize: 28 }} />
            </Avatar>
          )}
          <Box>
            <Typography variant="h5" fontWeight="bold">
              {push.peerName}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
              <Chip
                label="同业动态"
                color="primary"
                size="small"
                sx={{ fontWeight: 600 }}
              />
              <Chip
                label={priority.label}
                color={priority.color}
                size="small"
                variant="outlined"
              />
              <Chip
                label={`${relevancePercent}% 相关`}
                color={relevancePercent >= 90 ? 'warning' : 'default'}
                size="small"
                variant="outlined"
              />
            </Box>
          </Box>
        </Box>
        <IconButton
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* 同业机构背景 */}
          {push.peerBackground && (
            <Box
              sx={{
                p: 2.5,
                background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)',
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'success.light',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <Business color="success" />
                <Typography variant="subtitle1" fontWeight="bold" color="success.main">
                  同业机构背景
                </Typography>
              </Box>
              <Typography variant="body1" color="text.primary" sx={{ lineHeight: 1.8 }}>
                {push.peerBackground}
              </Typography>
            </Box>
          )}

          {/* 技术实践详细描述 */}
          <Box>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              技术实践详细描述
            </Typography>
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}
            >
              {push.practiceDescription}
            </Typography>
          </Box>

          <Divider />

          {/* 投入成本/实施周期/效果 */}
          <Grid container spacing={2}>
            {/* 投入成本 */}
            <Grid size={{ xs: 12, md: 4 }}>
              <Box
                sx={{
                  p: 2.5,
                  bgcolor: 'background.paper',
                  borderRadius: 2,
                  boxShadow: 1,
                  height: '100%',
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <AttachMoney color="primary" />
                  <Typography variant="subtitle2" fontWeight="bold">
                    投入成本
                  </Typography>
                </Box>
                <Typography variant="h5" fontWeight="bold" color="text.primary" gutterBottom>
                  {push.estimatedCost}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  包含软硬件采购、实施服务等
                </Typography>
              </Box>
            </Grid>

            {/* 实施周期 */}
            <Grid size={{ xs: 12, md: 4 }}>
              <Box
                sx={{
                  p: 2.5,
                  bgcolor: 'background.paper',
                  borderRadius: 2,
                  boxShadow: 1,
                  height: '100%',
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <Schedule color="warning" />
                  <Typography variant="subtitle2" fontWeight="bold">
                    实施周期
                  </Typography>
                </Box>
                <Typography variant="h5" fontWeight="bold" color="text.primary" gutterBottom>
                  {push.implementationPeriod}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  从启动到上线的预计时间
                </Typography>
              </Box>
            </Grid>

            {/* 技术效果 */}
            <Grid size={{ xs: 12, md: 4 }}>
              <Box
                sx={{
                  p: 2.5,
                  bgcolor: 'background.paper',
                  borderRadius: 2,
                  boxShadow: 1,
                  height: '100%',
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <EmojiEvents color="success" />
                  <Typography variant="subtitle2" fontWeight="bold">
                    技术效果
                  </Typography>
                </Box>
                <Typography variant="body1" fontWeight="bold" color="success.main" gutterBottom>
                  {push.technicalEffect}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  实际效果和收益
                </Typography>
              </Box>
            </Grid>
          </Grid>

          {/* 可借鉴点总结 */}
          {push.learnablePoints && push.learnablePoints.length > 0 && (
            <Box
              sx={{
                p: 2.5,
                background: 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)',
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'warning.light',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Lightbulb color="warning" />
                <Typography variant="subtitle1" fontWeight="bold" color="warning.main">
                  可借鉴点总结
                </Typography>
              </Box>
              <Box component="ul" sx={{ m: 0, pl: 2 }}>
                {push.learnablePoints.map((point, index) => (
                  <Typography
                    key={index}
                    component="li"
                    variant="body1"
                    color="text.primary"
                    sx={{ mb: 1, lineHeight: 1.6 }}
                  >
                    {point}
                  </Typography>
                ))}
              </Box>
            </Box>
          )}

          <Divider />

          {/* 信息来源和发布日期 */}
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {push.source && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <LinkIcon color="action" fontSize="small" />
                <Typography variant="body2" color="text.secondary">
                  来源: {push.source}
                </Typography>
              </Box>
            )}
            {push.publishDate && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CalendarToday color="action" fontSize="small" />
                <Typography variant="body2" color="text.secondary">
                  发布日期: {new Date(push.publishDate).toLocaleDateString('zh-CN')}
                </Typography>
              </Box>
            )}
          </Box>

          {/* 相关技术标签 */}
          {push.tags && push.tags.length > 0 && (
            <Box>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                相关技术
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {push.tags.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    variant="outlined"
                    color="primary"
                    size="small"
                  />
                ))}
              </Box>
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button
          startIcon={push.isBookmarked ? <Bookmark /> : <BookmarkBorder />}
          variant="outlined"
          onClick={onBookmark}
          color={push.isBookmarked ? 'primary' : 'inherit'}
        >
          {push.isBookmarked ? '已收藏' : '收藏'}
        </Button>
        <Button
          startIcon={<CheckCircle />}
          variant="contained"
          onClick={onMarkAsRead}
          disabled={push.isRead}
          color={push.isRead ? 'success' : 'primary'}
        >
          {push.isRead ? '已读' : '标记为已读'}
        </Button>
        <Button onClick={onClose} variant="outlined">
          关闭
        </Button>
      </DialogActions>
    </Dialog>
  )
})
