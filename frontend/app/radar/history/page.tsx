'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  getPushHistory,
  markPushHistoryAsRead,
  PushHistoryItem,
  PushHistoryResponse,
} from '@/lib/api/radar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, TrendingUp, Building2, AlertTriangle } from 'lucide-react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription } from '@/components/ui/alert'
import PushDetailModal from './components/PushDetailModal'

// 配置 dayjs
dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

/**
 * 推送历史页面
 *
 * Story 5.4: 推送历史查看
 * AC 1-8: 完整的推送历史查看功能
 */
export default function PushHistoryPage() {
  // 状态管理
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pushHistory, setPushHistory] = useState<PushHistoryItem[]>([])
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })
  const [hasMore, setHasMore] = useState(true)

  // 筛选条件
  const [radarType, setRadarType] = useState<string>('all')
  const [timeRange, setTimeRange] = useState<string>('30d')
  const [relevance, setRelevance] = useState<string>('all')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  // 详情弹窗
  const [selectedPush, setSelectedPush] = useState<PushHistoryItem | null>(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)

  // HIGH-3 修复: 无限滚动
  const observerTarget = useRef<HTMLDivElement>(null)

  const getErrorMessage = (err: unknown, fallback: string) =>
    err instanceof Error && err.message ? err.message : fallback

  type PushHistoryFilters = NonNullable<Parameters<typeof getPushHistory>[0]>

  const buildFilters = useCallback((page: number): PushHistoryFilters => {
    const filters: PushHistoryFilters = {
      page,
      limit: pagination.limit,
    }

    if (radarType !== 'all') {
      filters.radarType = radarType as PushHistoryFilters['radarType']
    }
    if (timeRange === 'custom' && startDate && endDate) {
      filters.startDate = new Date(startDate).toISOString()
      filters.endDate = new Date(endDate).toISOString()
    } else if (timeRange !== 'all') {
      filters.timeRange = timeRange as PushHistoryFilters['timeRange']
    }
    if (relevance !== 'all') {
      filters.relevance = relevance as PushHistoryFilters['relevance']
    }

    return filters
  }, [endDate, pagination.limit, radarType, relevance, startDate, timeRange])

  const loadPushHistory = useCallback(async (reset: boolean = false) => {
    try {
      if (reset) {
        setLoading(true)
        setPushHistory([])
        setPagination((prev) => ({ ...prev, page: 1 }))
      }

      setError(null)

      const response: PushHistoryResponse = await getPushHistory(
        buildFilters(reset ? 1 : pagination.page),
      )

      if (reset) {
        setPushHistory(response.data)
      } else {
        setPushHistory((prev) => [...prev, ...response.data])
      }

      setPagination({
        page: response.meta.page,
        limit: response.meta.limit,
        total: response.meta.total,
        totalPages: response.meta.totalPages,
      })

      setHasMore(response.meta.page < response.meta.totalPages)
    } catch (err: any) {
      console.error('加载推送历史失败:', err)

      if (err?.status === 401 || err?.status === 403) {
        setError('认证失败，请重新登录')
      } else if (typeof err?.status === 'number' && err.status >= 500) {
        setError('服务器错误，请稍后重试')
      } else {
        setError(getErrorMessage(err, '加载推送历史失败'))
      }
    } finally {
      setLoading(false)
    }
  }, [buildFilters, pagination.page])

  const loadMorePushes = useCallback(async () => {
    if (loadingMore || !hasMore) return

    try {
      setLoadingMore(true)
      const nextPage = pagination.page + 1
      setPagination((prev) => ({ ...prev, page: nextPage }))

      const response: PushHistoryResponse = await getPushHistory(buildFilters(nextPage))

      setPushHistory((prev) => [...prev, ...response.data])
      setHasMore(response.meta.page < response.meta.totalPages)
    } catch (err: any) {
      console.error('加载更多失败:', err)
    } finally {
      setLoadingMore(false)
    }
  }, [buildFilters, hasMore, loadingMore, pagination.page])

  // 初始加载
  useEffect(() => {
    void loadPushHistory(true)
  }, [loadPushHistory])

  // HIGH-3 修复: 实现无限滚动
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          loadMorePushes()
        }
      },
      { threshold: 0.1 }
    )

    const target = observerTarget.current

    if (target) {
      observer.observe(target)
    }

    return () => {
      if (target) {
        observer.unobserve(target)
      }
    }
  }, [hasMore, loadMorePushes, loading, loadingMore])

  /**
   * 标记推送为已读
   */
  const handleMarkAsRead = async (pushId: string) => {
    try {
      await markPushHistoryAsRead(pushId)

      // 更新本地状态
      setPushHistory((prev) =>
        prev.map((push) =>
          push.id === pushId ? { ...push, isRead: true, readAt: new Date().toISOString() } : push
        )
      )

      // 如果详情弹窗打开，也更新选中的推送
      if (selectedPush && selectedPush.id === pushId) {
        setSelectedPush({ ...selectedPush, isRead: true, readAt: new Date().toISOString() })
      }
    } catch (err: any) {
      console.error('标记已读失败:', err)
      setError(getErrorMessage(err, '标记已读失败'))
    }
  }

  /**
   * HIGH-2 修复: 打开推送详情
   */
  const handleViewDetail = (push: PushHistoryItem) => {
    setSelectedPush(push)
    setDetailModalOpen(true)

    // 自动标记为已读
    if (!push.isRead) {
      handleMarkAsRead(push.id)
    }
  }

  /**
   * 关闭详情弹窗
   */
  const handleCloseDetail = () => {
    setDetailModalOpen(false)
    setSelectedPush(null)
  }

  /**
   * 重置筛选条件
   */
  const handleResetFilters = () => {
    setRadarType('all')
    setTimeRange('30d')
    setRelevance('all')
    setStartDate('')
    setEndDate('')
  }

  /**
   * 获取雷达类型标签颜色
   */
  const getRadarTypeColor = (type: string) => {
    switch (type) {
      case 'tech':
        return 'bg-blue-600'
      case 'industry':
        return 'bg-green-600'
      case 'compliance':
        return 'bg-orange-600'
      default:
        return 'bg-gray-600'
    }
  }

  /**
   * 获取雷达类型标签文本
   */
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

  /**
   * 获取雷达类型图标
   */
  const getRadarTypeIcon = (type: string) => {
    switch (type) {
      case 'tech':
        return TrendingUp
      case 'industry':
        return Building2
      case 'compliance':
        return AlertTriangle
      default:
        return TrendingUp
    }
  }

  /**
   * 获取相关性标识
   */
  const getRelevanceIcon = (level: string) => {
    switch (level) {
      case 'high':
        return '🔴'
      case 'medium':
        return '🟡'
      case 'low':
        return '⚪'
      default:
        return ''
    }
  }

  /**
   * 获取相关性文本
   */
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

  /**
   * 格式化相对时间
   * MEDIUM-4 修复: 添加日期验证和边界处理
   */
  const formatRelativeTime = (date: string) => {
    if (!date) return '未知时间'

    const parsedDate = dayjs(date)
    if (!parsedDate.isValid()) return '无效日期'

    // 处理未来时间（服务器时间不同步）
    if (parsedDate.isAfter(dayjs())) {
      return '刚刚'
    }

    return parsedDate.fromNow()
  }

  return (
    <div className="min-h-screen bg-[#FEFDFB] p-6">
      <div className="max-w-5xl mx-auto">
        {/* 页面标题 */}
        <h1 className="text-3xl font-bold font-[var(--font-plus-jakarta)] text-[#1E3A5F] mb-6">
          推送历史
        </h1>

        {/* 筛选器区域 */}
        <Card className="border border-[#E2E8F0] rounded-sm shadow-sm mb-6">
          <div className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
              {/* 雷达类型筛选 */}
              <div className="space-y-2">
                <Label htmlFor="radar-type">雷达类型</Label>
                <Select
                  value={radarType}
                  onValueChange={setRadarType}
                >
                  <SelectTrigger className="rounded-sm border-[#E2E8F0]">
                    <SelectValue placeholder="全部" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="tech">技术雷达</SelectItem>
                    <SelectItem value="industry">行业雷达</SelectItem>
                    <SelectItem value="compliance">合规雷达</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 时间范围筛选 */}
              <div className="space-y-2">
                <Label htmlFor="time-range">时间范围</Label>
                <Select
                  value={timeRange}
                  onValueChange={setTimeRange}
                >
                  <SelectTrigger className="rounded-sm border-[#E2E8F0]">
                    <SelectValue placeholder="最近30天" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7d">最近7天</SelectItem>
                    <SelectItem value="30d">最近30天</SelectItem>
                    <SelectItem value="90d">最近90天</SelectItem>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="custom">自定义</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 自定义日期范围 */}
              {timeRange === 'custom' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="start-date">开始日期</Label>
                    <Input
                      id="start-date"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="rounded-sm border-[#E2E8F0]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end-date">结束日期</Label>
                    <Input
                      id="end-date"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="rounded-sm border-[#E2E8F0]"
                    />
                  </div>
                </>
              )}

              {/* 相关性筛选 */}
              <div className={cn(
                "space-y-2",
                timeRange === 'custom' ? '' : 'lg:col-span-2'
              )}>
                <Label htmlFor="relevance">相关性</Label>
                <Select
                  value={relevance}
                  onValueChange={setRelevance}
                >
                  <SelectTrigger className="rounded-sm border-[#E2E8F0]">
                    <SelectValue placeholder="全部" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="high">高相关</SelectItem>
                    <SelectItem value="medium">中相关</SelectItem>
                    <SelectItem value="low">低相关</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 重置按钮 */}
              <div className={timeRange === 'custom' ? '' : 'lg:col-span-4'}>
                <Button
                  variant="outline"
                  className="rounded-sm w-full"
                  onClick={handleResetFilters}
                >
                  重置筛选
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* 错误提示 */}
        {error && (
          <Alert variant="destructive" className="mb-6 rounded-sm">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* 加载状态 */}
        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#1E3A5F] animate-spin" />
          </div>
        )}

        {/* 推送列表 */}
        {!loading && pushHistory.length === 0 && (
          <Alert className="rounded-sm">
            <AlertDescription>暂无推送历史</AlertDescription>
          </Alert>
        )}

        {!loading && pushHistory.length > 0 && (
          <>
            <div className="space-y-4">
              {pushHistory.map((push) => {
                const IconComponent = getRadarTypeIcon(push.radarType)
                return (
                  <Card
                    key={push.id}
                    className={cn(
                      "border border-[#E2E8F0] rounded-sm shadow-sm cursor-pointer transition-shadow hover:shadow-md",
                      !push.isRead && "border-l-4 border-l-[#1E3A5F]"
                    )}
                    onClick={() => handleViewDetail(push)}
                  >
                    <div className="p-4">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex gap-2 items-center">
                          <Badge className={cn("rounded-sm", getRadarTypeColor(push.radarType))}>
                            <IconComponent className="w-3 h-3 mr-1" />
                            {getRadarTypeLabel(push.radarType)}
                          </Badge>
                          <span className="text-sm text-[#94A3B8]">
                            {getRelevanceIcon(push.relevanceLevel)}{' '}
                            {getRelevanceLabel(push.relevanceLevel)}
                          </span>
                        </div>
                        <div className="flex gap-2 items-center">
                          <span className="text-sm text-[#94A3B8]">
                            {formatRelativeTime(push.sentAt)}
                          </span>
                          {push.isRead && (
                            <Badge variant="outline" className="rounded-sm">已读</Badge>
                          )}
                        </div>
                      </div>

                      <h3 className="text-lg font-semibold text-[#1E3A5F] mb-2">
                        {push.title}
                      </h3>

                      <p className="text-sm text-[#94A3B8] line-clamp-2">
                        {push.summary}
                      </p>

                      {/* 行业雷达：显示匹配的同业机构 */}
                      {push.radarType === 'industry' && push.matchedPeers && push.matchedPeers.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs text-[#94A3B8]">
                            与您关注的 {push.matchedPeers.join('、')} 相关
                          </p>
                        </div>
                      )}
                    </div>
                  </Card>
                )
              })}
            </div>

            {/* HIGH-3 修复: 无限滚动加载指示器 */}
            <div ref={observerTarget} className="flex justify-center mt-6 mb-4">
              {loadingMore && <Loader2 className="w-6 h-6 text-[#1E3A5F] animate-spin" />}
              {!hasMore && pushHistory.length > 0 && (
                <p className="text-sm text-[#94A3B8]">没有更多推送了</p>
              )}
            </div>
          </>
        )}

        {/* HIGH-2 修复: 推送详情弹窗 */}
        <PushDetailModal
          open={detailModalOpen}
          push={selectedPush}
          onClose={handleCloseDetail}
          onMarkAsRead={handleMarkAsRead}
        />
      </div>
    </div>
  )
}
