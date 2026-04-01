'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
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
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'

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
    if (severity === 'success') {
      toast.success(message)
    } else {
      toast.error(message)
    }
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
          logoUrl: response.data.logoUrl,
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
      throw err
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-16 px-6 bg-[#FEFDFB]">
        <div className="flex justify-center items-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-[#1E3A5F]" />
        </div>
      </div>
    )
  }

  if (!config) {
    return (
      <div className="max-w-7xl mx-auto py-16 px-6 bg-[#FEFDFB]">
        <Alert variant="destructive" className="rounded-sm">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>无法加载品牌配置</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto py-16 px-6 bg-[#FEFDFB] min-h-screen">
      {/* 返回按钮 */}
      <div className="mb-6">
        <Button
          variant="outline"
          onClick={handleBack}
          className="rounded-sm"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回
        </Button>
      </div>

      {/* 页面标题 */}
      <h1 className="text-3xl font-bold text-[#1E3A5F] font-[var(--font-plus-jakarta)] mb-2">
        品牌配置
      </h1>
      <p className="text-[#94A3B8] mb-8">
        配置您的品牌标识，包括 Logo、主题色和公司信息
      </p>

      {/* 主要内容区域 */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* 左侧: 配置表单 */}
        <div className="flex-1">
          <Card className="border-[#E2E8F0] rounded-sm shadow-sm">
            <CardContent className="p-6">
              <BrandingForm
                config={config}
                onUpdate={handleUpdateBranding}
                onUploadLogo={handleUploadLogo}
                onReset={handleResetBranding}
                saving={saving}
                uploading={uploading}
              />
            </CardContent>
          </Card>
        </div>

        {/* 右侧: 实时预览 */}
        <div className="flex-1">
          <Card className="border-[#E2E8F0] rounded-sm shadow-sm sticky top-6">
            <CardContent className="p-6">
              <BrandingPreview config={config} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
