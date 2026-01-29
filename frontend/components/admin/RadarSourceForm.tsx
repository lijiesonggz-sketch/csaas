'use client'

import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Box,
  Alert,
  CircularProgress,
} from '@mui/material'
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
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {isEditMode ? '编辑信息源' : '添加信息源'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
          {submitError && (
            <Alert severity="error" onClose={() => setSubmitError(null)}>
              {submitError}
            </Alert>
          )}

          {/* 信息源名称 */}
          <TextField
            label="信息源名称"
            value={formData.source}
            onChange={(e) => handleChange('source', e.target.value)}
            error={!!errors.source}
            helperText={errors.source || '例如：杭州银行金融科技'}
            fullWidth
            required
          />

          {/* 类别（仅创建时可选） */}
          <FormControl fullWidth required disabled={isEditMode}>
            <InputLabel>雷达类别</InputLabel>
            <Select
              value={formData.category}
              label="雷达类别"
              onChange={(e) =>
                handleChange('category', e.target.value as FormData['category'])
              }
            >
              <MenuItem value="tech">技术雷达</MenuItem>
              <MenuItem value="industry">行业雷达</MenuItem>
              <MenuItem value="compliance">合规雷达</MenuItem>
            </Select>
          </FormControl>

          {/* URL */}
          <TextField
            label="URL"
            value={formData.url}
            onChange={(e) => handleChange('url', e.target.value)}
            error={!!errors.url}
            helperText={errors.url || '信息源的完整URL地址'}
            fullWidth
            required
          />

          {/* 类型 */}
          <FormControl fullWidth required>
            <InputLabel>内容类型</InputLabel>
            <Select
              value={formData.type}
              label="内容类型"
              onChange={(e) =>
                handleChange('type', e.target.value as FormData['type'])
              }
            >
              <MenuItem value="wechat">微信公众号</MenuItem>
              <MenuItem value="recruitment">招聘网站</MenuItem>
              <MenuItem value="conference">会议/活动</MenuItem>
              <MenuItem value="website">网站</MenuItem>
            </Select>
          </FormControl>

          {/* 同业机构名称（可选） */}
          <TextField
            label="同业机构名称"
            value={formData.peerName}
            onChange={(e) => handleChange('peerName', e.target.value)}
            helperText="用于行业雷达，标识信息来源的同业机构"
            fullWidth
          />

          {/* 爬取频率 */}
          <TextField
            label="爬取频率（Cron表达式）"
            value={formData.crawlSchedule}
            onChange={(e) => handleChange('crawlSchedule', e.target.value)}
            error={!!errors.crawlSchedule}
            helperText={
              errors.crawlSchedule ||
              '例如：0 3 * * * (每天凌晨3点)'
            }
            fullWidth
            required
          />

          {/* 启用状态 */}
          <FormControlLabel
            control={
              <Switch
                checked={formData.isActive}
                onChange={(e) => handleChange('isActive', e.target.checked)}
                color="primary"
              />
            }
            label="启用此信息源"
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          取消
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={submitting}
          startIcon={submitting ? <CircularProgress size={20} /> : null}
        >
          {submitting ? '提交中...' : isEditMode ? '保存' : '创建'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
