/**
 * AddClientDialog Component
 *
 * Story 6.2: 咨询公司批量客户管理后台
 *
 * 添加/编辑客户对话框组件
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
import {
  Client,
  CreateClientData,
  UpdateClientData,
  IndustryType,
  OrganizationScale,
  OrganizationStatus,
} from '@/lib/api/clients'

interface AddClientDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: CreateClientData | UpdateClientData) => Promise<void>
  client?: Client | null
  mode: 'create' | 'edit'
}

// 行业类型选项
const INDUSTRY_OPTIONS = [
  { value: IndustryType.BANKING, label: '银行' },
  { value: IndustryType.SECURITIES, label: '证券' },
  { value: IndustryType.INSURANCE, label: '保险' },
  { value: IndustryType.ENTERPRISE, label: '企业' },
]

// 机构规模选项
const SCALE_OPTIONS = [
  { value: OrganizationScale.LARGE, label: '大型' },
  { value: OrganizationScale.MEDIUM, label: '中型' },
  { value: OrganizationScale.SMALL, label: '小型' },
]

// 状态选项（仅编辑模式）
const STATUS_OPTIONS = [
  { value: OrganizationStatus.ACTIVE, label: '活跃' },
  { value: OrganizationStatus.INACTIVE, label: '停用' },
  { value: OrganizationStatus.TRIAL, label: '试用' },
]

export function AddClientDialog({
  open,
  onClose,
  onSubmit,
  client,
  mode,
}: AddClientDialogProps) {
  const [formData, setFormData] = useState<CreateClientData | UpdateClientData>({
    name: '',
    contactPerson: '',
    contactEmail: '',
    industryType: undefined,
    scale: undefined,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 初始化表单数据
  useEffect(() => {
    if (open) {
      if (mode === 'edit' && client) {
        setFormData({
          name: client.name,
          contactPerson: client.contactPerson || '',
          contactEmail: client.contactEmail || '',
          industryType: client.industryType,
          scale: client.scale,
          status: client.status,
        })
      } else {
        setFormData({
          name: '',
          contactPerson: '',
          contactEmail: '',
          industryType: undefined,
          scale: undefined,
        })
      }
      setErrors({})
      setError(null)
    }
  }, [open, mode, client])

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

    // 验证客户名称
    if (!formData.name || formData.name.trim() === '') {
      newErrors.name = '请输入客户名称'
    }

    // 验证邮箱格式
    if (formData.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail)) {
      newErrors.contactEmail = '请输入有效的邮箱地址'
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

      // 清理空字符串字段
      const cleanedData = Object.entries(formData).reduce((acc, [key, value]) => {
        if (value !== '' && value !== undefined) {
          acc[key] = value
        }
        return acc
      }, {} as any)

      await onSubmit(cleanedData)
      onClose()
    } catch (err: any) {
      setError(err.message || '操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? '添加客户' : '编辑客户'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* 客户名称 */}
          <div className="space-y-2">
            <Label htmlFor="client-name">
              客户名称 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="client-name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="例如: 杭州银行"
              className={errors.name ? 'border-destructive' : ''}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          {/* 联系人姓名 */}
          <div className="space-y-2">
            <Label htmlFor="contact-person">联系人姓名</Label>
            <Input
              id="contact-person"
              value={formData.contactPerson || ''}
              onChange={(e) => handleChange('contactPerson', e.target.value)}
              placeholder="例如: 张三"
            />
          </div>

          {/* 联系人邮箱 */}
          <div className="space-y-2">
            <Label htmlFor="contact-email">联系人邮箱</Label>
            <Input
              id="contact-email"
              type="email"
              value={formData.contactEmail || ''}
              onChange={(e) => handleChange('contactEmail', e.target.value)}
              placeholder="例如: zhangsan@example.com"
              className={errors.contactEmail ? 'border-destructive' : ''}
            />
            {errors.contactEmail && (
              <p className="text-sm text-destructive">{errors.contactEmail}</p>
            )}
          </div>

          {/* 行业类型 */}
          <div className="space-y-2">
            <Label>行业类型</Label>
            <Select
              value={formData.industryType || ''}
              onValueChange={(value) =>
                handleChange('industryType', value || undefined)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="未选择" />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 机构规模 */}
          <div className="space-y-2">
            <Label>机构规模</Label>
            <Select
              value={formData.scale || ''}
              onValueChange={(value) => handleChange('scale', value || undefined)}
            >
              <SelectTrigger>
                <SelectValue placeholder="未选择" />
              </SelectTrigger>
              <SelectContent>
                {SCALE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 状态（仅编辑模式） */}
          {mode === 'edit' && (
            <div className="space-y-2">
              <Label>状态</Label>
              <Select
                value={(formData as UpdateClientData).status || ''}
                onValueChange={(value) => handleChange('status', value || undefined)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="未选择" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={onClose} disabled={submitting} variant="outline">
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? '提交中...' : mode === 'create' ? '添加' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
