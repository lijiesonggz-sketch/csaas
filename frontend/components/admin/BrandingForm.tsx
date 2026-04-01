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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Upload, Trash2, RotateCcw } from 'lucide-react'
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
    <div>
      <h3 className="text-lg font-semibold mb-4">品牌配置</h3>

      <div className="space-y-6">
        {/* Logo 上传 */}
        <div className="space-y-2">
          <Label>品牌 Logo</Label>
          <div
            className={`
              border-2 border-dashed rounded-md p-8 text-center cursor-pointer transition-all
              ${dragActive ? 'border-primary bg-primary/5' : 'border-border bg-background'}
              hover:border-primary hover:bg-primary/5
            `}
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
              className="hidden"
              onChange={handleFileInputChange}
              disabled={uploading}
            />

            {config.brandLogoUrl ? (
              <div>
                <div className="w-32 h-32 mx-auto mb-3 rounded-md overflow-hidden bg-muted">
                  <img
                    src={config.brandLogoUrl}
                    alt="Brand Logo"
                    className="w-full h-full object-cover"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  点击或拖拽文件以更换 Logo
                </p>
              </div>
            ) : (
              <div>
                <Upload className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  点击或拖拽文件上传 Logo
                </p>
                <p className="text-xs text-muted-foreground">
                  支持 PNG、JPG、SVG 格式，最大 2MB
                </p>
              </div>
            )}
          </div>
          {errors.logo && (
            <Alert variant="destructive">
              <AlertDescription>{errors.logo}</AlertDescription>
            </Alert>
          )}
          {uploading && (
            <p className="text-xs text-primary mt-1">上传中...</p>
          )}
        </div>

        <div className="border-t" />

        {/* 主题色选择 */}
        <div className="space-y-2">
          <Label>主题色</Label>
          <div className="flex flex-wrap gap-2 mb-3">
            {PRESET_COLORS.map((color) => (
              <TooltipProvider key={color}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className={`
                        w-10 h-10 rounded border-2 transition-all
                        ${formData.brandPrimaryColor === color
                          ? 'border-foreground'
                          : 'border-transparent hover:border-muted-foreground'
                        }
                      `}
                      style={{ backgroundColor: color }}
                      onClick={() => handleChange('brandPrimaryColor', color)}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{color}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded border"
              style={{ backgroundColor: formData.brandPrimaryColor }}
            />
            <div className="flex-1">
              <Label className="mb-1 block text-xs text-[#64748B]">自定义颜色 (HEX)</Label>
              <Input
                value={formData.brandPrimaryColor}
                onChange={(e) => handleChange('brandPrimaryColor', e.target.value)}
                placeholder="#1890ff"
              />
            </div>
          </div>
          {errors.brandPrimaryColor && (
            <p className="text-sm text-destructive">{errors.brandPrimaryColor}</p>
          )}
        </div>

        {/* 辅助色 (可选) */}
        <div className="space-y-2">
          <Label>辅助色 (可选)</Label>
          <div className="flex items-center gap-2">
            {formData.brandSecondaryColor && (
              <div
                className="w-6 h-6 rounded border"
                style={{ backgroundColor: formData.brandSecondaryColor }}
              />
            )}
            <Input
              className="flex-1"
              value={formData.brandSecondaryColor || ''}
              onChange={(e) => handleChange('brandSecondaryColor', e.target.value)}
              placeholder="#52c41a"
            />
          </div>
          {errors.brandSecondaryColor ? (
            <p className="text-sm text-destructive">{errors.brandSecondaryColor}</p>
          ) : (
            <p className="text-sm text-muted-foreground">用于次要按钮和强调元素</p>
          )}
        </div>

        <div className="border-t" />

        {/* 公司信息 */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium">公司信息</h4>

          <div className="space-y-2">
            <Label htmlFor="company-name">公司名称</Label>
            <Input
              id="company-name"
              value={formData.companyName || ''}
              onChange={(e) => handleChange('companyName', e.target.value)}
              placeholder="您的公司名称"
            />
            <p className="text-sm text-muted-foreground">将显示在推送内容和邮件中</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-email">联系邮箱</Label>
            <Input
              id="contact-email"
              type="email"
              value={formData.contactEmail || ''}
              onChange={(e) => handleChange('contactEmail', e.target.value)}
              placeholder="contact@example.com"
              className={errors.contactEmail ? 'border-destructive' : ''}
            />
            {errors.contactEmail && (
              <p className="text-sm text-destructive">{errors.contactEmail}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-phone">联系电话</Label>
            <Input
              id="contact-phone"
              value={formData.contactPhone || ''}
              onChange={(e) => handleChange('contactPhone', e.target.value)}
              placeholder="+86 138-0000-0000"
              className={errors.contactPhone ? 'border-destructive' : ''}
            />
            {errors.contactPhone && (
              <p className="text-sm text-destructive">{errors.contactPhone}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email-signature">邮件签名</Label>
            <textarea
              id="email-signature"
              rows={4}
              value={formData.emailSignature || ''}
              onChange={(e) => handleChange('emailSignature', e.target.value)}
              placeholder="此致&#10;敬礼&#10;&#10;您的公司名称"
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <p className="text-sm text-muted-foreground">将显示在邮件底部</p>
          </div>
        </div>

        <div className="border-t" />

        {/* 操作按钮 */}
        <div className="flex gap-2">
          <Button
            onClick={handleSubmit}
            disabled={saving || uploading}
            className="flex-1"
          >
            {saving ? '保存中...' : '保存配置'}
          </Button>
          <Button
            variant="outline"
            onClick={onReset}
            disabled={saving || uploading}
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            重置
          </Button>
        </div>
      </div>
    </div>
  )
}
