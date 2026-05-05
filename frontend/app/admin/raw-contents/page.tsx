'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { RefreshCw, Eye, Loader2, X, FileText } from 'lucide-react'
import { toast } from 'sonner'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import {
  RawContent,
  RawContentStatus,
  RawContentCategory,
  RawContentSource,
  RawContentStats,
  getRawContents,
  getRawContentStats,
  getRawContentById,
  reanalyzeRawContent,
  deleteRawContent,
} from '@/lib/api/raw-content'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { PageHeader } from '@/components/ui/page-header'
import { AlertCircle } from 'lucide-react'

// Constants
const DEFAULT_PAGE_SIZE = 10

// 配置 dayjs
dayjs.locale('zh-cn')

// 解码 HTML 实体
function decodeHtmlEntities(text: string | null | undefined): string {
  if (!text) return ''
  const textarea = document.createElement('textarea')
  textarea.innerHTML = text
  return textarea.value
}

/**
 * RawContent 管理页面
 *
 * 功能：
 * - 显示统计卡片
 * - 筛选功能（状态、分类、来源、搜索）
 * - 内容列表表格
 * - 分页
 * - 详情对话框
 */
export default function RawContentsPage() {
  const router = useRouter()
  const { data: session } = useSession()

  // 权限检查：只允许 admin 和 consultant 访问
  useEffect(() => {
    if (session?.user && !['admin', 'consultant'].includes(session.user.role)) {
      router.push('/')
    }
  }, [session, router])

  // 列表数据
  const [rawContents, setRawContents] = useState<RawContent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: DEFAULT_PAGE_SIZE,
    total: 0,
    totalPages: 0,
  })

  // 统计数据
  const [stats, setStats] = useState<RawContentStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)

  // 筛选条件
  const [statusFilter, setStatusFilter] = useState<RawContentStatus | 'all'>('all')
  const [categoryFilter, setCategoryFilter] = useState<RawContentCategory | 'all'>('all')
  const [sourceFilter, setSourceFilter] = useState<RawContentSource | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // 详情对话框
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedContent, setSelectedContent] = useState<RawContent | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // 初始加载
  useEffect(() => {
    loadStats()
  }, [])

  // 筛选条件变化时重新加载列表
  useEffect(() => {
    loadRawContents()
  }, [pagination.page, statusFilter, categoryFilter, sourceFilter])

  // 加载统计数据
  const loadStats = async () => {
    try {
      setStatsLoading(true)
      const data = await getRawContentStats()
      setStats(data)
    } catch (err: any) {
      console.error('加载统计数据失败:', err)
      toast.error('加载统计数据失败: ' + (err.message || '未知错误'))
    } finally {
      setStatsLoading(false)
    }
  }

  // 加载RawContent列表
  const loadRawContents = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await getRawContents({
        page: pagination.page,
        limit: pagination.limit,
        status: statusFilter,
        category: categoryFilter,
        source: sourceFilter,
        keyword: searchQuery || undefined,
      })

      setRawContents(response.data)
      setPagination((prev) => ({
        ...prev,
        total: response.total,
        totalPages: Math.ceil(response.total / response.limit),
      }))
    } catch (err: any) {
      setError(err.message || '加载数据失败')
    } finally {
      setLoading(false)
    }
  }

  // 搜索处理
  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, page: 1 }))
    loadRawContents()
  }

  // 清除筛选
  const handleClearFilters = () => {
    setStatusFilter('all')
    setCategoryFilter('all')
    setSourceFilter('all')
    setSearchQuery('')
    setPagination((prev) => ({ ...prev, page: 1 }))
  }

  // 打开详情对话框
  const handleViewDetail = async (content: RawContent) => {
    try {
      setDetailLoading(true)
      const detail = await getRawContentById(content.id)
      setSelectedContent(detail)
      setDetailOpen(true)
    } catch (err: any) {
      toast.error(err.message || '加载详情失败')
    } finally {
      setDetailLoading(false)
    }
  }

  // 关闭详情对话框
  const handleCloseDetail = () => {
    setDetailOpen(false)
    setSelectedContent(null)
  }

  // 重新分析
  const handleReanalyze = async (id: string) => {
    try {
      await reanalyzeRawContent(id)
      toast.success('重新分析已触发')
      loadRawContents()
      loadStats()
    } catch (err: any) {
      toast.error(err.message || '重新分析失败')
    }
  }

  // 删除
  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这条内容吗？')) return

    try {
      await deleteRawContent(id)
      toast.success('删除成功')
      loadRawContents()
      loadStats()
    } catch (err: any) {
      toast.error(err.message || '删除失败')
    }
  }

  // 获取状态颜色
  const getStatusColor = (status: RawContentStatus): string => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-600 text-white'
      case 'analyzing':
        return 'bg-blue-600 text-white'
      case 'analyzed':
        return 'bg-[#059669] text-white'
      case 'failed':
        return 'bg-red-600 text-white'
      default:
        return 'bg-[#94A3B8] text-white'
    }
  }

  // 获取状态文本
  const getStatusLabel = (status: RawContentStatus) => {
    switch (status) {
      case 'pending':
        return '待分析'
      case 'analyzing':
        return '分析中'
      case 'analyzed':
        return '已分析'
      case 'failed':
        return '失败'
      default:
        return status
    }
  }

  // 获取来源文本
  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'wechat':
        return '微信公众号'
      case 'website':
        return '网站'
      default:
        return source
    }
  }

  // 获取分类文本
  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'tech':
        return '技术'
      case 'compliance':
        return '合规'
      case 'industry':
        return '行业'
      case 'policy':
        return '政策'
      default:
        return category
    }
  }

  // 统计卡片数据
  const statCards = [
    { key: 'pending', label: '待分析', color: 'text-yellow-600' as const },
    { key: 'analyzing', label: '分析中', color: 'text-blue-600' as const },
    { key: 'analyzed', label: '已分析', color: 'text-[#059669]' as const },
    { key: 'failed', label: '失败', color: 'text-red-600' as const },
    { key: 'todayImported', label: '今日导入', color: 'text-[#1E3A5F]' as const },
  ]

  return (
    <div className="p-6 bg-[#FEFDFB] min-h-screen">
      <PageHeader
        title="文件导入管理"
        description="集中查看雷达采集内容、解析状态和重新分析任务"
        icon={<FileText className="h-6 w-6" />}
        variant="default"
        className="p-8"
      />

      {/* 统计卡片区域 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {statCards.map((stat) => (
          <Card key={stat.key} className="border-[#E2E8F0] rounded-sm shadow-sm">
            <CardContent className="p-4 text-center">
              {statsLoading ? (
                <Loader2 className="w-8 h-8 animate-spin text-[#94A3B8] mx-auto" />
              ) : (
                <p className={`text-4xl font-bold ${stat.color}`}>
                  {stats?.[stat.key as keyof RawContentStats] ?? 0}
                </p>
              )}
              <p className="text-sm text-[#94A3B8] mt-1">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 筛选区域 */}
      <Card className="mb-6 border-[#E2E8F0] rounded-sm shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
            {/* 状态下拉框 */}
            <div className="space-y-2">
              <Label htmlFor="status-filter">状态</Label>
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as RawContentStatus | 'all')}
              >
                <SelectTrigger className="rounded-sm" id="status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="pending">待分析</SelectItem>
                  <SelectItem value="analyzing">分析中</SelectItem>
                  <SelectItem value="analyzed">已分析</SelectItem>
                  <SelectItem value="failed">失败</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 分类下拉框 */}
            <div className="space-y-2">
              <Label htmlFor="category-filter">分类</Label>
              <Select
                value={categoryFilter}
                onValueChange={(v) => setCategoryFilter(v as RawContentCategory | 'all')}
              >
                <SelectTrigger className="rounded-sm" id="category-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="tech">技术</SelectItem>
                  <SelectItem value="industry">行业</SelectItem>
                  <SelectItem value="compliance">合规</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 来源下拉框 */}
            <div className="space-y-2">
              <Label htmlFor="source-filter">来源</Label>
              <Select
                value={sourceFilter}
                onValueChange={(v) => setSourceFilter(v as RawContentSource | 'all')}
              >
                <SelectTrigger className="rounded-sm" id="source-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="wechat">微信公众号</SelectItem>
                  <SelectItem value="website">网站</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 搜索框 */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="search">搜索</Label>
              <div className="relative">
                <Input
                  id="search"
                  placeholder="搜索标题..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="rounded-sm pr-8"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#1E3A5F]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* 清除筛选按钮 */}
            <div className="flex items-end">
              <Button variant="outline" onClick={handleClearFilters} className="rounded-sm w-full">
                <X className="w-4 h-4 mr-2" />
                清除筛选
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 错误提示 */}
      {error && (
        <Alert variant="destructive" className="mb-6 rounded-sm">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 内容列表表格 */}
      <Card className="border-[#E2E8F0] rounded-sm shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#1E3A5F] hover:bg-[#1E3A5F]">
                  <TableHead className="text-white">标题</TableHead>
                  <TableHead className="text-white">来源</TableHead>
                  <TableHead className="text-white">分类</TableHead>
                  <TableHead className="text-white">状态</TableHead>
                  <TableHead className="text-white">导入时间</TableHead>
                  <TableHead className="text-white text-center">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin text-[#1E3A5F] mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : rawContents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <p className="text-[#94A3B8]">暂无数据</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  rawContents.map((content) => (
                    <TableRow key={content.id} className="hover:bg-[#FEFDFB]">
                      <TableCell className="max-w-xs truncate">{content.title}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="rounded-sm border-[#94A3B8] text-[#94A3B8]"
                        >
                          {getSourceLabel(content.source)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="rounded-sm border-[#1E3A5F] text-[#1E3A5F]"
                        >
                          {getCategoryLabel(content.category)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`rounded-sm ${getStatusColor(content.status)}`}>
                          {getStatusLabel(content.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>{dayjs(content.createdAt).format('YYYY-MM-DD HH:mm')}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => handleViewDetail(content)}
                                  className="p-2 hover:bg-[#E2E8F0] rounded-sm"
                                >
                                  <Eye className="w-4 h-4 text-[#1E3A5F]" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>查看详情</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => handleReanalyze(content.id)}
                                  className="p-2 hover:bg-[#E2E8F0] rounded-sm"
                                >
                                  <RefreshCw className="w-4 h-4 text-[#059669]" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>重新分析</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => handleDelete(content.id)}
                                  className="p-2 hover:bg-red-50 rounded-sm text-red-600"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>删除</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* 分页 */}
          {!loading && rawContents.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-[#E2E8F0]">
              <p className="text-sm text-[#94A3B8]">
                显示 {pagination.page * pagination.limit - pagination.limit + 1} -{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} 共{' '}
                {pagination.total} 条
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page === 1}
                  className="h-8 rounded-sm"
                >
                  上一页
                </Button>
                <span className="text-sm text-[#94A3B8]">
                  第 {pagination.page} / {pagination.totalPages} 页
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page >= pagination.totalPages}
                  className="h-8 rounded-sm"
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 详情对话框 */}
      <Dialog open={detailOpen} onOpenChange={handleCloseDetail}>
        <DialogContent className="rounded-sm max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#1E3A5F] font-[var(--font-plus-jakarta)]">
              内容详情
              {detailLoading && <Loader2 className="w-4 h-4 ml-2 animate-spin inline" />}
            </DialogTitle>
          </DialogHeader>
          {selectedContent && (
            <div className="space-y-4">
              {/* 基本信息网格 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-[#94A3B8]">标题</p>
                  <p className="font-medium">{selectedContent.title}</p>
                </div>
                <div>
                  <p className="text-sm text-[#94A3B8]">来源</p>
                  <Badge variant="outline" className="rounded-sm border-[#94A3B8] text-[#94A3B8]">
                    {getSourceLabel(selectedContent.source)}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-[#94A3B8]">分类</p>
                  <Badge variant="outline" className="rounded-sm border-[#1E3A5F] text-[#1E3A5F]">
                    {getCategoryLabel(selectedContent.category)}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-[#94A3B8]">状态</p>
                  <Badge className={`rounded-sm ${getStatusColor(selectedContent.status)}`}>
                    {getStatusLabel(selectedContent.status)}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-[#94A3B8]">导入时间</p>
                  <p className="text-sm">
                    {dayjs(selectedContent.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-[#94A3B8]">更新时间</p>
                  <p className="text-sm">
                    {dayjs(selectedContent.updatedAt).format('YYYY-MM-DD HH:mm:ss')}
                  </p>
                </div>
              </div>

              {/* 错误信息 */}
              {selectedContent.status === 'failed' && selectedContent.errorMessage && (
                <Alert variant="destructive" className="rounded-sm">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-semibold">错误信息：</p>
                    <p>{selectedContent.errorMessage}</p>
                  </AlertDescription>
                </Alert>
              )}

              {/* 内容预览 */}
              <div>
                <p className="text-sm text-[#94A3B8] mb-2">
                  内容预览（共 {selectedContent.fullContent?.length || 0} 字符）
                </p>
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-sm p-4 max-h-64 overflow-auto">
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {decodeHtmlEntities(selectedContent.fullContent)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
