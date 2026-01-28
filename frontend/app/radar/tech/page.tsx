'use client'

import { useState } from 'react'
import { Box, Container, Typography, Card, CardContent, Grid, Button, Alert, CircularProgress } from '@mui/material'
import { TrendingUp, Refresh } from '@mui/icons-material'
import { PushCard } from '@/components/radar/PushCard'
import { PushDetailModal } from '@/components/radar/PushDetailModal'

// 禁用静态生成，因为这个页面需要动态数据
export const dynamic = 'force-dynamic'

/**
 * Tech Radar Page - 技术雷达
 *
 * Story 2.4 - Phase 3: 前端展示
 * - 显示技术推送列表
 * - 使用PushCard组件展示推送摘要和ROI分析
 * - 使用PushDetailModal弹窗展示详情
 */
export default function TechRadarPage() {
  const [selectedPushId, setSelectedPushId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Mock数据 - 实际应从API加载
  const mockPushes = [
    {
      pushId: 'push-1',
      radarType: 'tech' as const,
      title: '零信任架构在金融行业的应用',
      summary: '介绍零信任架构的实施方案和成本收益分析',
      fullContent: `零信任架构是一种新的安全模式，它假设没有用户或设备是可信的，
所有访问都需要经过严格的验证。本文详细介绍了零信任架构的实施方案和成本收益分析。

主要内容包括：
1. 零信任架构的核心概念和原则
2. 金融行业的应用场景
3. 实施成本和收益分析
4. 典型的实施方案

关键收益：
- 提升安全性和风险管理能力
- 减少内部威胁和数据泄露风险
- 提高系统可用性和性能`,
      relevanceScore: 0.95,
      priorityLevel: 'high' as const,
      weaknessCategories: ['数据安全'],
      publishDate: '2024-01-15',
      source: '金融科技周刊',
      url: 'https://example.com/article1',
      tags: ['零信任', '安全架构', '身份验证'],
      targetAudience: 'IT总监、架构师',
      roiAnalysis: {
        estimatedCost: '50-100万',
        expectedBenefit: '年节省200万运维成本 + 提升系统可用性',
        roiEstimate: 'ROI 2:1',
        implementationPeriod: '3-6个月',
        recommendedVendors: ['阿里云', '腾讯云', '华为云'],
      },
      isRead: false,
    },
    {
      pushId: 'push-2',
      radarType: 'tech' as const,
      title: '云原生架构最佳实践',
      summary: '云原生技术在生产环境中的最佳实践指南',
      fullContent: '云原生架构的实施指南...',
      relevanceScore: 0.92,
      priorityLevel: 'high' as const,
      weaknessCategories: ['基础设施管理'],
      publishDate: '2024-01-14',
      source: '技术论坛',
      url: 'https://example.com/article2',
      tags: ['云原生', 'Kubernetes', 'Docker'],
      targetAudience: '架构师',
      roiAnalysis: {
        estimatedCost: '100-150万',
        expectedBenefit: '年节省300万基础设施成本',
        roiEstimate: 'ROI 2:1',
        implementationPeriod: '6-9个月',
        recommendedVendors: ['阿里云', '腾讯云'],
      },
      isRead: false,
    },
    {
      pushId: 'push-3',
      radarType: 'tech' as const,
      title: 'API网关安全防护',
      summary: 'API网关的安全防护策略和实施方案',
      fullContent: 'API网关安全防护的详细说明...',
      relevanceScore: 0.88,
      priorityLevel: 'medium' as const,
      weaknessCategories: ['数据安全'],
      publishDate: '2024-01-13',
      source: '技术社区',
      url: 'https://example.com/article3',
      tags: ['API网关', '安全'],
      targetAudience: 'IT总监',
      roiAnalysis: {
        estimatedCost: '30-50万',
        expectedBenefit: '年防御50起以上的API攻击',
        roiEstimate: 'ROI 3:1',
        implementationPeriod: '1-2个月',
        recommendedVendors: ['阿里云'],
      },
      isRead: false,
    },
  ]

  const handleRefresh = () => {
    setIsLoading(true)
    setError(null)
    // 模拟API调用
    setTimeout(() => {
      setIsLoading(false)
    }, 1000)
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* 页面标题 */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <TrendingUp fontSize="large" />
          <Typography variant="h4" fontWeight="bold">
            技术雷达 - ROI导向的技术决策支持
          </Typography>
        </Box>
        <Typography variant="body1" color="text.secondary">
          基于您的薄弱项和关注领域，为您推荐最具性价比的技术方案
        </Typography>
      </Box>

      {/* 操作按钮 */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, justifyContent: 'flex-end' }}>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={handleRefresh}
          disabled={isLoading}
        >
          刷新
        </Button>
      </Box>

      {/* 错误提示 */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* 加载状态 */}
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {/* 推送列表 */}
      {!isLoading && mockPushes.length > 0 ? (
        <Grid container spacing={3}>
          {mockPushes.map((push) => (
            <Grid item xs={12} sm={6} lg={4} key={push.pushId}>
              <PushCard
                push={push}
                onViewDetail={setSelectedPushId}
              />
            </Grid>
          ))}
        </Grid>
      ) : !isLoading ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body1" color="text.secondary">
              暂无推送内容
            </Typography>
          </CardContent>
        </Card>
      ) : null}

      {/* 详情弹窗 */}
      {selectedPushId && (
        <PushDetailModal
          pushId={selectedPushId}
          isOpen={!!selectedPushId}
          onClose={() => setSelectedPushId(null)}
          push={mockPushes.find((p) => p.pushId === selectedPushId)}
          isLoading={false}
        />
      )}
    </Container>
  )
}
