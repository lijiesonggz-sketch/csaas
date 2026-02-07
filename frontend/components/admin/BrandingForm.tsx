/**
 * BrandingForm Component
 *
 * Story 6.3: 白标输出功能
 *
 * 品牌配置表单组件
 * - Logo 上传 (拖拽支持)
 * - 颜色选择器 (预设色板 + HEX 输入)
 * - 公司信息输入
 * - 邮件签名
 */

import React, { useState, useRef, ChangeEvent } from 'react'
import {
  Box,
  Button,
  TextField,
  Typography,
  IconButton,
  Avatar,
  Stack,
  Divider,
  Tooltip,
  Alert,
} from '@mui/material'
import {
  CloudUpload as UploadIcon,
  Delete as DeleteIcon,
  RestartAlt as ResetIcon,
} from '@mui/icons-material'
import { BrandingConfig, UpdateBrandingData } from '@/lib/api/branding'

interface BrandingFormProps {
  config: BrandingConfig
  onUpdate: (data: UpdateBrandingData) => Promise<void>
  onUploadLogo: (file: File) => Promise<void>
  onReset: () => Promise<void>
  saving: boolean
  uploading: boolean
}

// 预设颜色色板
const PRESET_COLORS = [
  '#1890ff', // 默认蓝色
  '#52c41a', // 绿色
  '#fa8c16', // 橙色
  '#f5222d', // 红色
  '#722ed1', // 紫色
  '#13c2c2', // 青色
  '#eb2f96', // 粉色
  '#2f54eb', // 深蓝色
]

