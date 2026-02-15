'use client'

import React, { useState, useEffect } from 'react'

// Constants
const DEFAULT_PAGE_SIZE = 10
const CONTENT_PREVIEW_LENGTH = 500
const SNACKBAR_DURATION = 6000
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Pagination,
  Alert,
  Snackbar,
  Tooltip,
  CircularProgress,
} from '@mui/material'
import {
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  ArrowBack as ArrowBackIcon,
  Clear as ClearIcon,
} from '@mui/icons-material'
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

  // 提示消息
  const [snackbar, setSnackbar] = useState<{
    open: boolean
    message: string
    severity: 'success' | 'error' | 'info'
  }>({
    open: false,
    message: '',
    severity: 'success',
  })

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
      showSnackbar('加载统计数据失败: ' + (err.message || '未知错误'), 'error')
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
      showSnackbar(err.message || '加载详情失败', 'error')
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
      showSnackbar('重新分析已触发', 'success')
      loadRawContents()
      loadStats()
    } catch (err: any) {
      showSnackbar(err.message || '重新分析失败', 'error')
    }
  }

  // 删除
  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这条内容吗？')) return

    try {
      await deleteRawContent(id)
      showSnackbar('删除成功', 'success')
      loadRawContents()
      loadStats()
    } catch (err: any) {
      showSnackbar(err.message || '删除失败', 'error')
    }
  }

  // 显示提示消息
  const showSnackbar = (
    message: string,
    severity: 'success' | 'error' | 'info' = 'success',
  ) => {
    setSnackbar({ open: true, message, severity })
  }

  // 关闭提示消息
  const handleCloseSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }))
  }

  // 返回上一页
  const handleBack = () => {
    router.push('/dashboard')
  }

  // 获取状态颜色
  const getStatusColor = (status: RawContentStatus) => {
    switch (status) {
      case 'pending':
        return 'warning'
      case 'analyzing':
        return 'info'
      case 'analyzed':
        return 'success'
      case 'failed':
        return 'error'
      default:
        return 'default'
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
    { key: 'pending', label: '待分析', color: 'warning' as const },
    { key: 'analyzing', label: '分析中', color: 'info' as const },
    { key: 'analyzed', label: '已分析', color: 'success' as const },
    { key: 'failed', label: '失败', color: 'error' as const },
    { key: 'todayImported', label: '今日导入', color: 'default' as const },
  ]

  return (
    <Box sx={{ p: 3 }}>
      {/* 返回按钮 */}
      <Box sx={{ mb: 2 }}>
        <IconButton
          onClick={handleBack}
          sx={{
            color: 'primary.main',
            '&:hover': {
              backgroundColor: 'primary.light',
              color: 'white',
            },
          }}
        >
          <ArrowBackIcon />
        </IconButton>
      </Box>

      {/* 页面标题 */}
      <Typography variant="h4" gutterBottom>
        文件导入管理
      </Typography>

      {/* 统计卡片区域 */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {statCards.map((stat) => (
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }} key={stat.key}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color={`${stat.color}.main`} gutterBottom>
                  {statsLoading ? (
                    <CircularProgress size={32} />
                  ) : (
                    stats?.[stat.key as keyof RawContentStats] ?? 0
                  )}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {stat.label}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* 筛选区域 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            {/* 状态下拉框 */}
            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
              <FormControl fullWidth size="small">
                <InputLabel>状态</InputLabel>
                <Select
                  value={statusFilter}
                  label="状态"
                  onChange={(e) => setStatusFilter(e.target.value as RawContentStatus | 'all')}
                >
                  <MenuItem value="all">全部</MenuItem>
                  <MenuItem value="pending">待分析</MenuItem>
                  <MenuItem value="analyzing">分析中</MenuItem>
                  <MenuItem value="analyzed">已分析</MenuItem>
                  <MenuItem value="failed">失败</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* 分类下拉框 */}
            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
              <FormControl fullWidth size="small">
                <InputLabel>分类</InputLabel>
                <Select
                  value={categoryFilter}
                  label="分类"
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <MenuItem value="all">全部</MenuItem>
                  <MenuItem value="tech">技术</MenuItem>
                  <MenuItem value="industry">行业</MenuItem>
                  <MenuItem value="compliance">合规</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* 来源下拉框 */}
            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
              <FormControl fullWidth size="small">
                <InputLabel>来源</InputLabel>
                <Select
                  value={sourceFilter}
                  label="来源"
                  onChange={(e) => setSourceFilter(e.target.value)}
                >
                  <MenuItem value="all">全部</MenuItem>
                  <MenuItem value="wechat">微信公众号</MenuItem>
                  <MenuItem value="website">网站</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* 搜索框 */}
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="搜索标题..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                InputProps={{
                  endAdornment: searchQuery && (
                    <IconButton size="small" onClick={() => setSearchQuery('')}>
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  ),
                }}
              />
            </Grid>

            {/* 清除筛选按钮 */}
            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
              <Button
                variant="outlined"
                fullWidth
                onClick={handleClearFilters}
                startIcon={<ClearIcon />}
              >
                清除筛选
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

      {/* 内容列表表格 */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>标题</TableCell>
              <TableCell>来源</TableCell>
              <TableCell>分类</TableCell>
              <TableCell>状态</TableCell>
              <TableCell>导入时间</TableCell>
              <TableCell align="center">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : rawContents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">暂无数据</Typography>
                </TableCell>
              </TableRow>
            ) : (
              rawContents.map((content) => (
                <TableRow key={content.id} hover>
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{
                        maxWidth: 300,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={content.title}
                    >
                      {content.title}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getSourceLabel(content.source)}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getCategoryLabel(content.category)}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getStatusLabel(content.status)}
                      size="small"
                      color={getStatusColor(content.status)}
                    />
                  </TableCell>
                  <TableCell>
                    {dayjs(content.createdAt).format('YYYY-MM-DD HH:mm')}
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                      {/* 详情按钮 */}
                      <Tooltip title="查看详情">
                        <IconButton
                          size="small"
                          onClick={() => handleViewDetail(content)}
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>

                      {/* 重新分析按钮 */}
                      <Tooltip title="重新分析">
                        <IconButton
                          size="small"
                          onClick={() => handleReanalyze(content.id)}
                        >
                          <RefreshIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>

                      {/* 删除按钮 */}
                      <Tooltip title="删除">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDelete(content.id)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* 分页 */}
      {!loading && rawContents.length > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            count={pagination.totalPages}
            page={pagination.page}
            onChange={(_, page) => setPagination((prev) => ({ ...prev, page }))}
            color="primary"
          />
        </Box>
      )}

      {/* 详情对话框 */}
      <Dialog
        open={detailOpen}
        onClose={handleCloseDetail}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          内容详情
          {detailLoading && (
            <CircularProgress size={20} sx={{ ml: 2 }} />
          )}
        </DialogTitle>
        <DialogContent>
          {selectedContent && (
            <Box sx={{ pt: 1 }}>
              {/* 基本信息网格 */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    标题
                  </Typography>
                  <Typography variant="body1">{selectedContent.title}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    来源
                  </Typography>
                  <Chip
                    label={getSourceLabel(selectedContent.source)}
                    size="small"
                    variant="outlined"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    分类
                  </Typography>
                  <Chip
                    label={getCategoryLabel(selectedContent.category)}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    状态
                  </Typography>
                  <Chip
                    label={getStatusLabel(selectedContent.status)}
                    size="small"
                    color={getStatusColor(selectedContent.status)}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    导入时间
                  </Typography>
                  <Typography variant="body1">
                    {dayjs(selectedContent.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    更新时间
                  </Typography>
                  <Typography variant="body1">
                    {dayjs(selectedContent.updatedAt).format('YYYY-MM-DD HH:mm:ss')}
                  </Typography>
                </Grid>
              </Grid>

              {/* 错误信息（如果失败） */}
              {selectedContent.status === 'failed' && selectedContent.errorMessage && (
                <Alert severity="error" sx={{ mb: 3 }}>
                  <Typography variant="subtitle2">错误信息：</Typography>
                  <Typography variant="body2">{selectedContent.errorMessage}</Typography>
                </Alert>
              )}

              {/* 内容预览 */}
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                内容预览（共 {selectedContent.fullContent?.length || 0} 字符）
              </Typography>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  maxHeight: 400,
                  overflow: 'auto',
                  backgroundColor: 'grey.50',
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {decodeHtmlEntities(selectedContent.fullContent)}
                </Typography>
              </Paper>

              {/* AI分析结果 */}
              {(selectedContent.aiSummary || selectedContent.aiAnalysisStatus || selectedContent.complianceAnalysis) && (
                <Box sx={{ mt: 4 }}>
                  <Typography variant="h6" gutterBottom>
                    AI分析结果
                  </Typography>

                  {/* AI摘要 */}
                  {selectedContent.aiSummary && (
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        AI摘要
                      </Typography>
                      <Paper variant="outlined" sx={{ p: 2, backgroundColor: 'primary.50' }}>
                        <Typography variant="body2">{selectedContent.aiSummary}</Typography>
                      </Paper>
                    </Box>
                  )}

                  {/* AI模型和状态 */}
                  <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="subtitle2" color="text.secondary">
                        AI模型
                      </Typography>
                      <Chip
                        label={selectedContent.aiModel || '未知'}
                        size="small"
                        color="info"
                        variant="outlined"
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="subtitle2" color="text.secondary">
                        分析状态
                      </Typography>
                      <Chip
                        label={selectedContent.aiAnalysisStatus === 'success' ? '成功' : selectedContent.aiAnalysisStatus}
                        size="small"
                        color={selectedContent.aiAnalysisStatus === 'success' ? 'success' : 'default'}
                      />
                    </Grid>
                  </Grid>

                  {/* 关键词 */}
                  {selectedContent.keywords && selectedContent.keywords.length > 0 && (
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        关键词
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {selectedContent.keywords.map((keyword, index) => (
                          <Chip key={index} label={keyword} size="small" variant="outlined" />
                        ))}
                      </Box>
                    </Box>
                  )}

                  {/* 技术分类 */}
                  {selectedContent.categories && selectedContent.categories.length > 0 && (
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        技术分类
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {selectedContent.categories.map((category, index) => (
                          <Chip key={index} label={category} size="small" color="primary" variant="outlined" />
                        ))}
                      </Box>
                    </Box>
                  )}

                  {/* 合规分析结果 */}
                  {selectedContent.complianceAnalysis && (
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        合规分析
                      </Typography>
                      <Paper variant="outlined" sx={{ p: 2, backgroundColor: 'warning.50' }}>
                        {selectedContent.complianceAnalysis.complianceRiskCategory && (
                          <Box sx={{ mb: 1 }}>
                            <Typography variant="caption" color="text.secondary">风险类别：</Typography>
                            <Chip
                              label={selectedContent.complianceAnalysis.complianceRiskCategory}
                              size="small"
                              color="warning"
                              variant="outlined"
                            />
                          </Box>
                        )}
                        {selectedContent.complianceAnalysis.penaltyCase && (
                          <Box sx={{ mb: 1 }}>
                            <Typography variant="caption" color="text.secondary">处罚案例：</Typography>
                            <Typography variant="body2">{selectedContent.complianceAnalysis.penaltyCase}</Typography>
                          </Box>
                        )}
                        {selectedContent.complianceAnalysis.policyRequirements && (
                          <Box sx={{ mb: 1 }}>
                            <Typography variant="caption" color="text.secondary">政策要求：</Typography>
                            <Typography variant="body2">{selectedContent.complianceAnalysis.policyRequirements}</Typography>
                          </Box>
                        )}
                        {selectedContent.complianceAnalysis.remediationSuggestions && (
                          <Box>
                            <Typography variant="caption" color="text.secondary">整改建议：</Typography>
                            <Typography variant="body2">{selectedContent.complianceAnalysis.remediationSuggestions}</Typography>
                          </Box>
                        )}
                      </Paper>
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          {selectedContent && (
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={async () => {
                try {
                  setDetailLoading(true)
                  const detail = await getRawContentById(selectedContent.id)
                  setSelectedContent(detail)
                  showSnackbar('详情已刷新', 'success')
                } catch (err: any) {
                  showSnackbar(err.message || '刷新失败', 'error')
                } finally {
                  setDetailLoading(false)
                }
              }}
              disabled={detailLoading}
            >
              刷新
            </Button>
          )}
          {selectedContent && (
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => {
                handleCloseDetail()
                handleReanalyze(selectedContent.id)
              }}
            >
              重新分析
            </Button>
          )}
          <Button variant="contained" onClick={handleCloseDetail}>
            关闭
          </Button>
        </Box>
      </Dialog>

      {/* 提示消息 */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={SNACKBAR_DURATION}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
