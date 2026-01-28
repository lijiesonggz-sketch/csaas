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

/**
 * ROI分析数据结构
 */
interface ROIAnalysis {
  estimatedCost: string
  expectedBenefit: string
  roiEstimate: string
  implementationPeriod: string
  recommendedVendors: string[]
}

/**
 * 推送详情数据结构
 */
interface PushData {
  pushId: string
  radarType: 'tech' | 'industry' | 'compliance'
  title: string
  summary: string
  fullContent: string
  relevanceScore: number
  priorityLevel: 'high' | 'medium' | 'low'
  weaknessCategories: string[]
  url: string
  publishDate: string
  source: string
  tags: string[]
  targetAudience: string
  roiAnalysis?: ROIAnalysis
  isRead: boolean
  readAt?: string
}

/**
 * PushDetailModal属性
 */
interface PushDetailModalProps {
  pushId: string
  isOpen: boolean
  onClose: () => void
  push?: PushData
  isLoading?: boolean
  error?: string
}

/**
 * PushDetailModal组件 - 推送详情弹窗
 *
 * Story 2.4 - Phase 3 Task 3.2
 *
 * 功能：
 * - 显示文章全文
 * - 显示完整ROI分析（投入详情、收益详情、ROI计算公式）
 * - 显示实施周期和推荐供应商列表
 * - 添加操作按钮（收藏、分享、标记已读）
 */
export function PushDetailModal({
  pushId,
  isOpen,
  onClose,
  push,
  isLoading = false,
  error,
}: PushDetailModalProps) {
  return (
    <Dialog open={isOpen} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Typography variant="h5" fontWeight="bold" noWrap>
          {push?.title || '加载中...'}
        </Typography>
      </DialogTitle>

      <DialogContent dividers sx={{ minHeight: 400 }}>
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {push && !isLoading && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* 元信息 */}
            <Box>
              <Typography variant="body2" color="text.secondary">
                {push.source} • {new Date(push.publishDate).toLocaleDateString('zh-CN')}
              </Typography>
            </Box>

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

            <Divider />

            {/* 文章全文 */}
            <Box>
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
                {push.fullContent}
              </Typography>
            </Box>

            <Divider />

            {/* ROI分析详情 */}
            {push.roiAnalysis && (
              <Box
                sx={{
                  p: 2.5,
                  border: '2px solid',
                  borderColor: 'primary.light',
                  borderRadius: 2,
                  background: 'linear-gradient(135deg, #f3f4f6 0%, #e8eaf6 100%)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                  <Box sx={{ p: 1, bgcolor: 'primary.main', borderRadius: 1 }}>
                    <TrendingUp sx={{ color: 'white' }} />
                  </Box>
                  <Typography variant="h6" fontWeight="bold" color="primary">
                    💰 投资回报率(ROI)分析
                  </Typography>
                </Box>

                <Grid container spacing={2}>
                  {/* 预计投入成本 */}
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ p: 1.5, bgcolor: 'white', borderRadius: 1, boxShadow: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <AttachMoney color="primary" />
                        <Typography variant="subtitle2" fontWeight="bold">
                          预计投入成本
                        </Typography>
                      </Box>
                      <Typography variant="h6" fontWeight="bold">
                        {push.roiAnalysis.estimatedCost}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        包含软硬件采购、实施服务、培训等
                      </Typography>
                    </Box>
                  </Grid>

                  {/* 预期收益 */}
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ p: 1.5, bgcolor: 'white', borderRadius: 1, boxShadow: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <EmojiEvents color="success" />
                        <Typography variant="subtitle2" fontWeight="bold">
                          预期收益
                        </Typography>
                      </Box>
                      <Typography variant="body2" fontWeight="medium">
                        {push.roiAnalysis.expectedBenefit}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        量化收益包含成本节省、风险规避等
                      </Typography>
                    </Box>
                  </Grid>

                  {/* ROI估算 */}
                  <Grid item xs={12} sm={6}>
                    <Box
                      sx={{
                        p: 1.5,
                        background: 'linear-gradient(135deg, #f0f9ff 0%, #dcfce7 100%)',
                        borderRadius: 1,
                        border: '2px solid',
                        borderColor: 'success.light',
                        boxShadow: 1,
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Calculate color="success" />
                        <Typography variant="subtitle2" fontWeight="bold">
                          ROI估算
                        </Typography>
                      </Box>
                      <Typography variant="h5" fontWeight="bold" color="success.main">
                        {push.roiAnalysis.roiEstimate}
                      </Typography>
                      <Box sx={{ mt: 1, p: 1, bgcolor: 'rgba(255,255,255,0.8)', borderRadius: 0.5 }}>
                        <Typography variant="caption" fontWeight="bold" display="block" mb={0.5}>
                          计算公式：
                        </Typography>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                          ROI = (预期收益 - 投入成本) / 投入成本
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>

                  {/* 实施周期 */}
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ p: 1.5, bgcolor: 'white', borderRadius: 1, boxShadow: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Schedule color="warning" />
                        <Typography variant="subtitle2" fontWeight="bold">
                          实施周期
                        </Typography>
                      </Box>
                      <Typography variant="h6" fontWeight="bold">
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
                  <Box sx={{ mt: 2, p: 1.5, bgcolor: 'white', borderRadius: 1, boxShadow: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Business color="secondary" />
                      <Typography variant="subtitle2" fontWeight="bold">
                        推荐供应商
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {push.roiAnalysis.recommendedVendors.map((vendor) => (
                        <Chip key={vendor} label={vendor} size="small" variant="outlined" />
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
              <Button
                fullWidth
                variant="outlined"
                startIcon={<OpenInNew />}
                href={push.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                查看原文
              </Button>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button startIcon={<Bookmark />}>收藏</Button>
        <Button startIcon={<Share />}>分享</Button>
        <Button variant="contained" startIcon={<CheckCircle />}>
          标记为已读
        </Button>
        <Button onClick={onClose}>关闭</Button>
      </DialogActions>
    </Dialog>
  )
}
