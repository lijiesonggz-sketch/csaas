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
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Stack,
  Alert,
  Box,
} from '@mui/material'
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
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth data-testid="add-client-modal">
      <DialogTitle>{mode === 'create' ? '添加客户' : '编辑客户'}</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 2 }}>
          {error && <Alert severity="error">{error}</Alert>}

          {/* 客户名称 */}
          <TextField
            data-testid="client-name-input"
            fullWidth
            required
            label="客户名称"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            error={!!errors.name}
            helperText={errors.name}
            placeholder="例如: 杭州银行"
          />

          {/* 联系人姓名 */}
          <TextField
            data-testid="contact-person-input"
            fullWidth
            label="联系人姓名"
            value={formData.contactPerson || ''}
            onChange={(e) => handleChange('contactPerson', e.target.value)}
            placeholder="例如: 张三"
          />

          {/* 联系人邮箱 */}
          <TextField
            data-testid="contact-email-input"
            fullWidth
            label="联系人邮箱"
            type="email"
            value={formData.contactEmail || ''}
            onChange={(e) => handleChange('contactEmail', e.target.value)}
            error={!!errors.contactEmail}
            helperText={errors.contactEmail}
            placeholder="例如: zhangsan@example.com"
          />

          {/* 行业类型 */}
          <TextField
            data-testid="industry-type-select"
            fullWidth
            select
            label="行业类型"
            value={formData.industryType || ''}
            onChange={(e) => handleChange('industryType', e.target.value || undefined)}
          >
            <MenuItem value="">
              <em>未选择</em>
            </MenuItem>
            {INDUSTRY_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>

          {/* 机构规模 */}
          <TextField
            data-testid="scale-select"
            fullWidth
            select
            label="机构规模"
            value={formData.scale || ''}
            onChange={(e) => handleChange('scale', e.target.value || undefined)}
          >
            <MenuItem value="">
              <em>未选择</em>
            </MenuItem>
            {SCALE_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>

          {/* 状态（仅编辑模式） */}
          {mode === 'edit' && (
            <TextField
              fullWidth
              select
              label="状态"
              value={(formData as UpdateClientData).status || ''}
              onChange={(e) => handleChange('status', e.target.value || undefined)}
            >
              <MenuItem value="">
                <em>未选择</em>
              </MenuItem>
              {STATUS_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          取消
        </Button>
        <Button data-testid="submit-button" onClick={handleSubmit} variant="contained" disabled={submitting}>
          {submitting ? '提交中...' : mode === 'create' ? '添加' : '保存'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
