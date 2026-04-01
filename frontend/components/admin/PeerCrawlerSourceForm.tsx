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
  ChevronDown,
} from 'lucide-react'
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
  const [expandedSection, setExpandedSection] = useState<'json' | 'fields' | null>(null)

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
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? '编辑采集源' : '添加采集源'}
          </DialogTitle>
        </DialogHeader>

        {/* Tab 导航 */}
        <div className="border-b">
          <div className="flex">
            <button
              className={`
                px-4 py-2 text-sm font-medium transition-colors
                ${activeTab === 0
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
                }
              `}
              onClick={() => setActiveTab(0)}
            >
              基本信息
            </button>
            <button
              className={`
                px-4 py-2 text-sm font-medium transition-colors
                ${activeTab === 1
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
                }
              `}
              onClick={() => setActiveTab(1)}
            >
              选择器配置
            </button>
          </div>
        </div>

        {submitError && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        )}

        {activeTab === 0 && (
          <div className="space-y-4 mt-4">
            {/* 同业机构名称 */}
            <div className="space-y-2">
              <Label htmlFor="source">
                同业机构名称 <span className="text-destructive">*</span>
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

            {/* URL */}
            <div className="space-y-2">
              <Label htmlFor="url">
                采集URL <span className="text-destructive">*</span>
              </Label>
              <Input
                id="url"
                value={formData.url}
                onChange={(e) => handleChange('url', e.target.value)}
                placeholder="采集目标的完整URL地址"
                className={errors.url ? 'border-destructive' : ''}
              />
              {errors.url && (
                <p className="text-sm text-destructive">{errors.url}</p>
              )}
              {!errors.url && (
                <p className="text-sm text-muted-foreground">采集目标的完整URL地址</p>
              )}
            </div>

            {/* 类型 */}
            <div className="space-y-2">
              <Label>来源类型</Label>
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
                  <SelectItem value="website">官网</SelectItem>
                  <SelectItem value="wechat">公众号</SelectItem>
                  <SelectItem value="recruitment">招聘</SelectItem>
                  <SelectItem value="conference">会议</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 采集频率 */}
            <div className="space-y-2">
              <Label>采集频率</Label>
              <Select
                value={formData.crawlSchedule}
                onValueChange={(value) => handleChange('crawlSchedule', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {cronPresets.map((preset) => (
                    <SelectItem key={preset.value} value={preset.value}>
                      {preset.label} ({preset.value})
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">自定义</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.crawlSchedule.startsWith('custom') && (
              <div className="space-y-2">
                <Label>自定义Cron表达式</Label>
                <Input
                  value={formData.crawlSchedule === 'custom' ? '' : formData.crawlSchedule.replace('custom-', '')}
                  onChange={(e) => handleChange('crawlSchedule', `custom-${e.target.value}`)}
                  placeholder="例如：0 */6 * * * (每6小时)"
                  className={errors.crawlSchedule ? 'border-destructive' : ''}
                />
                {errors.crawlSchedule && (
                  <p className="text-sm text-destructive">{errors.crawlSchedule}</p>
                )}
              </div>
            )}

            {/* 启用状态 */}
            <div className="flex items-center justify-between">
              <Label htmlFor="isActive">启用此采集源</Label>
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => handleChange('isActive', checked)}
              />
            </div>
          </div>
        )}

        {activeTab === 1 && (
          <div className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              配置CSS选择器以精确提取内容。如果不配置，系统将使用默认选择器。
            </p>

            {/* JSON编辑器 */}
            <div className="border rounded-lg">
              <button
                className="w-full flex items-center justify-between p-3 hover:bg-muted transition-colors"
                onClick={() => setExpandedSection(expandedSection === 'json' ? null : 'json')}
              >
                <span className="font-medium">JSON编辑器</span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${expandedSection === 'json' ? 'rotate-180' : ''}`}
                />
              </button>
              {expandedSection === 'json' && (
                <div className="p-3 pt-0">
                  <textarea
                    value={crawlConfigJson}
                    onChange={(e) => handleCrawlConfigChange(e.target.value)}
                    placeholder="配置选择器JSON"
                    rows={10}
                    className={`
                      w-full font-mono text-sm rounded-md border p-3
                      ${jsonError ? 'border-destructive' : ''}
                    `}
                  />
                  {jsonError && (
                    <p className="text-sm text-destructive mt-1">{jsonError}</p>
                  )}
                </div>
              )}
            </div>

            {/* 单个字段配置 */}
            <div className="border rounded-lg">
              <button
                className="w-full flex items-center justify-between p-3 hover:bg-muted transition-colors"
                onClick={() => setExpandedSection(expandedSection === 'fields' ? null : 'fields')}
              >
                <span className="font-medium">单个字段配置</span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${expandedSection === 'fields' ? 'rotate-180' : ''}`}
                />
              </button>
              {expandedSection === 'fields' && (
                <div className="p-3 pt-0 space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">标题选择器</Label>
                    <Input
                      value={formData.crawlConfig.titleSelector || ''}
                      onChange={(e) =>
                        handleChange('crawlConfig', {
                          ...formData.crawlConfig,
                          titleSelector: e.target.value,
                        })
                      }
                      placeholder="例如：h1.article-title"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">内容选择器</Label>
                    <Input
                      value={formData.crawlConfig.contentSelector || ''}
                      onChange={(e) =>
                        handleChange('crawlConfig', {
                          ...formData.crawlConfig,
                          contentSelector: e.target.value,
                        })
                      }
                      placeholder="例如：div.article-content"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">日期选择器</Label>
                    <Input
                      value={formData.crawlConfig.dateSelector || ''}
                      onChange={(e) =>
                        handleChange('crawlConfig', {
                          ...formData.crawlConfig,
                          dateSelector: e.target.value,
                        })
                      }
                      placeholder="例如：time.publish-date"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">作者选择器</Label>
                    <Input
                      value={formData.crawlConfig.authorSelector || ''}
                      onChange={(e) =>
                        handleChange('crawlConfig', {
                          ...formData.crawlConfig,
                          authorSelector: e.target.value,
                        })
                      }
                      placeholder="例如：span.author-name"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">列表选择器</Label>
                    <Input
                      value={formData.crawlConfig.listSelector || ''}
                      onChange={(e) =>
                        handleChange('crawlConfig', {
                          ...formData.crawlConfig,
                          listSelector: e.target.value,
                        })
                      }
                      placeholder="用于列表页，例如：article.news-item"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">最大页数</Label>
                    <Input
                      type="number"
                      value={formData.crawlConfig.maxPages || 1}
                      onChange={(e) =>
                        handleChange('crawlConfig', {
                          ...formData.crawlConfig,
                          maxPages: parseInt(e.target.value) || 1,
                        })
                      }
                      placeholder="最大采集页数"
                    />
                  </div>
                </div>
              )}
            </div>

            <Alert>
              <AlertDescription>
                配置示例：
                <pre className="mt-2 text-xs overflow-auto p-2 bg-muted rounded">
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
              </AlertDescription>
            </Alert>
          </div>
        )}

        <DialogFooter>
          <Button onClick={onClose} disabled={submitting} variant="outline">
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !!jsonError}
          >
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {submitting ? '提交中...' : isEditMode ? '保存' : '创建'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
