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
  Avatar,
} from '@mui/material'
import {
  Schedule,
  AttachMoney,
  EmojiEvents,
  OpenInNew,
  Business,
  Star,
} from '@mui/icons-material'

/**
 * 同业动态推送数据结构
 */
export interface PeerMonitoringPush {
  id: string
  pushType: 'peer-monitoring' | 'industry' | 'tech' | 'compliance'
  peerName: string
  peerLogo?: string
  practiceDescription: string
  estimatedCost: string
  implementationPeriod: string
  technicalEffect: string
  relevanceScore: number
  priorityLevel: 'high' | 'medium' | 'low'
  sentAt: string
  isRead: boolean
  source?: string
  publishDate?: string
  tags?: string[]
  isBookmarked?: boolean
}

/**
 * PeerMonitoringCard组件属性
 */
interface PeerMonitoringCardProps {
  push: PeerMonitoringPush
  isWatchedPeer: boolean
  onMarkAsRead: () => void
  onViewDetail: () => void
}

/**
 * PeerMonitoringCard组件 - 同业动态卡片
 *
 * Story 8.6 - AC1, AC2
 *
 * 功能：
 * - 显示同业动态推送卡片
 * - 显示"与您关注的XX银行相关"标签
 * - 显示同业实践详情：成本、周期、效果
 * - 显示"同业动态"标签
 * - 显示相关性标注
 * - 查看详情按钮
 */