export function BrandingForm({
  config,
  onUpdate,
  onUploadLogo,
  onReset,
  saving,
  uploading,
}: BrandingFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [formData, setFormData] = useState<UpdateBrandingData>({
    brandPrimaryColor: config.brandPrimaryColor,
    brandSecondaryColor: config.brandSecondaryColor,
    companyName: config.companyName,
    emailSignature: config.emailSignature,
    contactPhone: config.contactPhone,
    contactEmail: config.contactEmail,
  })
  const [dragActive, setDragActive] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // 处理表单字段变化
  const handleChange = (field: keyof UpdateBrandingData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    // 清除该字段的错误
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  // 验证表单
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    // 验证邮箱格式
    if (formData.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail)) {
      newErrors.contactEmail = '请输入有效的邮箱地址'
    }

    // 验证电话格式 (简单验证)
    if (formData.contactPhone && !/^[\d\s\-+()]+$/.test(formData.contactPhone)) {
      newErrors.contactPhone = '请输入有效的电话号码'
    }

    // 验证颜色格式
    if (formData.brandPrimaryColor && !/^#[0-9A-Fa-f]{6}$/.test(formData.brandPrimaryColor)) {
      newErrors.brandPrimaryColor = '请输入有效的颜色代码 (例如: #1890ff)'
    }

    if (
      formData.brandSecondaryColor &&
      formData.brandSecondaryColor.trim() !== '' &&
      !/^#[0-9A-Fa-f]{6}$/.test(formData.brandSecondaryColor)
    ) {
      newErrors.brandSecondaryColor = '请输入有效的颜色代码 (例如: #1890ff)'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // 提交表单
  const handleSubmit = async () => {
    if (!validateForm()) {
      return
    }

    try {
      await onUpdate(formData)
    } catch (err) {
      // 错误已在父组件处理
    }
  }

  // 处理文件选择
  const handleFileSelect = async (file: File) => {
    // 验证文件类型
    const validTypes = ['image/png', 'image/jpeg', 'image/svg+xml']
    if (!validTypes.includes(file.type)) {
      setErrors({ logo: '仅支持 PNG、JPG 或 SVG 格式' })
      return
    }

    // 验证文件大小 (2MB)
    if (file.size > 2 * 1024 * 1024) {
      setErrors({ logo: '文件大小不能超过 2MB' })
      return
    }

    try {
      await onUploadLogo(file)
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors.logo
        return newErrors
      })
    } catch (err) {
      // 错误已在父组件处理
    }
  }

  // 处理文件输入变化
  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  // 处理拖拽
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  // 处理文件放置
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  // 打开文件选择器
  const handleClickUpload = () => {
    fileInputRef.current?.click()
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        品牌配置
      </Typography>

      <Stack spacing={3}>
        {/* Logo 上传 */}
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            品牌 Logo
          </Typography>
          <Box
            sx={{
              border: '2px dashed',
              borderColor: dragActive ? 'primary.main' : 'divider',
              borderRadius: 2,
              p: 3,
              textAlign: 'center',
              backgroundColor: dragActive ? 'action.hover' : 'background.paper',
              cursor: 'pointer',
              transition: 'all 0.2s',
              '&:hover': {
                borderColor: 'primary.main',
                backgroundColor: 'action.hover',
              },
            }}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={handleClickUpload}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml"
              style={{ display: 'none' }}
              onChange={handleFileInputChange}
              disabled={uploading}
            />

            {config.brandLogoUrl ? (
              <Box>
                <Avatar
                  src={config.brandLogoUrl}
                  alt="Brand Logo"
                  sx={{ width: 120, height: 120, mx: 'auto', mb: 2 }}
                  variant="rounded"
                />
                <Typography variant="body2" color="text.secondary">
                  点击或拖拽文件以更换 Logo
                </Typography>
              </Box>
            ) : (
              <Box>
                <UploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  点击或拖拽文件上传 Logo
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  支持 PNG、JPG、SVG 格式，最大 2MB
                </Typography>
              </Box>
            )}
          </Box>
          {errors.logo && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {errors.logo}
            </Alert>
          )}
          {uploading && (
            <Typography variant="caption" color="primary" sx={{ mt: 1, display: 'block' }}>
              上传中...
            </Typography>
          )}
        </Box>

        <Divider />

        {/* 主题色选择 */}
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            主题色
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
            {PRESET_COLORS.map((color) => (
              <Tooltip key={color} title={color}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    backgroundColor: color,
                    borderRadius: 1,
                    cursor: 'pointer',
                    border: '2px solid',
                    borderColor:
                      formData.brandPrimaryColor === color ? 'text.primary' : 'transparent',
                    '&:hover': {
                      borderColor: 'text.secondary',
                    },
                  }}
                  onClick={() => handleChange('brandPrimaryColor', color)}
                />
              </Tooltip>
            ))}
          </Box>
          <TextField
            fullWidth
            label="自定义颜色 (HEX)"
            value={formData.brandPrimaryColor}
            onChange={(e) => handleChange('brandPrimaryColor', e.target.value)}
            placeholder="#1890ff"
            error={!!errors.brandPrimaryColor}
            helperText={errors.brandPrimaryColor}
            InputProps={{
              startAdornment: (
                <Box
                  sx={{
                    width: 24,
                    height: 24,
                    backgroundColor: formData.brandPrimaryColor,
                    borderRadius: 1,
                    mr: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                />
              ),
            }}
          />
        </Box>

        {/* 辅助色 (可选) */}
        <TextField
          fullWidth
          label="辅助色 (可选)"
          value={formData.brandSecondaryColor || ''}
          onChange={(e) => handleChange('brandSecondaryColor', e.target.value)}
          placeholder="#52c41a"
          error={!!errors.brandSecondaryColor}
          helperText={errors.brandSecondaryColor || '用于次要按钮和强调元素'}
          InputProps={{
            startAdornment: formData.brandSecondaryColor ? (
              <Box
                sx={{
                  width: 24,
                  height: 24,
                  backgroundColor: formData.brandSecondaryColor,
                  borderRadius: 1,
                  mr: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              />
            ) : null,
          }}
        />

        <Divider />

        {/* 公司信息 */}
        <Typography variant="subtitle2">公司信息</Typography>

        <TextField
          fullWidth
          label="公司名称"
          value={formData.companyName || ''}
          onChange={(e) => handleChange('companyName', e.target.value)}
          placeholder="您的公司名称"
          helperText="将显示在推送内容和邮件中"
        />

        <TextField
          fullWidth
          label="联系邮箱"
          value={formData.contactEmail || ''}
          onChange={(e) => handleChange('contactEmail', e.target.value)}
          placeholder="contact@example.com"
          error={!!errors.contactEmail}
          helperText={errors.contactEmail}
        />

        <TextField
          fullWidth
          label="联系电话"
          value={formData.contactPhone || ''}
          onChange={(e) => handleChange('contactPhone', e.target.value)}
          placeholder="+86 138-0000-0000"
          error={!!errors.contactPhone}
          helperText={errors.contactPhone}
        />

        <TextField
          fullWidth
          multiline
          rows={4}
          label="邮件签名"
          value={formData.emailSignature || ''}
          onChange={(e) => handleChange('emailSignature', e.target.value)}
          placeholder="此致&#10;敬礼&#10;&#10;您的公司名称"
          helperText="将显示在邮件底部"
        />

        <Divider />

        {/* 操作按钮 */}
        <Stack direction="row" spacing={2}>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={saving || uploading}
            fullWidth
          >
            {saving ? '保存中...' : '保存配置'}
          </Button>
          <Button
            variant="outlined"
            color="secondary"
            startIcon={<ResetIcon />}
            onClick={onReset}
            disabled={saving || uploading}
          >
            重置
          </Button>
        </Stack>
      </Stack>
    </Box>
  )
}
