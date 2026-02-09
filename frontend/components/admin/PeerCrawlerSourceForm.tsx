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
  Typography,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material'
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material'
import {
  RadarSource,
  CreateRadarSourceData,
  UpdateRadarSourceData,
  CrawlConfig,
} from '@/lib/api/radar-sources'

/**
 * PeerCrawlerSourceForm 组件属性
 */
interface PeerCrawlerSourceFormProps {
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
  url: string
  type: 'wechat' | 'recruitment' | 'conference' | 'website'
  peerName: string
  isActive: boolean
  crawlSchedule: string
  crawlConfig: CrawlConfig
}

/**
 * 默认表单数据
 */
const defaultFormData: FormData = {
  source: '',
  url: '',
  type: 'website',
  peerName: '',
  isActive: true,
  crawlSchedule: '0 */6 * * *',
  crawlConfig: {
    maxPages: 1,
  },
}

/**
 * Cron 表达式预设选项
 */
const cronPresets = [
  { label: '每6小时', value: '0 */6 * * *' },
  { label: '每12小时', value: '0 */12 * * *' },
  { label: '每天', value: '0 3 * * *' },
  { label: '每周', value: '0 3 * * 1' },
]

/**
 * PeerCrawlerSourceForm 组件
 *
 * Story 8.1: 同业采集源表单
 *
 * 功能：
 * - 创建新的同业采集源（category固定为industry）
 * - 编辑现有采集源
 * - 表单验证（URL格式、cron表达式）
 * - 选择器配置（JSON编辑器）
 */