export const PeerMonitoringCard = React.memo(function PeerMonitoringCard({
  push,
  isWatchedPeer,
  onMarkAsRead,
  onViewDetail,
}: PeerMonitoringCardProps) {
  // 优先级配置
  const priorityConfig: Record<string, { label: string; color: 'error' | 'warning' | 'default' }> = {
    high: { label: '高优先级', color: 'error' },
    medium: { label: '中优先级', color: 'warning' },
    low: { label: '低优先级', color: 'default' },
  }

  const priority = priorityConfig[push.priorityLevel] || { label: '普通', color: 'default' }

  // 相关性评分显示
  const relevancePercent = Math.round((push.relevanceScore || 0) * 100)

  // 处理卡片点击
  const handleCardClick = () => {
    if (!push.isRead) {
      onMarkAsRead()
    }
  }

  // 处理查看详情
  const handleViewDetail = (e: React.MouseEvent) => {
    e.stopPropagation()
    onViewDetail()
  }

  return (
    <Card
      data-testid="peer-monitoring-card"
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleCardClick()
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`查看 ${push.peerName} 的同业动态详情`}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'box-shadow 0.2s',
        cursor: 'pointer',
        border: isWatchedPeer ? '2px solid' : '1px solid',
        borderColor: isWatchedPeer ? 'primary.main' : 'divider',
        '&:hover': {
          boxShadow: 6,
        },
        '&:focus': {
          outline: '2px solid',
          outlineColor: 'primary.main',
          outlineOffset: '2px',
        },
      }}
    >
      <CardContent sx={{ flexGrow: 1 }}>
        {/* 头部：类型标签和优先级 */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* 同业动态标签 */}
            <Chip
              label="同业动态"
              color="primary"
              size="small"
              sx={{ fontWeight: 600 }}
            />
            {/* 优先级标签 */}
            <Chip
              label={priority.label}
              color={priority.color}
              size="small"
              variant="outlined"
              sx={{ fontWeight: 500 }}
            />
            {/* 相关性评分 */}
            <Chip
              label={`${relevancePercent}% 相关`}
              color={relevancePercent >= 90 ? 'warning' : 'default'}
              size="small"
              variant="outlined"
              sx={{ fontSize: '0.75rem' }}
            />
          </Box>

          {/* 与我关注的同业相关标签 */}
          {isWatchedPeer && (
            <Chip
              label={`与您关注的${push.peerName}相关`}
              color="success"
              size="small"
              sx={{
                fontWeight: 600,
                mb: 1,
                background: 'linear-gradient(135deg, #4caf50 0%, #2e7d32 100%)',
              }}
            />
          )}
        </Box>

        {/* 同业机构名称和Logo */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          {push.peerLogo ? (
            <Avatar
              src={push.peerLogo}
              alt={push.peerName}
              sx={{ width: 40, height: 40 }}
            />
          ) : (
            <Avatar sx={{ width: 40, height: 40, bgcolor: 'primary.main' }}>
              <Business sx={{ color: 'white', fontSize: 24 }} />
            </Avatar>
          )}
          <Box>
            <Typography
              variant="h6"
              component="h3"
              sx={{
                fontSize: '1.1rem',
                fontWeight: 700,
                color: isWatchedPeer ? 'primary.main' : 'text.primary',
              }}
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
        </Box>

        {/* 实践描述摘要 */}
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
            lineHeight: 1.6,
          }}
        >
          {push.practiceDescription}
        </Typography>

        {/* 成本、周期、效果 */}
        <Box
          sx={{
            p: 2,
            background: 'linear-gradient(135deg, #e3f2fd 0%, #e8eaf6 100%)',
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'primary.light',
          }}
        >
          <Grid container spacing={2}>
            {/* 投入成本 */}
            <Grid size={{ xs: 12, sm: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AttachMoney color="primary" fontSize="small" />
                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', fontSize: '0.7rem' }}
                  >
                    投入成本
                  </Typography>
                  <Typography
                    variant="body2"
                    fontWeight="bold"
                    color="text.primary"
                  >
                    {push.estimatedCost}
                  </Typography>
                </Box>
              </Box>
            </Grid>

            {/* 实施周期 */}
            <Grid size={{ xs: 12, sm: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Schedule color="warning" fontSize="small" />
                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', fontSize: '0.7rem' }}
                  >
                    实施周期
                  </Typography>
                  <Typography
                    variant="body2"
                    fontWeight="bold"
                    color="text.primary"
                  >
                    {push.implementationPeriod}
                  </Typography>
                </Box>
              </Box>
            </Grid>

            {/* 技术效果 */}
            <Grid size={{ xs: 12, sm: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <EmojiEvents color="success" fontSize="small" />
                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', fontSize: '0.7rem' }}
                  >
                    技术效果
                  </Typography>
                  <Typography
                    variant="body2"
                    fontWeight="bold"
                    color="success.main"
                    sx={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 1,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {push.technicalEffect}
                  </Typography>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Box>

        {/* 相关技术标签 */}
        {push.tags && push.tags.length > 0 && (
          <Box sx={{ display: 'flex', gap: 0.5, mt: 2, flexWrap: 'wrap' }}>
            {push.tags.slice(0, 5).map((tag) => (
              <Chip
                key={tag}
                label={tag}
                size="small"
                variant="outlined"
                sx={{
                  fontSize: '0.75rem',
                  borderColor: 'divider',
                  color: 'text.secondary',
                }}
              />
            ))}
            {push.tags.length > 5 && (
              <Chip
                label={`+${push.tags.length - 5}`}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.75rem' }}
              />
            )}
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
          {push.source && (
            <>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                来源: {push.source}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                •
              </Typography>
            </>
          )}
          {push.publishDate && (
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
              {new Date(push.publishDate).toLocaleDateString('zh-CN')}
            </Typography>
          )}
          {push.isRead && (
            <>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                •
              </Typography>
              <Typography variant="caption" sx={{ color: 'success.main', fontSize: '0.75rem' }}>
                已读
              </Typography>
            </>
          )}
        </Box>
      </CardContent>

      <CardActions>
        <Button
          fullWidth
          variant="contained"
          color="primary"
          endIcon={<OpenInNew />}
          onClick={handleViewDetail}
        >
          查看详情
        </Button>
      </CardActions>
    </Card>
  )
})
