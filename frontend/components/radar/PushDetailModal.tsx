'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Chip,
  Button,
  Divider,
  Grid,
  CircularProgress,
  Alert,
} from '@mui/material'
import {
  TrendingUp,
  Schedule,
  AttachMoney,
  EmojiEvents,
  Business,
  OpenInNew,
  Bookmark,
  Share,
  CheckCircle,
  Calculate,
} from '@mui/icons-material'
import { getRadarPush, markPushAsRead, RadarPush, ROIAnalysis } from '@/lib/api/radar'
import { formatChinaDate } from '@/lib/utils/dateTime'

/**
 * PushDetailModal属性
 */
interface PushDetailModalProps {
  pushId: string
  isOpen: boolean
  onClose: () => void
}

/**
 * PushDetailModal组件 - 推送详情弹窗
 *
 * Story 2.4 - Phase 3 Task 3.2 (Issue #5修复 - 添加backend fetch)
 * Story 2.5 - Task 2.4: 性能优化 (React.memo, useCallback)
 *
 * 功能：
 * - 从后端API加载推送详情
 * - 显示文章全文
 * - 显示完整ROI分析（投入详情、收益详情、ROI计算公式）
 * - 显示实施周期和推荐供应商列表
 * - 添加操作按钮（收藏、分享、标记已读）
 */
