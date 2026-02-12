'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  Container,
  Box,
  Alert,
  Snackbar,
  IconButton,
  Typography,
  Tabs,
  Tab,
} from '@mui/material'
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material'
import { PeerCrawlerSourceList } from '@/components/admin/PeerCrawlerSourceList'
import { PeerCrawlerSourceForm } from '@/components/admin/PeerCrawlerSourceForm'
import { TestCrawlDialog } from '@/components/admin/TestCrawlDialog'
import {
  RadarSource,
  getRadarSources,
  createRadarSource,
  updateRadarSource,
  deleteRadarSource,
  toggleRadarSourceActive,
  testRadarSourceCrawl,
  CreateRadarSourceData,
  UpdateRadarSourceData,
} from '@/lib/api/radar-sources'

/**
 * 同业采集源管理页面
 *
 * Story 8.1: 同业采集源管理
 *
 * 功能：
 * - 显示同业采集源列表（category=industry）
 * - 按来源类型筛选（website/wechat/recruitment/conference）
 * - 创建、编辑、删除采集源
 * - 启用/禁用采集源
 * - 测试采集功能
 */
export default function PeerCrawlerPage() {
  const router = useRouter()
  const { data: session } = useSession()

  // 权限检查：只允许 admin 和 consultant 访问
  useEffect(() => {
    if (session?.user && !['admin', 'consultant'].includes(session.user.role)) {
      router.push('/')
    }
  }, [session, router])

  const [sources, setSources] = useState<RadarSource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editingSource, setEditingSource] = useState<RadarSource | null>(null)
  const [testDialogOpen, setTestDialogOpen] = useState(false)
  const [testingSource, setTestingSource] = useState<RadarSource | null>(null)
  const [testResult, setTestResult] = useState<any>(null)
  const [snackbar, setSnackbar] = useState<{
    open: boolean
    message: string
    severity: 'success' | 'error' | 'info'
  }>({
    open: false,
    message: '',
    severity: 'success',
  })

  // 返回上一页
  const handleBack = () => {
    router.push('/admin/dashboard')
  }

  // 加载同业采集源列表
  const loadSources = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await getRadarSources({ category: 'industry' })
      setSources(response.data)
    } catch (err: any) {
      setError(err.message || '加载采集源失败')
      showSnackbar('加载采集源失败', 'error')
    } finally {
      setLoading(false)
    }
  }

  // 初始加载
  useEffect(() => {
    loadSources()
  }, [])

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

  // 打开创建表单
  const handleCreate = () => {
    setEditingSource(null)
    setFormOpen(true)
  }

  // 打开编辑表单
  const handleEdit = (source: RadarSource) => {
    setEditingSource(source)
    setFormOpen(true)
  }

  // 关闭表单
  const handleCloseForm = () => {
    setFormOpen(false)
    setEditingSource(null)
  }

  // 提交表单
  const handleSubmitForm = async (
    data: CreateRadarSourceData | UpdateRadarSourceData,
  ) => {
    try {
      if (editingSource) {
        // 更新
        await updateRadarSource(editingSource.id, data as UpdateRadarSourceData)
        showSnackbar('采集源更新成功', 'success')
      } else {
        // 创建（固定category为industry）
        await createRadarSource({
          ...(data as CreateRadarSourceData),
          category: 'industry',
        })
        showSnackbar('采集源创建成功', 'success')
      }
      await loadSources()
      handleCloseForm()
    } catch (err: any) {
      throw new Error(err.message || '操作失败')
    }
  }

  // 删除采集源
  const handleDelete = async (id: string) => {
    try {
      await deleteRadarSource(id)
      showSnackbar('采集源删除成功', 'success')
      await loadSources()
    } catch (err: any) {
      showSnackbar(err.message || '删除失败', 'error')
    }
  }

  // 切换启用状态
  const handleToggleActive = async (id: string) => {
    try {
      await toggleRadarSourceActive(id)
      showSnackbar('状态更新成功', 'success')
      await loadSources()
    } catch (err: any) {
      showSnackbar(err.message || '状态更新失败', 'error')
    }
  }

  // 测试采集
  const handleTestCrawl = async (source: RadarSource) => {
    setTestingSource(source)
    setTestDialogOpen(true)
    setTestResult(null)

    try {
      const result = await testRadarSourceCrawl(source.id)
      setTestResult(result.data)
    } catch (err: any) {
      showSnackbar(err.message || '测试采集失败', 'error')
      setTestResult({ success: false, error: err.message })
    }
  }

  // 关闭测试对话框
  const handleCloseTestDialog = () => {
    setTestDialogOpen(false)
    setTestingSource(null)
    setTestResult(null)
  }

  // 按类型筛选
  const filteredSources =
    typeFilter === 'all'
      ? sources
      : sources.filter((s) => s.type === typeFilter)

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box>
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
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            同业采集源管理
          </Typography>
          <Typography variant="body1" color="text.secondary">
            配置和管理同业采集源（官网、公众号、知乎、会议等）
          </Typography>
        </Box>

        {/* 类型筛选标签 */}
        <Box sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={typeFilter}
            onChange={(_, value) => setTypeFilter(value)}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab label="全部" value="all" />
            <Tab label="官网" value="website" />
            <Tab label="公众号" value="wechat" />
            <Tab label="招聘" value="recruitment" />
            <Tab label="会议" value="conference" />
          </Tabs>
        </Box>

        {/* 采集源列表 */}
        <PeerCrawlerSourceList
          sources={filteredSources}
          loading={loading}
          error={error}
          onEdit={handleEdit}
          onCreate={handleCreate}
          onDelete={handleDelete}
          onToggleActive={handleToggleActive}
          onTestCrawl={handleTestCrawl}
        />

        {/* 创建/编辑表单 */}
        <PeerCrawlerSourceForm
          open={formOpen}
          source={editingSource}
          onClose={handleCloseForm}
          onSubmit={handleSubmitForm}
        />

        {/* 测试采集对话框 */}
        <TestCrawlDialog
          open={testDialogOpen}
          source={testingSource}
          result={testResult}
          onClose={handleCloseTestDialog}
        />

        {/* 提示消息 */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
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
    </Container>
  )
}
