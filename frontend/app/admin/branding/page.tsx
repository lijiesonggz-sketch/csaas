'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Container,
  Box,
  Paper,
  Typography,
  Alert,
  Snackbar,
  IconButton,
  CircularProgress,
} from '@mui/material'
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material'
import { BrandingForm } from '@/components/admin/BrandingForm'
import { BrandingPreview } from '@/components/admin/BrandingPreview'
import {
  BrandingConfig,
  getAdminBranding,
  updateBranding,
  uploadLogo,
  resetBranding,
  UpdateBrandingData,
} from '@/lib/api/branding'

/**
 * 品牌配置管理页面
 *
 * Story 6.3: 白标输出功能
 *
 * 功能:
 * - 上传品牌 Logo
 * - 设置主题色
 * - 配置公司信息
 * - 实时预览品牌效果
 * - 重置为默认品牌
 */
export default function BrandingPage() {
  const router = useRouter()
  const [config, setConfig] = useState<BrandingConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
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

  // 加载品牌配置
  const loadBranding = async () => {
    try {
      setLoading(true)
      const config = await getAdminBranding()
      setConfig(config)
    } catch (err: any) {
      showSnackbar(err.message || '加载品牌配置失败', 'error')
    } finally {
      setLoading(false)
    }
  }

  // 初始加载
  useEffect(() => {
    loadBranding()
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

  // 更新品牌配置
  const handleUpdateBranding = async (data: UpdateBrandingData) => {
    try {
      setSaving(true)
      const config = await updateBranding(data)
      setConfig(config)
      showSnackbar('品牌配置已更新', 'success')
    } catch (err: any) {
      showSnackbar(err.message || '更新失败', 'error')
      throw err
    } finally {
      setSaving(false)
    }
  }

  // 上传 Logo
  const handleUploadLogo = async (file: File) => {
    try {
      setUploading(true)
      const response = await uploadLogo(file)

      // 更新配置中的 Logo URL
      if (config) {
        setConfig({
          ...config,
          brandLogoUrl: response.data.brandLogoUrl,
        })
      }

      showSnackbar('Logo 已更新', 'success')
    } catch (err: any) {
      showSnackbar(err.message || 'Logo 上传失败', 'error')
      throw err
    } finally {
      setUploading(false)
    }
  }

  // 重置品牌配置
  const handleResetBranding = async () => {
    try {
      setSaving(true)
      const config = await resetBranding()
      setConfig(config)
      showSnackbar('品牌配置已重置为默认值', 'success')
    } catch (err: any) {
      showSnackbar(err.message || '重置失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    )
  }

  if (!config) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="error">无法加载品牌配置</Alert>
      </Container>
    )
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

        {/* 页面标题 */}
        <Typography variant="h4" component="h1" gutterBottom>
          品牌配置
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
          配置您的品牌标识，包括 Logo、主题色和公司信息
        </Typography>

        {/* 主要内容区域 */}
        <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', lg: 'row' } }}>
          {/* 左侧: 配置表单 */}
          <Box sx={{ flex: 1 }}>
            <Paper sx={{ p: 3 }}>
              <BrandingForm
                config={config}
                onUpdate={handleUpdateBranding}
                onUploadLogo={handleUploadLogo}
                onReset={handleResetBranding}
                saving={saving}
                uploading={uploading}
              />
            </Paper>
          </Box>

          {/* 右侧: 实时预览 */}
          <Box sx={{ flex: 1 }}>
            <Paper sx={{ p: 3, position: 'sticky', top: 24 }}>
              <BrandingPreview config={config} />
            </Paper>
          </Box>
        </Box>

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
