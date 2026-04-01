/**
 * BulkConfigDialog Component
 *
 * Story 6.2: 咨询公司批量客户管理后台
 *
 * 批量配置客户推送设置对话框
 */

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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Client, BulkConfigData, RelevanceFilter } from '@/lib/api/clients'

interface BulkConfigDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: BulkConfigData) => Promise<void>
  selectedClients: Client[]
}

// 相关性过滤选项
const RELEVANCE_OPTIONS = [
  { value: RelevanceFilter.HIGH, label: '高相关性' },
  { value: RelevanceFilter.MEDIUM, label: '中等相关性' },
  { value: RelevanceFilter.LOW, label: '低相关性' },
]

export function BulkConfigDialog({
  open,
  onClose,
  onSubmit,
  selectedClients,
}: BulkConfigDialogProps) {
  const [formData, setFormData] = useState<Omit<BulkConfigData, 'organizationIds'>>({
    pushStartTime: '',
    pushEndTime: '',
    dailyPushLimit: undefined,
    relevanceFilter: undefined,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 重置表单
  useEffect(() => {
    if (open) {
      setFormData({
        pushStartTime: '',
        pushEndTime: '',
        dailyPushLimit: undefined,
        relevanceFilter: undefined,
      })
      setErrors({})
      setError(null)
    }
  }, [open])

  // 处理字段变化
  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    // 清除该字段的错误
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
    setError(null)
  }

  // 验证表单
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    // 验证时间格式 (HH:mm)
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/
    if (formData.pushStartTime && !timeRegex.test(formData.pushStartTime)) {
      newErrors.pushStartTime = '请输入有效的时间格式 (HH:mm)'
    }
    if (formData.pushEndTime && !timeRegex.test(formData.pushEndTime)) {
      newErrors.pushEndTime = '请输入有效的时间格式 (HH:mm)'
    }

    // 验证时间范围
    if (formData.pushStartTime && formData.pushEndTime) {
      const [startHour, startMin] = formData.pushStartTime.split(':').map(Number)
      const [endHour, endMin] = formData.pushEndTime.split(':').map(Number)
      const startMinutes = startHour * 60 + startMin
      const endMinutes = endHour * 60 + endMin

      if (startMinutes >= endMinutes) {
        newErrors.pushEndTime = '结束时间必须晚于开始时间'
      }
    }

    // 验证每日推送上限
    if (
      formData.dailyPushLimit !== undefined &&
      (formData.dailyPushLimit < 1 || formData.dailyPushLimit > 20)
    ) {
      newErrors.dailyPushLimit = '每日推送上限必须在 1-20 之间'
    }

    // 至少需要配置一项
    if (
      !formData.pushStartTime &&
      !formData.pushEndTime &&
      !formData.dailyPushLimit &&
      !formData.relevanceFilter
    ) {
      newErrors.general = '请至少配置一项设置'
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
      setSubmitting(true)
      setError(null)

      // 构建批量配置数据
      const configData: BulkConfigData = {
        organizationIds: selectedClients.map((c) => c.id),
        ...Object.entries(formData).reduce((acc, [key, value]) => {
          if (value !== '' && value !== undefined) {
            acc[key] = value
          }
          return acc
        }, {} as any),
      }

      await onSubmit(configData)
      onClose()
    } catch (err: any) {
      setError(err.message || '批量配置失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>批量配置推送设置</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* 选中的客户数量 */}
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              已选择 {selectedClients.length} 个客户
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {selectedClients.slice(0, 5).map((client) => (
                <Badge key={client.id} variant="secondary">
                  {client.name}
                </Badge>
              ))}
              {selectedClients.length > 5 && (
                <Badge variant="secondary">+{selectedClients.length - 5} 个</Badge>
              )}
            </div>
          </div>

          {errors.general && (
            <Alert variant="destructive">
              <AlertDescription>{errors.general}</AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* 推送时间范围 */}
          <div className="space-y-2">
            <Label>推送时间范围</Label>
            <div className="flex gap-2">
              <div className="flex-1 space-y-2">
                <Label htmlFor="start-time" className="text-xs">开始时间</Label>
                <Input
                  id="start-time"
                  value={formData.pushStartTime}
                  onChange={(e) => handleChange('pushStartTime', e.target.value)}
                  placeholder="09:00"
                  className={errors.pushStartTime ? 'border-destructive' : ''}
                />
                {errors.pushStartTime && (
                  <p className="text-xs text-destructive">{errors.pushStartTime}</p>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <Label htmlFor="end-time" className="text-xs">结束时间</Label>
                <Input
                  id="end-time"
                  value={formData.pushEndTime}
                  onChange={(e) => handleChange('pushEndTime', e.target.value)}
                  placeholder="18:00"
                  className={errors.pushEndTime ? 'border-destructive' : ''}
                />
                {errors.pushEndTime && (
                  <p className="text-xs text-destructive">{errors.pushEndTime}</p>
                )}
              </div>
            </div>
          </div>

          {/* 每日推送上限 */}
          <div className="space-y-2">
            <Label htmlFor="daily-limit">每日推送上限</Label>
            <Input
              id="daily-limit"
              type="number"
              value={formData.dailyPushLimit || ''}
              onChange={(e) =>
                handleChange('dailyPushLimit', e.target.value ? Number(e.target.value) : undefined)
              }
              placeholder="5"
              min={1}
              max={20}
              className={errors.dailyPushLimit ? 'border-destructive' : ''}
            />
            {errors.dailyPushLimit ? (
              <p className="text-xs text-destructive">{errors.dailyPushLimit}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                设置每天最多推送的内容数量 (1-20)
              </p>
            )}
          </div>

          {/* 相关性过滤 */}
          <div className="space-y-2">
            <Label>相关性过滤级别</Label>
            <Select
              value={formData.relevanceFilter || ''}
              onValueChange={(value) => handleChange('relevanceFilter', value || undefined)}
            >
              <SelectTrigger>
                <SelectValue placeholder="不设置" />
              </SelectTrigger>
              <SelectContent>
                {RELEVANCE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              设置推送内容的最低相关性要求
            </p>
          </div>

          {/* 说明 */}
          <Alert>
            <AlertDescription>
              批量配置将覆盖所选客户的现有推送设置。未填写的字段将保持不变。
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button onClick={onClose} disabled={submitting} variant="outline">
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? '配置中...' : '确认配置'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