export const PushDetailModal = React.memo(function PushDetailModal({
  pushId,
  isOpen,
  onClose,
}: PushDetailModalProps) {
  const [push, setPush] = useState<RadarPush | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isMarkingAsRead, setIsMarkingAsRead] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 加载推送详情
  useEffect(() => {
    if (!isOpen || !pushId) return

    const fetchPush = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const data = await getRadarPush(pushId)
        setPush(data)
      } catch (err) {
        // 生产环境应使用错误跟踪服务（如 Sentry）
        if (process.env.NODE_ENV === 'development') {
          console.error('Failed to fetch push details:', err)
        }
        setError(err instanceof Error ? err.message : '加载推送详情失败')
      } finally {
        setIsLoading(false)
      }
    }

    fetchPush()
  }, [pushId, isOpen])

  // 标记为已读
  const handleMarkAsRead = useCallback(async () => {
    if (!pushId || isMarkingAsRead) return

    setIsMarkingAsRead(true)
    try {
      await markPushAsRead(pushId)
      if (push) {
        setPush({ ...push, isRead: true, readAt: new Date().toISOString() })
      }
    } catch (err) {
      // 生产环境应使用错误跟踪服务（如 Sentry）
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to mark as read:', err)
      }
      // 可以添加用户友好的错误提示
    } finally {
      setIsMarkingAsRead(false)
    }
  }, [pushId, push, isMarkingAsRead])

  // 加载状态
  if (isLoading) {
    return (
      <Dialog open={isOpen} onClose={onClose} maxWidth="md" fullWidth>
        <DialogContent>
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        </DialogContent>
      </Dialog>
    )
  }

  // 错误状态
  if (error) {
    return (
      <Dialog open={isOpen} onClose={onClose} maxWidth="md" fullWidth>
        <DialogContent>
          <Alert severity="error">{error}</Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>关闭</Button>
        </DialogActions>
      </Dialog>
    )
  }

  // 无数据
  if (!push) {
    return null
  }

  return (
    <Dialog open={isOpen} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Typography variant="h5" fontWeight="bold">
          {push.title}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
          <Typography variant="caption" color="text.secondary">
            {push.source}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            •
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {formatChinaDate(push.publishDate)}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* 薄弱项标签 */}
          {push.weaknessCategories.length > 0 && (
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {push.weaknessCategories.map((category) => (
                <Chip
                  key={category}
                  label={`🎯 关联薄弱项: ${category}`}
                  color="secondary"
                  size="small"
                />
              ))}
            </Box>
          )}

          {/* 文章全文 */}
          <Box>
            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
              {push.fullContent || push.summary}
            </Typography>
          </Box>

          <Divider />

          {/* 行业雷达详情 (Story 3.3 - Phase 3) */}
          {push.radarType === 'industry' && (
            <>
              {/* 同业机构背景区域 */}
              {push.peerName && (
                <Box
                  sx={{
                    p: 3,
                    border: '2px solid',
                    borderColor: 'success.light',
                    borderRadius: 2,
                    background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <Box
                      sx={{
                        p: 1,
                        bgcolor: 'success.main',
                        borderRadius: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Business sx={{ color: 'white', fontSize: 32 }} />
                    </Box>
                    <Box>
                      <Typography variant="h6" fontWeight="bold" color="success.main">
                        {push.peerName}
                      </Typography>
                      <Chip
                        label="同业标杆机构"
                        size="small"
                        color="success"
                        sx={{ mt: 0.5 }}
                      />
                    </Box>
                  </Box>
                </Box>
              )}

              {/* 技术实践详细描述 */}
              {push.practiceDescription && (
                <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                    技术实践详细描述
                  </Typography>
                  <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
                    {push.practiceDescription}
                  </Typography>
                </Box>
              )}

              {/* 投入成本/实施周期/效果 */}
              <Grid container spacing={2}>
                {push.estimatedCost && (
                  <Grid item xs={12} md={4}>
                    <Box sx={{ p: 2, bgcolor: 'white', borderRadius: 1, boxShadow: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <AttachMoney color="success" />
                        <Typography variant="subtitle2" fontWeight="bold">
                          投入成本
                        </Typography>
                      </Box>
                      <Typography variant="h6" fontWeight="bold" color="text.primary">
                        {push.estimatedCost}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        包含软硬件采购、实施服务等
                      </Typography>
                    </Box>
                  </Grid>
                )}

                {push.implementationPeriod && (
                  <Grid item xs={12} md={4}>
                    <Box sx={{ p: 2, bgcolor: 'white', borderRadius: 1, boxShadow: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Schedule color="warning" />
                        <Typography variant="subtitle2" fontWeight="bold">
                          实施周期
                        </Typography>
                      </Box>
                      <Typography variant="h6" fontWeight="bold" color="text.primary">
                        {push.implementationPeriod}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        从启动到上线的预计时间
                      </Typography>
                    </Box>
                  </Grid>
                )}

                {push.technicalEffect && (
                  <Grid item xs={12} md={4}>
                    <Box sx={{ p: 2, bgcolor: 'white', borderRadius: 1, boxShadow: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <EmojiEvents color="success" />
                        <Typography variant="subtitle2" fontWeight="bold">
                          技术效果
                        </Typography>
                      </Box>
                      <Typography variant="body1" fontWeight="bold" color="text.primary">
                        {push.technicalEffect}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        实际效果和收益
                      </Typography>
                    </Box>
                  </Grid>
                )}
              </Grid>

              {/* 可借鉴点总结 */}
              {push.tags && push.tags.length > 0 && (
                <Box sx={{ p: 2, bgcolor: 'white', borderRadius: 1, boxShadow: 1 }}>
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                    可借鉴点总结
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    {push.tags.join('、')}
                  </Typography>
                </Box>
              )}

              <Divider />
            </>
          )}

          {/* ROI分析详情 (技术雷达) */}
          {push.radarType === 'tech' && push.roiAnalysis && (
            <Box
              sx={{
                p: 3,
                border: '2px solid',
                borderColor: 'primary.light',
                borderRadius: 2,
                background: 'linear-gradient(135deg, #e3f2fd 0%, #e8eaf6 100%)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <Box
                  sx={{
                    p: 1,
                    bgcolor: 'primary.main',
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <TrendingUp sx={{ color: 'white', fontSize: 32 }} />
                </Box>
                <Typography variant="h6" fontWeight="bold" color="primary">
                  💰 投资回报率(ROI)分析
                </Typography>
              </Box>

              <Grid container spacing={2}>
                {/* 预计投入成本 */}
                <Grid item xs={12} md={6}>
                  <Box sx={{ p: 2, bgcolor: 'white', borderRadius: 1, boxShadow: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <AttachMoney color="primary" />
                      <Typography variant="subtitle2" fontWeight="bold">
                        预计投入成本
                      </Typography>
                    </Box>
                    <Typography variant="h6" fontWeight="bold" color="text.primary">
                      {push.roiAnalysis.estimatedCost}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      包含软硬件采购、实施服务、培训等
                    </Typography>
                  </Box>
                </Grid>

                {/* 预期收益 */}
                <Grid item xs={12} md={6}>
                  <Box sx={{ p: 2, bgcolor: 'white', borderRadius: 1, boxShadow: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <EmojiEvents color="success" />
                      <Typography variant="subtitle2" fontWeight="bold">
                        预期收益
                      </Typography>
                    </Box>
                    <Typography variant="body1" fontWeight="bold" color="text.primary">
                      {push.roiAnalysis.expectedBenefit}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      量化收益包含成本节省、风险规避等
                    </Typography>
                  </Box>
                </Grid>

                {/* ROI估算 */}
                <Grid item xs={12} md={6}>
                  <Box
                    sx={{
                      p: 2,
                      background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)',
                      borderRadius: 1,
                      border: '2px solid',
                      borderColor: 'success.light',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Calculate color="success" />
                      <Typography variant="subtitle2" fontWeight="bold">
                        ROI估算
                      </Typography>
                    </Box>
                    <Typography variant="h4" fontWeight="bold" color="success.main">
                      {push.roiAnalysis.roiEstimate}
                    </Typography>
                    <Box sx={{ mt: 1, p: 1, bgcolor: 'white', borderRadius: 1 }}>
                      <Typography variant="caption" color="text.secondary" display="block">
                        计算公式：
                      </Typography>
                      <Typography variant="caption" fontFamily="monospace" color="text.secondary">
                        ROI = (预期收益 - 投入成本) / 投入成本
                      </Typography>
                    </Box>
                  </Box>
                </Grid>

                {/* 实施周期 */}
                <Grid item xs={12} md={6}>
                  <Box sx={{ p: 2, bgcolor: 'white', borderRadius: 1, boxShadow: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Schedule color="warning" />
                      <Typography variant="subtitle2" fontWeight="bold">
                        实施周期
                      </Typography>
                    </Box>
                    <Typography variant="h6" fontWeight="bold" color="text.primary">
                      {push.roiAnalysis.implementationPeriod}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      从启动到上线的预计时间
                    </Typography>
                  </Box>
                </Grid>
              </Grid>

              {/* 推荐供应商 */}
              {push.roiAnalysis.recommendedVendors.length > 0 && (
                <Box sx={{ mt: 2, p: 2, bgcolor: 'white', borderRadius: 1, boxShadow: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Business color="secondary" />
                    <Typography variant="subtitle2" fontWeight="bold">
                      推荐供应商
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {push.roiAnalysis.recommendedVendors.map((vendor) => (
                      <Chip key={vendor} label={vendor} variant="outlined" />
                    ))}
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    以上供应商具有金融行业资质和成功案例
                  </Typography>
                </Box>
              )}
            </Box>
          )}

          {/* 原文链接 */}
          {push.url && (
            <Box>
              <Button
                variant="outlined"
                startIcon={<OpenInNew />}
                href={push.url}
                target="_blank"
                rel="noopener noreferrer"
                fullWidth
              >
                查看原文
              </Button>
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button startIcon={<Bookmark />} variant="outlined">
          收藏
        </Button>
        <Button startIcon={<Share />} variant="outlined">
          分享
        </Button>
        <Button
          startIcon={<CheckCircle />}
          variant="contained"
          onClick={handleMarkAsRead}
          disabled={push.isRead || isMarkingAsRead}
        >
          {push.isRead ? '已读' : isMarkingAsRead ? '标记中...' : '标记为已读'}
        </Button>
        <Button onClick={onClose}>关闭</Button>
      </DialogActions>
    </Dialog>
  )
})