export function PeerCrawlerSourceForm({
  open,
  source,
  onClose,
  onSubmit,
}: PeerCrawlerSourceFormProps) {
  const [formData, setFormData] = useState<FormData>(defaultFormData)
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState(0)
  const [crawlConfigJson, setCrawlConfigJson] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)

  const isEditMode = !!source

  // 初始化表单数据
  useEffect(() => {
    if (source) {
      setFormData({
        source: source.source,
        url: source.url,
        type: source.type,
        peerName: source.peerName || '',
        isActive: source.isActive,
        crawlSchedule: source.crawlSchedule,
        crawlConfig: source.crawlConfig || defaultFormData.crawlConfig,
      })
      setCrawlConfigJson(JSON.stringify(source.crawlConfig || {}, null, 2))
    } else {
      setFormData(defaultFormData)
      setCrawlConfigJson(JSON.stringify(defaultFormData.crawlConfig, null, 2))
    }
    setErrors({})
    setSubmitError(null)
    setJsonError(null)
    setActiveTab(0)
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
      newErrors.source = '同业机构名称不能为空'
    }

    if (!formData.url.trim()) {
      newErrors.url = '采集URL不能为空'
    } else if (!validateUrl(formData.url)) {
      newErrors.url = 'URL格式不正确'
    }

    if (!formData.crawlSchedule.trim()) {
      newErrors.crawlSchedule = '采集频率不能为空'
    } else if (!validateCron(formData.crawlSchedule)) {
      newErrors.crawlSchedule = 'Cron表达式格式不正确（应为5个字段）'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // 处理JSON编辑器变化
  const handleCrawlConfigChange = (value: string) => {
    setCrawlConfigJson(value)
    try {
      const parsed = JSON.parse(value)
      setFormData((prev) => ({ ...prev, crawlConfig: parsed }))
      setJsonError(null)
    } catch (e) {
      setJsonError('JSON格式错误')
    }
  }

  // 处理表单提交
  const handleSubmit = async () => {
    if (!validateForm()) {
      return
    }

    if (jsonError) {
      setSubmitError('请修正选择器配置的JSON格式错误')
      return
    }

    setSubmitting(true)
    setSubmitError(null)

    try {
      // 处理自定义cron表达式：移除 'custom-' 前缀
      const finalCrawlSchedule = formData.crawlSchedule.startsWith('custom-')
        ? formData.crawlSchedule.replace('custom-', '')
        : formData.crawlSchedule

      // 过滤掉空的crawlConfig字段，避免发送空字符串到后端
      const filteredCrawlConfig: CrawlConfig = {}
      Object.entries(formData.crawlConfig || {}).forEach(([key, value]) => {
        if (value !== '' && value !== undefined && value !== null) {
          (filteredCrawlConfig as Record<string, any>)[key] = value
        }
      })

      const submitData: CreateRadarSourceData | UpdateRadarSourceData = {
        source: formData.source,
        url: formData.url,
        type: formData.type,
        peerName: formData.peerName || undefined,
        isActive: formData.isActive,
        crawlSchedule: finalCrawlSchedule,
        crawlConfig: Object.keys(filteredCrawlConfig).length > 0 ? filteredCrawlConfig : undefined,
      }

      if (!isEditMode) {
        // 创建时固定category为industry
        ;(submitData as CreateRadarSourceData).category = 'industry'
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
        {isEditMode ? '编辑采集源' : '添加采集源'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
            <Tab label="基本信息" />
            <Tab label="选择器配置" />
          </Tabs>
        </Box>

        {submitError && (
          <Alert severity="error" onClose={() => setSubmitError(null)} sx={{ mb: 2 }}>
            {submitError}
          </Alert>
        )}

        {activeTab === 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* 同业机构名称 */}
            <TextField
              label="同业机构名称"
              value={formData.source}
              onChange={(e) => handleChange('source', e.target.value)}
              error={!!errors.source}
              helperText={errors.source || '例如：杭州银行金融科技'}
              fullWidth
              required
            />

            {/* URL */}
            <TextField
              label="采集URL"
              value={formData.url}
              onChange={(e) => handleChange('url', e.target.value)}
              error={!!errors.url}
              helperText={errors.url || '采集目标的完整URL地址'}
              fullWidth
              required
            />

            {/* 类型 */}
            <FormControl fullWidth required>
              <InputLabel>来源类型</InputLabel>
              <Select
                value={formData.type}
                label="来源类型"
                onChange={(e) =>
                  handleChange('type', e.target.value as FormData['type'])
                }
              >
                <MenuItem value="website">官网</MenuItem>
                <MenuItem value="wechat">公众号</MenuItem>
                <MenuItem value="recruitment">招聘</MenuItem>
                <MenuItem value="conference">会议</MenuItem>
              </Select>
            </FormControl>

            {/* 采集频率 */}
            <FormControl fullWidth required>
              <InputLabel>采集频率</InputLabel>
              <Select
                value={formData.crawlSchedule}
                label="采集频率"
                onChange={(e) => handleChange('crawlSchedule', e.target.value)}
                error={!!errors.crawlSchedule}
              >
                {cronPresets.map((preset) => (
                  <MenuItem key={preset.value} value={preset.value}>
                    {preset.label} ({preset.value})
                  </MenuItem>
                ))}
                <MenuItem value="custom">自定义</MenuItem>
              </Select>
            </FormControl>

            {formData.crawlSchedule.startsWith('custom') && (
              <TextField
                label="自定义Cron表达式"
                value={formData.crawlSchedule === 'custom' ? '' : formData.crawlSchedule.replace('custom-', '')}
                onChange={(e) => handleChange('crawlSchedule', `custom-${e.target.value}`)}
                error={!!errors.crawlSchedule}
                helperText={errors.crawlSchedule || '例如：0 */6 * * * (每6小时)'}
                fullWidth
              />
            )}

            {/* 启用状态 */}
            <FormControlLabel
              control={
                <Switch
                  checked={formData.isActive}
                  onChange={(e) => handleChange('isActive', e.target.checked)}
                  color="primary"
                />
              }
              label="启用此采集源"
            />
          </Box>
        )}

        {activeTab === 1 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              配置CSS选择器以精确提取内容。如果不配置，系统将使用默认选择器。
            </Typography>

            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>JSON编辑器</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <TextField
                  label="选择器配置 (JSON)"
                  value={crawlConfigJson}
                  onChange={(e) => handleCrawlConfigChange(e.target.value)}
                  error={!!jsonError}
                  helperText={jsonError || '配置选择器JSON'}
                  fullWidth
                  multiline
                  rows={10}
                  InputProps={{
                    sx: { fontFamily: 'monospace' },
                  }}
                />
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>单个字段配置</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <TextField
                    label="标题选择器"
                    value={formData.crawlConfig.titleSelector || ''}
                    onChange={(e) =>
                      handleChange('crawlConfig', {
                        ...formData.crawlConfig,
                        titleSelector: e.target.value,
                      })
                    }
                    helperText="例如：h1.article-title"
                    fullWidth
                  />
                  <TextField
                    label="内容选择器"
                    value={formData.crawlConfig.contentSelector || ''}
                    onChange={(e) =>
                      handleChange('crawlConfig', {
                        ...formData.crawlConfig,
                        contentSelector: e.target.value,
                      })
                    }
                    helperText="例如：div.article-content"
                    fullWidth
                  />
                  <TextField
                    label="日期选择器"
                    value={formData.crawlConfig.dateSelector || ''}
                    onChange={(e) =>
                      handleChange('crawlConfig', {
                        ...formData.crawlConfig,
                        dateSelector: e.target.value,
                      })
                    }
                    helperText="例如：time.publish-date"
                    fullWidth
                  />
                  <TextField
                    label="作者选择器"
                    value={formData.crawlConfig.authorSelector || ''}
                    onChange={(e) =>
                      handleChange('crawlConfig', {
                        ...formData.crawlConfig,
                        authorSelector: e.target.value,
                      })
                    }
                    helperText="例如：span.author-name"
                    fullWidth
                  />
                  <TextField
                    label="列表选择器"
                    value={formData.crawlConfig.listSelector || ''}
                    onChange={(e) =>
                      handleChange('crawlConfig', {
                        ...formData.crawlConfig,
                        listSelector: e.target.value,
                      })
                    }
                    helperText="用于列表页，例如：article.news-item"
                    fullWidth
                  />
                  <TextField
                    label="最大页数"
                    type="number"
                    value={formData.crawlConfig.maxPages || 1}
                    onChange={(e) =>
                      handleChange('crawlConfig', {
                        ...formData.crawlConfig,
                        maxPages: parseInt(e.target.value) || 1,
                      })
                    }
                    helperText="最大采集页数"
                    fullWidth
                  />
                </Box>
              </AccordionDetails>
            </Accordion>

            <Alert severity="info">
              配置示例：
              <pre style={{ margin: '8px 0', overflow: 'auto' }}>
                {JSON.stringify(
                  {
                    titleSelector: 'h1.article-title',
                    contentSelector: 'div.article-content',
                    dateSelector: 'time.publish-date',
                    authorSelector: 'span.author',
                    maxPages: 3,
                  },
                  null,
                  2
                )}
              </pre>
            </Alert>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          取消
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={submitting || !!jsonError}
          startIcon={submitting ? <CircularProgress size={20} /> : null}
        >
          {submitting ? '提交中...' : isEditMode ? '保存' : '创建'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
