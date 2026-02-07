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
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Stack,
  Alert,
  Typography,
  Box,
  Chip,
} from '@mui/material'
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
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>批量配置推送设置</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 2 }}>
          {/* 选中的客户数量 */}
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              已选择 {selectedClients.length} 个客户
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
              {selectedClients.slice(0, 5).map((client) => (
                <Chip key={client.id} label={client.name} size="small" />
              ))}
              {selectedClients.length > 5 && (
                <Chip label={`+${selectedClients.length - 5} 个`} size="small" />
              )}
            </Box>
          </Box>

          {errors.general && <Alert severity="error">{errors.general}</Alert>}
          {error && <Alert severity="error">{error}</Alert>}

          {/* 推送时间范围 */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              推送时间范围
            </Typography>
            <Stack direction="row" spacing={2}>
              <TextField
                fullWidth
                label="开始时间"
                value={formData.pushStartTime}
                onChange={(e) => handleChange('pushStartTime', e.target.value)}
                error={!!errors.pushStartTime}
                helperText={errors.pushStartTime}
                placeholder="09:00"
                inputProps={{
                  pattern: '[0-2][0-9]:[0-5][0-9]',
                }}
              />
              <TextField
                fullWidth
                label="结束时间"
                value={formData.pushEndTime}
                onChange={(e) => handleChange('pushEndTime', e.target.value)}
                error={!!errors.pushEndTime}
                helperText={errors.pushEndTime}
                placeholder="18:00"
                inputProps={{
                  pattern: '[0-2][0-9]:[0-5][0-9]',
                }}
              />
            </Stack>
          </Box>

          {/* 每日推送上限 */}
          <TextField
            fullWidth
            type="number"
            label="每日推送上限"
            value={formData.dailyPushLimit || ''}
            onChange={(e) =>
              handleChange('dailyPushLimit', e.target.value ? Number(e.target.value) : undefined)
            }
            error={!!errors.dailyPushLimit}
            helperText={errors.dailyPushLimit || '设置每天最多推送的内容数量 (1-20)'}
            inputProps={{
              min: 1,
              max: 20,
            }}
            placeholder="5"
          />

          {/* 相关性过滤 */}
          <TextField
            fullWidth
            select
            label="相关性过滤级别"
            value={formData.relevanceFilter || ''}
            onChange={(e) => handleChange('relevanceFilter', e.target.value || undefined)}
            helperText="设置推送内容的最低相关性要求"
          >
            <MenuItem value="">
              <em>不设置</em>
            </MenuItem>
            {RELEVANCE_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>

          {/* 说明 */}
          <Alert severity="info">
            批量配置将覆盖所选客户的现有推送设置。未填写的字段将保持不变。
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          取消
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={submitting}>
          {submitting ? '配置中...' : '确认配置'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
