'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Grid,
} from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import dayjs, { Dayjs } from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'
import {
  getPushHistory,
  markPushHistoryAsRead,
  PushHistoryItem,
  PushHistoryResponse,
} from '@/lib/api/radar'
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
  const router = useRouter()

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
  const [startDate, setStartDate] = useState<Dayjs | null>(null)
  const [endDate, setEndDate] = useState<Dayjs | null>(null)

  // 详情弹窗
  const [selectedPush, setSelectedPush] = useState<PushHistoryItem | null>(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)

  // HIGH-3 修复: 无限滚动
  const observerTarget = useRef<HTMLDivElement>(null)

  // 初始加载
  useEffect(() => {
    loadPushHistory(true)
  }, [radarType, timeRange, relevance, startDate, endDate])

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

    if (observerTarget.current) {
      observer.observe(observerTarget.current)
    }

    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current)
      }
    }
  }, [hasMore, loading, loadingMore, pagination.page])

  /**
   * 加载推送历史
   * HIGH-3 修复: 支持初始加载和追加加载
   */
  const loadPushHistory = async (reset: boolean = false) => {
    try {
      if (reset) {
        setLoading(true)
        setPushHistory([])
        setPagination((prev) => ({ ...prev, page: 1 }))
      }

      setError(null)

      const filters: any = {
        page: reset ? 1 : pagination.page,
        limit: pagination.limit,
      }

      // 雷达类型筛选
      if (radarType !== 'all') {
        filters.radarType = radarType
      }

      // 时间范围筛选
      if (timeRange === 'custom' && startDate && endDate) {
        filters.startDate = startDate.toISOString()
        filters.endDate = endDate.toISOString()
      } else if (timeRange !== 'all') {
        filters.timeRange = timeRange
      }

      // 相关性筛选
      if (relevance !== 'all') {
        filters.relevance = relevance
      }

      const response: PushHistoryResponse = await getPushHistory(filters)

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

      // MEDIUM-1 修复: 改进错误处理
      if (err.status === 401 || err.status === 403) {
        setError('认证失败，请重新登录')
      } else if (err.status >= 500) {
        setError('服务器错误，请稍后重试')
      } else {
        setError(err.message || '加载推送历史失败')
      }
    } finally {
      setLoading(false)
    }
  }

  /**
   * 加载更多推送
   * HIGH-3 修复: 无限滚动加载下一页
   */
  const loadMorePushes = async () => {
    if (loadingMore || !hasMore) return

    try {
      setLoadingMore(true)
      setPagination((prev) => ({ ...prev, page: prev.page + 1 }))

      const filters: any = {
        page: pagination.page + 1,
        limit: pagination.limit,
      }

      if (radarType !== 'all') filters.radarType = radarType
      if (timeRange === 'custom' && startDate && endDate) {
        filters.startDate = startDate.toISOString()
        filters.endDate = endDate.toISOString()
      } else if (timeRange !== 'all') {
        filters.timeRange = timeRange
      }
      if (relevance !== 'all') filters.relevance = relevance

      const response: PushHistoryResponse = await getPushHistory(filters)

      setPushHistory((prev) => [...prev, ...response.data])
      setHasMore(response.meta.page < response.meta.totalPages)
    } catch (err: any) {
      console.error('加载更多失败:', err)
    } finally {
      setLoadingMore(false)
    }
  }

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
      setError(err.message || '标记已读失败')
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
    setStartDate(null)
    setEndDate(null)
  }

  /**
   * 获取雷达类型标签颜色
   */
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
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="zh-cn">
      <Box sx={{ p: 3 }}>
        {/* 页面标题 */}
        <Typography variant="h4" gutterBottom>
          推送历史
        </Typography>

        {/* 筛选器区域 */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              {/* 雷达类型筛选 */}
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>雷达类型</InputLabel>
                  <Select
                    value={radarType}
                    label="雷达类型"
                    onChange={(e) => setRadarType(e.target.value)}
                  >
                    <MenuItem value="all">全部</MenuItem>
                    <MenuItem value="tech">技术雷达</MenuItem>
                    <MenuItem value="industry">行业雷达</MenuItem>
                    <MenuItem value="compliance">合规雷达</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* 时间范围筛选 */}
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>时间范围</InputLabel>
                  <Select
                    value={timeRange}
                    label="时间范围"
                    onChange={(e) => setTimeRange(e.target.value)}
                  >
                    <MenuItem value="7d">最近7天</MenuItem>
                    <MenuItem value="30d">最近30天</MenuItem>
                    <MenuItem value="90d">最近90天</MenuItem>
                    <MenuItem value="all">全部</MenuItem>
                    <MenuItem value="custom">自定义</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* 自定义日期范围 */}
              {timeRange === 'custom' && (
                <>
                  <Grid item xs={12} sm={6} md={2}>
                    <DatePicker
                      label="开始日期"
                      value={startDate}
                      onChange={(newValue) => setStartDate(newValue)}
                      slotProps={{ textField: { size: 'small', fullWidth: true } }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={2}>
                    <DatePicker
                      label="结束日期"
                      value={endDate}
                      onChange={(newValue) => setEndDate(newValue)}
                      slotProps={{ textField: { size: 'small', fullWidth: true } }}
                    />
                  </Grid>
                </>
              )}

              {/* 相关性筛选 */}
              <Grid item xs={12} sm={6} md={timeRange === 'custom' ? 2 : 3}>
                <FormControl fullWidth size="small">
                  <InputLabel>相关性</InputLabel>
                  <Select
                    value={relevance}
                    label="相关性"
                    onChange={(e) => setRelevance(e.target.value)}
                  >
                    <MenuItem value="all">全部</MenuItem>
                    <MenuItem value="high">高相关</MenuItem>
                    <MenuItem value="medium">中相关</MenuItem>
                    <MenuItem value="low">低相关</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* 重置按钮 */}
              <Grid item xs={12} sm={6} md={timeRange === 'custom' ? 2 : 3}>
                <Button variant="outlined" fullWidth onClick={handleResetFilters}>
                  重置筛选
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* 错误提示 */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* 加载状态 */}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {/* 推送列表 */}
        {!loading && pushHistory.length === 0 && (
          <Alert severity="info">暂无推送历史</Alert>
        )}

        {!loading && pushHistory.length > 0 && (
          <>
            <Grid container spacing={2}>
              {pushHistory.map((push) => (
                <Grid item xs={12} key={push.id}>
                  <Card
                    sx={{
                      borderLeft: push.isRead ? 'none' : '4px solid #1976d2',
                      cursor: 'pointer',
                      '&:hover': {
                        boxShadow: 3,
                      },
                    }}
                    onClick={() => handleViewDetail(push)}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          <Chip
                            label={getRadarTypeLabel(push.radarType)}
                            color={getRadarTypeColor(push.radarType)}
                            size="small"
                          />
                          <Typography variant="body2" color="text.secondary">
                            {getRelevanceIcon(push.relevanceLevel)}{' '}
                            {getRelevanceLabel(push.relevanceLevel)}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          <Typography variant="body2" color="text.secondary">
                            {formatRelativeTime(push.sentAt)}
                          </Typography>
                          {push.isRead && (
                            <Chip label="已读" size="small" variant="outlined" />
                          )}
                        </Box>
                      </Box>

                      <Typography variant="h6" gutterBottom>
                        {push.title}
                      </Typography>

                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {push.summary}
                      </Typography>

                      {/* 行业雷达：显示匹配的同业机构 */}
                      {push.radarType === 'industry' && push.matchedPeers && push.matchedPeers.length > 0 && (
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            与您关注的 {push.matchedPeers.join('、')} 相关
                          </Typography>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>

            {/* HIGH-3 修复: 无限滚动加载指示器 */}
            <Box ref={observerTarget} sx={{ display: 'flex', justifyContent: 'center', mt: 3, mb: 2 }}>
              {loadingMore && <CircularProgress size={24} />}
              {!hasMore && pushHistory.length > 0 && (
                <Typography variant="body2" color="text.secondary">
                  没有更多推送了
                </Typography>
              )}
            </Box>
          </>
        )}

        {/* HIGH-2 修复: 推送详情弹窗 */}
        <PushDetailModal
          open={detailModalOpen}
          push={selectedPush}
          onClose={handleCloseDetail}
          onMarkAsRead={handleMarkAsRead}
        />
      </Box>
    </LocalizationProvider>
  )
}
