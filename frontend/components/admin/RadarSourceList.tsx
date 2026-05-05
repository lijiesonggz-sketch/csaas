'use client'

import React, { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2 } from 'lucide-react'
import { Edit, Trash2, Play, Plus, RadioTower } from 'lucide-react'
import { RadarSource } from '@/lib/api/radar-sources'
import { PageHeader } from '@/components/ui/page-header'

/**
 * RadarSourceList 组件属性
 */
interface RadarSourceListProps {
  sources: RadarSource[]
  loading?: boolean
  error?: string | null
  onEdit: (source: RadarSource) => void
  onCreate: () => void
  onDelete: (id: string) => void
  onToggleActive: (id: string) => void
  onTestCrawl: (id: string) => void
}

/**
 * 类别标签配置
 */
const categoryConfig: Record<
  'tech' | 'industry' | 'compliance',
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }
> = {
  tech: { label: '技术雷达', variant: 'default' },
  industry: { label: '行业雷达', variant: 'secondary' },
  compliance: { label: '合规雷达', variant: 'outline' },
}

/**
 * 类型标签配置
 */
const typeConfig: Record<'wechat' | 'recruitment' | 'conference' | 'website', { label: string }> = {
  wechat: { label: '微信公众号' },
  recruitment: { label: '招聘网站' },
  conference: { label: '会议/活动' },
  website: { label: '网站' },
}

/**
 * 状态标签配置
 */
const statusConfig: Record<
  'pending' | 'success' | 'failed',
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  pending: { label: '待爬取', variant: 'secondary' },
  success: { label: '成功', variant: 'default' },
  failed: { label: '失败', variant: 'destructive' },
}

/**
 * RadarSourceList 组件
 *
 * Story 3.1: 信息源配置管理列表
 *
 * 功能：
 * - 显示所有信息源配置
 * - 支持启用/禁用切换
 * - 支持编辑、删除操作
 * - 支持测试爬虫功能
 * - 显示最后爬取状态
 */
export function RadarSourceList({
  sources,
  loading = false,
  error = null,
  onEdit,
  onCreate,
  onDelete,
  onToggleActive,
  onTestCrawl,
}: RadarSourceListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    if (window.confirm('确定要删除这个信息源吗？')) {
      setDeletingId(id)
      try {
        await onDelete(id)
      } finally {
        setDeletingId(null)
      }
    }
  }

  const handleTestCrawl = async (id: string) => {
    setTestingId(id)
    try {
      await onTestCrawl(id)
    } finally {
      setTestingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div>
      <PageHeader
        title="雷达信息源配置"
        description="维护技术、行业和合规雷达的信息源，控制采集状态与测试任务"
        icon={<RadioTower className="h-6 w-6" />}
        variant="default"
        className="p-8"
        action={
          <Button
            onClick={onCreate}
            className="rounded-sm bg-white text-[#1E3A5F] hover:bg-white/90"
          >
            <Plus className="h-4 w-4 mr-2" />
            添加信息源
          </Button>
        }
      />

      {/* 信息源列表 */}
      {sources.length === 0 ? (
        <Alert>
          <AlertDescription>
            暂无信息源配置，点击「添加信息源」按钮创建第一个信息源。
          </AlertDescription>
        </Alert>
      ) : (
        <div className="overflow-hidden rounded-sm border border-[#E2E8F0]">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#1E3A5F] hover:bg-[#1E3A5F]">
                <TableHead className="text-white">信息源名称</TableHead>
                <TableHead className="text-white">类别</TableHead>
                <TableHead className="text-white">类型</TableHead>
                <TableHead className="text-white">URL</TableHead>
                <TableHead className="text-white">同业机构</TableHead>
                <TableHead className="text-white">爬取频率</TableHead>
                <TableHead className="text-white">最后爬取状态</TableHead>
                <TableHead className="text-white">启用状态</TableHead>
                <TableHead className="text-right text-white">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sources.map((source) => (
                <TableRow key={source.id} className="hover:bg-muted/50">
                  <TableCell>
                    <p className="text-sm font-medium">{source.source}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant={categoryConfig[source.category].variant}>
                      {categoryConfig[source.category].label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm">{typeConfig[source.type].label}</p>
                  </TableCell>
                  <TableCell>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className="text-sm max-w-[200px] truncate">{source.url}</p>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{source.url}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell>
                    {source.peerName ? (
                      <p className="text-sm">{source.peerName}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">-</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <p className="text-sm font-mono">{source.crawlSchedule}</p>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge
                        variant={statusConfig[source.lastCrawlStatus].variant}
                        className="text-xs w-fit"
                      >
                        {statusConfig[source.lastCrawlStatus].label}
                      </Badge>
                      {source.lastCrawledAt && (
                        <p className="text-xs text-muted-foreground">
                          {new Date(source.lastCrawledAt).toLocaleString('zh-CN')}
                        </p>
                      )}
                      {source.lastCrawlError && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <p className="text-xs text-destructive max-w-[150px] truncate">
                                {source.lastCrawlError}
                              </p>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{source.lastCrawlError}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={source.isActive}
                      onCheckedChange={() => onToggleActive(source.id)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => handleTestCrawl(source.id)}
                              disabled={testingId === source.id}
                            >
                              {testingId === source.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>测试爬虫</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => onEdit(source)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>编辑</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => handleDelete(source.id)}
                              disabled={deletingId === source.id}
                            >
                              {deletingId === source.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>删除</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
