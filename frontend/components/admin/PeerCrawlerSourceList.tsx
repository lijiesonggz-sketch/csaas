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
import { Edit, Trash2, Play, Plus } from 'lucide-react'
import { RadarSource } from '@/lib/api/radar-sources'

/**
 * PeerCrawlerSourceList 组件属性
 */
interface PeerCrawlerSourceListProps {
  sources: RadarSource[]
  loading?: boolean
  error?: string | null
  onEdit: (source: RadarSource) => void
  onCreate: () => void
  onDelete: (id: string) => void
  onToggleActive: (id: string) => void
  onTestCrawl: (source: RadarSource) => void
}

/**
 * 类型标签配置
 */
const typeConfig: Record<
  'wechat' | 'recruitment' | 'conference' | 'website',
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }
> = {
  website: { label: '官网', variant: 'default' },
  wechat: { label: '公众号', variant: 'secondary' },
  recruitment: { label: '招聘', variant: 'outline' },
  conference: { label: '会议', variant: 'destructive' },
}

/**
 * 状态标签配置
 */
const statusConfig: Record<
  'pending' | 'success' | 'failed',
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  pending: { label: '待采集', variant: 'secondary' },
  success: { label: '成功', variant: 'default' },
  failed: { label: '失败', variant: 'destructive' },
}

/**
 * PeerCrawlerSourceList 组件
 *
 * Story 8.1: 同业采集源管理列表
 *
 * 功能：
 * - 显示同业采集源配置
 * - 支持启用/禁用切换
 * - 支持编辑、删除操作
 * - 支持测试采集功能
 * - 显示最后采集状态和成功率
 */
export function PeerCrawlerSourceList({
  sources,
  loading = false,
  error = null,
  onEdit,
  onCreate,
  onDelete,
  onToggleActive,
  onTestCrawl,
}: PeerCrawlerSourceListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    if (window.confirm('确定要删除这个采集源吗？')) {
      setDeletingId(id)
      try {
        await onDelete(id)
      } finally {
        setDeletingId(null)
      }
    }
  }

  const handleTestCrawl = async (source: RadarSource) => {
    setTestingId(source.id)
    try {
      await onTestCrawl(source)
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
      {/* 头部操作栏 */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold">采集源列表</h2>
          <p className="text-sm text-muted-foreground ml-1">({sources.length} 个)</p>
        </div>
        <Button onClick={onCreate} className="rounded-sm bg-[#1E3A5F] hover:bg-[#162e4d]">
          <Plus className="h-4 w-4 mr-1" />
          添加采集源
        </Button>
      </div>

      {/* 采集源列表 */}
      {sources.length === 0 ? (
        <Alert>
          <AlertDescription>
            暂无采集源配置，点击「添加采集源」按钮创建第一个采集源。
          </AlertDescription>
        </Alert>
      ) : (
        <div className="overflow-hidden rounded-sm border border-[#E2E8F0]">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#1E3A5F] hover:bg-[#1E3A5F]">
                <TableHead className="text-white">同业机构名称</TableHead>
                <TableHead className="text-white">来源类型</TableHead>
                <TableHead className="text-white">采集URL</TableHead>
                <TableHead className="text-white">状态</TableHead>
                <TableHead className="text-white">上次采集时间</TableHead>
                <TableHead className="text-white">成功率</TableHead>
                <TableHead className="text-right text-white">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sources.map((source) => (
                <TableRow key={source.id} className="hover:bg-muted/50">
                  <TableCell>
                    <p className="text-sm font-medium">{source.source}</p>
                    {source.peerName && (
                      <p className="text-xs text-muted-foreground">{source.peerName}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={typeConfig[source.type].variant}>
                      {typeConfig[source.type].label}
                    </Badge>
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
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={statusConfig[source.lastCrawlStatus].variant}
                        className="text-xs"
                      >
                        {statusConfig[source.lastCrawlStatus].label}
                      </Badge>
                      <Switch
                        checked={source.isActive}
                        onCheckedChange={() => onToggleActive(source.id)}
                        className="scale-90"
                      />
                    </div>
                    {source.lastCrawlError && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <p className="text-xs text-destructive max-w-[150px] truncate mt-1">
                              {source.lastCrawlError}
                            </p>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{source.lastCrawlError}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </TableCell>
                  <TableCell>
                    {source.lastCrawledAt ? (
                      <p className="text-sm">
                        {new Date(source.lastCrawledAt).toLocaleString('zh-CN')}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">从未采集</p>
                    )}
                  </TableCell>
                  <TableCell>
                    {/* TODO: 从API获取成功率 */}
                    <p className="text-sm text-muted-foreground">--</p>
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
                              onClick={() => handleTestCrawl(source)}
                              disabled={testingId === source.id}
                            >
                              {testingId === source.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>测试采集</TooltipContent>
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
