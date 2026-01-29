'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Container, Box, Alert, Snackbar, IconButton } from '@mui/material'
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material'
import { RadarSourceList } from '@/components/admin/RadarSourceList'
import { RadarSourceForm } from '@/components/admin/RadarSourceForm'
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
 * 雷达信息源配置管理页面
 *
 * Story 3.1: 配置行业雷达信息源
 *
 * 功能：
 * - 显示所有信息源配置
 * - 创建、编辑、删除信息源
 * - 启用/禁用信息源
 * - 测试爬虫功能
 */
export default function RadarSourcesPage() {
  const router = useRouter()
  const [sources, setSources] = useState<RadarSource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingSource, setEditingSource] = useState<RadarSource | null>(null)
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
    router.push('/dashboard')
  }

  // 加载信息源列表
  const loadSources = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await getRadarSources()
      setSources(response.data)
    } catch (err: any) {
      setError(err.message || '加载信息源失败')
      showSnackbar('加载信息源失败', 'error')
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
        showSnackbar('信息源更新成功', 'success')
      } else {
        // 创建
        await createRadarSource(data as CreateRadarSourceData)
        showSnackbar('信息源创建成功', 'success')
      }
      await loadSources()
      handleCloseForm()
    } catch (err: any) {
      throw new Error(err.message || '操作失败')
    }
  }

  // 删除信息源
  const handleDelete = async (id: string) => {
    try {
      await deleteRadarSource(id)
      showSnackbar('信息源删除成功', 'success')
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

  // 测试爬虫
  const handleTestCrawl = async (id: string) => {
    try {
      await testRadarSourceCrawl(id)
      showSnackbar('测试爬虫任务已加入队列', 'info')
    } catch (err: any) {
      showSnackbar(err.message || '测试爬虫失败', 'error')
    }
  }

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

        {/* 信息源列表 */}
        <RadarSourceList
          sources={sources}
          loading={loading}
          error={error}
          onEdit={handleEdit}
          onCreate={handleCreate}
          onDelete={handleDelete}
          onToggleActive={handleToggleActive}
          onTestCrawl={handleTestCrawl}
        />

        {/* 创建/编辑表单 */}
        <RadarSourceForm
          open={formOpen}
          source={editingSource}
          onClose={handleCloseForm}
          onSubmit={handleSubmitForm}
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
