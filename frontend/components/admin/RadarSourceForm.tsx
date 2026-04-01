'use client'

import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2 } from 'lucide-react'
import {
  RadarSource,
  CreateRadarSourceData,
  UpdateRadarSourceData,
} from '@/lib/api/radar-sources'

/**
 * RadarSourceForm 组件属性
 */
interface RadarSourceFormProps {
  open: boolean
  source?: RadarSource | null
  onClose: () => void
  onSubmit: (data: CreateRadarSourceData | UpdateRadarSourceData) => Promise<void>
}

/**
 * 表单数据类型
 */
interface FormData {
  source: string
  category: 'tech' | 'industry' | 'compliance'
  url: string
  type: 'wechat' | 'recruitment' | 'conference' | 'website'
  peerName: string
  isActive: boolean
  crawlSchedule: string
}

/**
 * 默认表单数据
 */
const defaultFormData: FormData = {
  source: '',
  category: 'tech',
  url: '',
  type: 'website',
  peerName: '',
  isActive: true,
  crawlSchedule: '0 3 * * *',
}

/**
 * RadarSourceForm 组件
 *
 * Story 3.1: 信息源配置表单
 *
 * 功能：
 * - 创建新的信息源
 * - 编辑现有信息源
 * - 表单验证（URL格式、cron表达式）
 * - 支持所有字段配置
 */
export function RadarSourceForm({
  open,
  source,
  onClose,
  onSubmit,
}: RadarSourceFormProps) {
  const [formData, setFormData] = useState<FormData>(defaultFormData)
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const isEditMode = !!source

  // 初始化表单数据
  useEffect(() => {
    if (source) {
      setFormData({
        source: source.source,
        category: source.category,
        url: source.url,
        type: source.type,
        peerName: source.peerName || '',
        isActive: source.isActive,
        crawlSchedule: source.crawlSchedule,
      })
    } else {
      setFormData(defaultFormData)
    }
    setErrors({})
    setSubmitError(null)
  }, [source, open])

  // 验证URL格式
  const validateUrl = (url: string): boolean => {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  // 验证cron表达式（简化版）
  const validateCron = (cron: string): boolean => {
    const parts = cron.trim().split(/\s+/)
    return parts.length === 5
  }

  // 验证表单
  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {}

    if (!formData.source.trim()) {
      newErrors.source = '信息源名称不能为空'
    }

    if (!formData.url.trim()) {
      newErrors.url = 'URL不能为空'
    } else if (!validateUrl(formData.url)) {
      newErrors.url = 'URL格式不正确'
    }

    if (!formData.crawlSchedule.trim()) {
      newErrors.crawlSchedule = '爬取频率不能为空'
    } else if (!validateCron(formData.crawlSchedule)) {
      newErrors.crawlSchedule = 'Cron表达式格式不正确（应为5个字段）'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // 处理表单提交
  const handleSubmit = async () => {
    if (!validateForm()) {
      return
    }

    setSubmitting(true)
    setSubmitError(null)

    try {
      const submitData: CreateRadarSourceData | UpdateRadarSourceData = {
        source: formData.source,
        url: formData.url,
        type: formData.type,
        peerName: formData.peerName || undefined,
        isActive: formData.isActive,
        crawlSchedule: formData.crawlSchedule,
      }

      if (!isEditMode) {
        ;(submitData as CreateRadarSourceData).category = formData.category
      }

      await onSubmit(submitData)
      onClose()
    } catch (error: any) {
      setSubmitError(error.message || '提交失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  // 处理字段变化
  const handleChange = (field: keyof FormData, value: any) => {
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? '编辑信息源' : '添加信息源'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {submitError && (
            <Alert variant="destructive">
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}

          {/* 信息源名称 */}
          <div className="space-y-2">
            <Label htmlFor="source">
              信息源名称 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="source"
              value={formData.source}
              onChange={(e) => handleChange('source', e.target.value)}
              placeholder="例如：杭州银行金融科技"
              className={errors.source ? 'border-destructive' : ''}
            />
            {errors.source && (
              <p className="text-sm text-destructive">{errors.source}</p>
            )}
            {!errors.source && (
              <p className="text-sm text-muted-foreground">例如：杭州银行金融科技</p>
            )}
          </div>

          {/* 类别（仅创建时可选） */}
          <div className="space-y-2">
            <Label>雷达类别</Label>
            <Select
              value={formData.category}
              onValueChange={(value) =>
                handleChange('category', value as FormData['category'])
              }
              disabled={isEditMode}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tech">技术雷达</SelectItem>
                <SelectItem value="industry">行业雷达</SelectItem>
                <SelectItem value="compliance">合规雷达</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* URL */}
          <div className="space-y-2">
            <Label htmlFor="url">
              URL <span className="text-destructive">*</span>
            </Label>
            <Input
              id="url"
              value={formData.url}
              onChange={(e) => handleChange('url', e.target.value)}
              placeholder="信息源的完整URL地址"
              className={errors.url ? 'border-destructive' : ''}
            />
            {errors.url && (
              <p className="text-sm text-destructive">{errors.url}</p>
            )}
            {!errors.url && (
              <p className="text-sm text-muted-foreground">信息源的完整URL地址</p>
            )}
          </div>

          {/* 类型 */}
          <div className="space-y-2">
            <Label>内容类型</Label>
            <Select
              value={formData.type}
              onValueChange={(value) =>
                handleChange('type', value as FormData['type'])
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="wechat">微信公众号</SelectItem>
                <SelectItem value="recruitment">招聘网站</SelectItem>
                <SelectItem value="conference">会议/活动</SelectItem>
                <SelectItem value="website">网站</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 同业机构名称（可选） */}
          <div className="space-y-2">
            <Label htmlFor="peerName">同业机构名称</Label>
            <Input
              id="peerName"
              value={formData.peerName}
              onChange={(e) => handleChange('peerName', e.target.value)}
              placeholder="用于行业雷达，标识信息来源的同业机构"
            />
          </div>

          {/* 爬取频率 */}
          <div className="space-y-2">
            <Label htmlFor="crawlSchedule">
              爬取频率（Cron表达式） <span className="text-destructive">*</span>
            </Label>
            <Input
              id="crawlSchedule"
              value={formData.crawlSchedule}
              onChange={(e) => handleChange('crawlSchedule', e.target.value)}
              placeholder="例如：0 3 * * * (每天凌晨3点)"
              className={errors.crawlSchedule ? 'border-destructive' : ''}
            />
            {errors.crawlSchedule && (
              <p className="text-sm text-destructive">{errors.crawlSchedule}</p>
            )}
            {!errors.crawlSchedule && (
              <p className="text-sm text-muted-foreground">例如：0 3 * * * (每天凌晨3点)</p>
            )}
          </div>

          {/* 启用状态 */}
          <div className="flex items-center justify-between">
            <Label htmlFor="isActive">启用此信息源</Label>
            <Switch
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) => handleChange('isActive', checked)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose} disabled={submitting} variant="outline">
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {submitting ? '提交中...' : isEditMode ? '保存' : '创建'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
