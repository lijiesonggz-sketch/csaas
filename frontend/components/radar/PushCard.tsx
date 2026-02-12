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
  Business,
  Warning,
  Gavel,
  PlaylistAddCheck,
} from '@mui/icons-material'
import { formatChinaDate } from '@/lib/utils/dateTime'

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
    // 行业雷达特定字段 (Story 3.3)
    peerName?: string
    practiceDescription?: string
    estimatedCost?: string
    implementationPeriod?: string
    technicalEffect?: string
    // 合规雷达特定字段 (Story 4.3)
    complianceRiskCategory?: string
    penaltyCase?: string
    policyRequirements?: string
    hasPlaybook?: boolean
    playbookStatus?: 'ready' | 'generating' | 'failed'
    sentAt?: string
    // Story 6.3: 品牌信息
    brandName?: string
  }
  variant?: 'tech' | 'industry' | 'compliance'  // Story 3.3: 添加variant属性
  isWatchedPeer?: boolean  // Story 3.3: 是否为关注的同业
  onViewDetail?: (pushId: string) => void  // Story 4.3: 改为可选
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
  function PushCard({ push, variant = 'tech', isWatchedPeer = false, onViewDetail }: PushCardProps) {
  // 优先级配置 - 统一使用primary色调
  const priorityConfig: Record<1 | 2 | 3, { icon: string; label: string; color: any }> = {
    1: { icon: '🥇', label: '🥇 优先级1', color: 'primary' as const },
    2: { icon: '🥈', label: '🥈 优先级2', color: 'primary' as const },
    3: { icon: '🥉', label: '🥉 优先级3', color: 'default' as const },
  }

  const priority = priorityConfig[push.priorityLevel as 1 | 2 | 3] || {
    icon: '📌',
    label: '📌 未分类',
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

        {/* 行业雷达卡片显示 (Story 3.3 - variant='industry') */}
        {variant === 'industry' && (
          <Box
            sx={{
              p: 2,
              background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)',
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'success.light',
            }}
          >
            {/* 同业机构名称 */}
            {push.peerName && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <Business sx={{ color: 'success.main', fontSize: 20 }} />
                <Typography
                  variant="subtitle2"
                  fontWeight="bold"
                  color="success.main"
                  sx={{ fontSize: '0.875rem' }}
                >
                  {push.peerName}
                  {isWatchedPeer && (
                    <Chip
                      label="⭐ 关注"
                      size="small"
                      color="warning"
                      sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
                    />
                  )}
                </Typography>
              </Box>
            )}

            {/* 实践描述摘要（截断到100字） */}
            {push.practiceDescription && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  mb: 1.5,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {push.practiceDescription.length > 100
                  ? `${push.practiceDescription.substring(0, 100)}...`
                  : push.practiceDescription}
              </Typography>
            )}

            {/* 投入成本和实施周期（Grid 2列） */}
            <Grid container spacing={1.5}>
              {push.estimatedCost && (
                <Grid item xs={6}>
                  <Box>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block', mb: 0.5, fontSize: '0.7rem' }}
                    >
                      投入成本
                    </Typography>
                    <Typography
                      variant="body1"
                      fontWeight="bold"
                      color="text.primary"
                      sx={{ fontSize: '0.95rem' }}
                    >
                      {push.estimatedCost}
                    </Typography>
                  </Box>
                </Grid>
              )}

              {push.implementationPeriod && (
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
                      {push.implementationPeriod}
                    </Typography>
                  </Box>
                </Grid>
              )}
            </Grid>
          </Box>
        )}

        {/* 合规雷达卡片显示 (Story 4.3 - variant='compliance') */}
        {variant === 'compliance' && (
          <Box
            sx={{
              p: 2,
              background: 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)',
              borderRadius: 2,
              border: push.relevanceScore >= 0.9 ? '2px solid #d32f2f' : '1px solid',
              borderColor: push.relevanceScore >= 0.9 ? '#d32f2f' : 'error.light',
            }}
          >
            {/* 风险类别标签（红色 Tag） */}
            {push.complianceRiskCategory && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <Warning sx={{ color: 'error.main', fontSize: 20 }} />
                <Typography
                  variant="subtitle2"
                  fontWeight="bold"
                  color="error.main"
                  sx={{ fontSize: '0.875rem' }}
                >
                  {push.complianceRiskCategory}
                </Typography>
              </Box>
            )}

            {/* 处罚案例摘要（截断到100字） */}
            {push.penaltyCase && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  mb: 1.5,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {push.penaltyCase.length > 100
                  ? `${push.penaltyCase.substring(0, 100)}...`
                  : push.penaltyCase}
              </Typography>
            )}

            {/* ROI 分析摘要（0-10分进度条） */}
            <Box sx={{ mb: 1.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                  相关性评分
                </Typography>
                <Typography variant="caption" fontWeight="bold" color="error.main" sx={{ fontSize: '0.7rem' }}>
                  {push.relevanceScore >= 0.9 ? '🔴 高相关' : push.relevanceScore >= 0.7 ? '🟡 中相关' : '🟢 低相关'}
                </Typography>
              </Box>
              <Box
                sx={{
                  width: '100%',
                  height: 8,
                  bgcolor: 'grey.200',
                  borderRadius: 1,
                  overflow: 'hidden',
                }}
              >
                <Box
                  sx={{
                    width: `${Math.round(push.relevanceScore * 100)}%`,
                    height: '100%',
                    bgcolor: push.relevanceScore >= 0.9 ? '#d32f2f' : push.relevanceScore >= 0.7 ? '#ed6c02' : '#2e7d32',
                    transition: 'width 0.3s ease',
                  }}
                />
              </Box>
            </Box>

            {/* 高优先级标识 🚨 - 修复 Issue #8 (Code Review 2026-01-31): 使用优先级映射配置 */}
            {/* 注: 目前后端优先级定义为 1=low, 2=medium, 3=high */}
            {/* 如果后端优先级定义变更，应修改此处的判断条件 */}
            {push.priorityLevel === 3 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
                <Typography variant="caption" color="error.main" sx={{ fontSize: '0.75rem', fontWeight: 'bold' }}>
                  🚨 高优先级推送
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {/* ROI分析展示 (技术雷达) */}
        {variant === 'tech' && push.roiAnalysis && (
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

        {/* 如果没有ROI分析 (仅技术雷达) */}
        {variant === 'tech' && !push.roiAnalysis && (
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
            flexWrap: 'wrap',
          }}
        >
          {/* Story 6.3: 显示品牌信息 */}
          {push.brandName && (
            <>
              <Typography variant="caption" sx={{ color: 'primary.main', fontSize: '0.75rem', fontWeight: 600 }}>
                来自 {push.brandName} 的推送
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                •
              </Typography>
            </>
          )}
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
            来源: {push.source}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
            •
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
            {formatChinaDate(push.publishDate)}
          </Typography>
        </Box>
      </CardContent>

      <CardActions>
        <Button
          fullWidth
          variant="contained"
          color={variant === 'compliance' ? 'error' : 'primary'}
          endIcon={variant === 'compliance' ? <Gavel /> : <OpenInNew />}
          onClick={() => onViewDetail && onViewDetail(push.pushId)}
          disabled={!onViewDetail}
        >
          {variant === 'compliance' ? '查看应对剧本' : '查看详情'}
        </Button>
      </CardActions>
    </Card>
  )
},
// 自定义比较函数优化 React.memo - 修复 Issue #5: 添加合规雷达字段比较
(prevProps, nextProps) => {
  // 只在 pushId 和关键属性相同时跳过重渲染
  return (
    prevProps.push.pushId === nextProps.push.pushId &&
    prevProps.push.title === nextProps.push.title &&
    prevProps.push.relevanceScore === nextProps.push.relevanceScore &&
    prevProps.push.priorityLevel === nextProps.push.priorityLevel &&
    prevProps.push.complianceRiskCategory === nextProps.push.complianceRiskCategory &&
    prevProps.push.penaltyCase === nextProps.push.penaltyCase &&
    prevProps.push.hasPlaybook === nextProps.push.hasPlaybook &&
    JSON.stringify(prevProps.push.roiAnalysis) === JSON.stringify(nextProps.push.roiAnalysis)
  )
}
)
