'use client'

import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle, AlertCircle, Clock } from 'lucide-react'
import { RadarSource } from '@/lib/api/radar-sources'

/**
 * TestCrawlDialog 组件属性
 */
interface TestCrawlDialogProps {
  open: boolean
  source: RadarSource | null
  result: any
  onClose: () => void
}

/**
 * TestCrawlDialog 组件
 *
 * Story 8.1: 测试采集结果展示
 *
 * 功能：
 * - 显示测试采集结果
 * - 成功时显示标题、摘要、正文预览
 * - 失败时显示错误信息
 * - 显示采集耗时
 */
export function TestCrawlDialog({
  open,
  source,
  result,
  onClose,
}: TestCrawlDialogProps) {
  const isLoading = !result
  const isSuccess = result?.success
  const isFailed = result && !result.success

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
            {isSuccess && <CheckCircle className="h-5 w-5 text-green-500" />}
            {isFailed && <AlertCircle className="h-5 w-5 text-destructive" />}
            测试采集 - {source?.source || ''}
          </DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="text-center py-8">
            <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary" />
            <p className="text-sm mt-4">正在采集，请稍候...</p>
          </div>
        )}

        {isFailed && (
          <Alert variant="destructive" className="mb-4">
            <p className="text-sm font-semibold mb-1">采集失败</p>
            <p className="text-sm">{result.error}</p>
          </Alert>
        )}

        {isSuccess && (
          <div className="space-y-4">
            {/* 状态栏 */}
            <div className="flex flex-wrap gap-2">
              <Badge variant="default" className="gap-1">
                <CheckCircle className="h-3 w-3" />
                采集成功
              </Badge>
              {result.result?.duration && (
                <Badge variant="secondary" className="gap-1">
                  <Clock className="h-3 w-3" />
                  耗时: {result.result.duration}ms
                </Badge>
              )}
            </div>

            <div className="border-t" />

            {/* 标题 */}
            {result.result?.title && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">标题</p>
                <p className="text-lg font-semibold">{result.result.title}</p>
              </div>
            )}

            {/* 作者 */}
            {result.result?.author && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">作者</p>
                <p className="text-sm">{result.result.author}</p>
              </div>
            )}

            {/* 发布日期 */}
            {result.result?.publishDate && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">发布日期</p>
                <p className="text-sm">
                  {new Date(result.result.publishDate).toLocaleString('zh-CN')}
                </p>
              </div>
            )}

            {/* 摘要 */}
            {result.result?.summary && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">摘要</p>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm">{result.result.summary}</p>
                </div>
              </div>
            )}

            {/* 正文预览 */}
            {result.result?.contentPreview && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">正文预览（前500字）</p>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm whitespace-pre-wrap break-words max-h-48 overflow-auto">
                    {result.result.contentPreview}
                  </p>
                </div>
              </div>
            )}

            {/* 原始URL */}
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">采集URL</p>
              <a
                href={result.result?.url || source?.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline"
              >
                {result.result?.url || source?.url}
              </a>
            </div>

            <Alert>
              <AlertDescription>
                注意：测试采集的内容不会保存到数据库，仅用于验证配置是否正确。
              </AlertDescription>
            </Alert>
          </div>
        )}

        <DialogFooter>
          <Button onClick={onClose}>
            {isLoading ? '取消' : '关闭'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
