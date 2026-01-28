'use client'

import React from 'react'
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Chip,
  Box,
  Button,
  Grid,
  Divider,
} from '@mui/material'
import {
  TrendingUp,
  Schedule,
  AttachMoney,
  EmojiEvents,
  OpenInNew,
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
 * 推送卡片属性
 */
interface PushCardProps {
  push: {
    pushId: string
    title: string
    summary: string
    relevanceScore: number
    priorityLevel: 1 | 2 | 3
    weaknessCategories: string[]
    publishDate: string
    source: string
    roiAnalysis?: ROIAnalysis
  }
  onViewDetail: (pushId: string) => void
}

/**
 * PushCard组件 - 技术雷达推送卡片
 *
 * Story 2.4 - Phase 3 Task 3.1
 * Story 2.5 - Task 2.4: 性能优化 (React.memo with comparison)
 *
 * 功能：
 * - 显示推送基本信息（标题、摘要、优先级）
 * - 显示ROI分析摘要（投入、收益、ROI评分、周期）
 * - 使用视觉标识突出高ROI推送
 * - 添加"查看详情"按钮
 */
export const PushCard = React.memo(
  function PushCard({ push, onViewDetail }: PushCardProps) {
  // 优先级配置 - 统一使用primary色调
  const priorityConfig: Record<1 | 2 | 3, { icon: string; label: string; color: any }> = {
    1: { icon: '🥇', label: '优先级1', color: 'primary' as const },
    2: { icon: '🥈', label: '优先级2', color: 'primary' as const },
    3: { icon: '🥉', label: '优先级3', color: 'default' as const },
  }

  const priority = priorityConfig[push.priorityLevel as 1 | 2 | 3] || {
    icon: '📌',
    label: '未分类',
    color: 'default' as const,
  }

  // 相关性评分显示 - 使用warning色调区分
  const relevancePercent = Math.round((push.relevanceScore || 0) * 100)
  const relevanceColor =
    relevancePercent >= 95 ? 'warning' : relevancePercent >= 90 ? 'default' : 'default'

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'box-shadow 0.2s',
        '&:hover': {
          boxShadow: 6,
        },
      }}
    >
      <CardContent sx={{ flexGrow: 1 }}>
        {/* 标题和优先级 */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
            <Chip
              label={priority.label}
              color={priority.color}
              size="small"
              sx={{ fontWeight: 600 }}
            />
            <Chip
              label={`${relevancePercent}% 相关`}
              color={relevanceColor}
              size="small"
              variant="outlined"
              sx={{ fontSize: '0.75rem' }}
            />
          </Box>
          <Typography
            variant="h6"
            component="h3"
            gutterBottom
            sx={{
              fontSize: '1.15rem',
              fontWeight: 600,
              lineHeight: 1.4,
              color: 'text.primary',
            }}
          >
            {push.title}
          </Typography>
        </Box>

        {/* 薄弱项标签 */}
        {push.weaknessCategories.length > 0 && (
          <Box sx={{ display: 'flex', gap: 0.5, mb: 2, flexWrap: 'wrap' }}>
            {push.weaknessCategories.map((category) => (
              <Chip
                key={category}
                label={category}
                size="small"
                variant="outlined"
                sx={{
                  borderColor: 'primary.main',
                  color: 'primary.main',
                  fontSize: '0.75rem',
                  '&:hover': {
                    borderColor: 'primary.dark',
                    bgcolor: 'primary.50',
                  },
                }}
              />
            ))}
          </Box>
        )}

        {/* 摘要 */}
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            mb: 2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {push.summary}
        </Typography>

        {/* ROI分析展示 */}
        {push.roiAnalysis && (
          <Box
            sx={{
              p: 2,
              background: 'linear-gradient(135deg, #e3f2fd 0%, #e8eaf6 100%)',
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'primary.light',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <TrendingUp color="primary" fontSize="small" />
              <Typography
                variant="subtitle2"
                fontWeight="bold"
                color="primary"
                sx={{ fontSize: '0.875rem' }}
              >
                ROI分析
              </Typography>
            </Box>

            <Grid container spacing={1.5}>
              {/* 预计投入 */}
              <Grid item xs={6}>
                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mb: 0.5, fontSize: '0.7rem' }}
                  >
                    预计投入
                  </Typography>
                  <Typography
                    variant="body1"
                    fontWeight="bold"
                    color="text.primary"
                    sx={{ fontSize: '0.95rem' }}
                  >
                    {push.roiAnalysis.estimatedCost}
                  </Typography>
                </Box>
              </Grid>

              {/* 预期收益 */}
              <Grid item xs={6}>
                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mb: 0.5, fontSize: '0.7rem' }}
                  >
                    预期收益
                  </Typography>
                  <Typography
                    variant="body1"
                    fontWeight="bold"
                    color="success.main"
                    sx={{
                      fontSize: '0.95rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {push.roiAnalysis.expectedBenefit}
                  </Typography>
                </Box>
              </Grid>

              {/* ROI估算 */}
              <Grid item xs={6}>
                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mb: 0.5, fontSize: '0.7rem' }}
                  >
                    ROI估算
                  </Typography>
                  <Typography
                    variant="h6"
                    color="success.main"
                    fontWeight="bold"
                    sx={{ fontSize: '1.1rem' }}
                  >
                    {push.roiAnalysis.roiEstimate}
                  </Typography>
                </Box>
              </Grid>

              {/* 实施周期 */}
              <Grid item xs={6}>
                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mb: 0.5, fontSize: '0.7rem' }}
                  >
                    实施周期
                  </Typography>
                  <Typography
                    variant="body1"
                    fontWeight="bold"
                    color="text.primary"
                    sx={{ fontSize: '0.95rem' }}
                  >
                    {push.roiAnalysis.implementationPeriod}
                  </Typography>
                </Box>
              </Grid>
            </Grid>

            {/* 推荐供应商 */}
            {push.roiAnalysis.recommendedVendors.length > 0 && (
              <>
                <Divider sx={{ my: 1.5 }} />
                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    display="block"
                    mb={0.5}
                    sx={{ fontSize: '0.7rem' }}
                  >
                    推荐供应商
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {push.roiAnalysis.recommendedVendors.map((vendor) => (
                      <Chip
                        key={vendor}
                        label={vendor}
                        size="small"
                        variant="outlined"
                        sx={{
                          fontSize: '0.75rem',
                          borderColor: 'divider',
                          color: 'text.secondary',
                          '&:hover': {
                            borderColor: 'primary.main',
                            color: 'primary.main',
                            bgcolor: 'primary.50',
                          },
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              </>
            )}
          </Box>
        )}

        {/* 如果没有ROI分析 */}
        {!push.roiAnalysis && (
          <Box
            sx={{
              p: 2,
              bgcolor: 'grey.100',
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'grey.300',
            }}
          >
            <Typography variant="body2" color="text.secondary" align="center">
              ROI分析中...
            </Typography>
          </Box>
        )}

        {/* 元信息 */}
        <Box
          sx={{
            display: 'flex',
            gap: 2,
            mt: 2,
            pt: 1,
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
            来源: {push.source}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
            •
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
            {new Date(push.publishDate).toLocaleDateString('zh-CN')}
          </Typography>
        </Box>
      </CardContent>

      <CardActions>
        <Button
          fullWidth
          variant="contained"
          endIcon={<OpenInNew />}
          onClick={() => onViewDetail(push.pushId)}
        >
          查看详情
        </Button>
      </CardActions>
    </Card>
  )
},
// 自定义比较函数优化 React.memo
(prevProps, nextProps) => {
  // 只在 pushId 和关键属性相同时跳过重渲染
  return (
    prevProps.push.pushId === nextProps.push.pushId &&
    prevProps.push.title === nextProps.push.title &&
    prevProps.push.relevanceScore === nextProps.push.relevanceScore &&
    prevProps.push.priorityLevel === nextProps.push.priorityLevel &&
    JSON.stringify(prevProps.push.roiAnalysis) === JSON.stringify(nextProps.push.roiAnalysis)
  )
}
)
