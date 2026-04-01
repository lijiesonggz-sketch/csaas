/**
 * BulkImportDialog Component
 *
 * Story 6.2: 咨询公司批量客户管理后台
 *
 * CSV 批量导入客户对话框
 */

import React, { useState, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Upload, CheckCircle, AlertCircle, Download } from 'lucide-react'
import { BulkImportResult } from '@/lib/api/clients'

interface BulkImportDialogProps {
  open: boolean
  onClose: () => void
  onImport: (file: File) => Promise<BulkImportResult>
  onDownloadTemplate: () => Promise<void>
}

export function BulkImportDialog({
  open,
  onClose,
  onImport,
  onDownloadTemplate,
}: BulkImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<BulkImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)

  // 重置状态
  const resetState = () => {
    setFile(null)
    setImporting(false)
    setResult(null)
    setError(null)
    setDragActive(false)
  }

  // 处理对话框关闭
  const handleClose = () => {
    resetState()
    onClose()
  }

  // 处理文件选择
  const handleFileSelect = (selectedFile: File) => {
    // 验证文件类型
    if (!selectedFile.name.endsWith('.csv')) {
      setError('仅支持 CSV 格式文件')
      return
    }

    // 验证文件大小 (5MB)
    if (selectedFile.size > 5 * 1024 * 1024) {
      setError('文件大小不能超过 5MB')
      return
    }

    setFile(selectedFile)
    setError(null)
    setResult(null)
  }

  // 处理文件输入变化
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      handleFileSelect(selectedFile)
    }
  }

  // 处理拖拽
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  // 处理文件放置
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const droppedFile = e.dataTransfer.files?.[0]
    if (droppedFile) {
      handleFileSelect(droppedFile)
    }
  }

  // 打开文件选择器
  const handleClickUpload = () => {
    fileInputRef.current?.click()
  }

  // 执行导入
  const handleImport = async () => {
    if (!file) return

    try {
      setImporting(true)
      setError(null)
      const importResult = await onImport(file)
      setResult(importResult)
    } catch (err: any) {
      setError(err.message || '导入失败')
    } finally {
      setImporting(false)
    }
  }

  // 下载模板
  const handleDownloadTemplate = async () => {
    try {
      await onDownloadTemplate()
    } catch (err: any) {
      setError(err.message || '下载模板失败')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>批量导入客户</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {/* 下载模板提示 */}
          <Alert className="mb-4">
            <p className="text-sm mb-2">
              请先下载 CSV 模板，按照模板格式填写客户信息后上传。
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownloadTemplate}
              className="mt-1"
            >
              <Download className="h-4 w-4 mr-1" />
              下载 CSV 模板
            </Button>
          </Alert>

          {/* 文件上传区域 */}
          {!result && (
            <div
              className={`
                border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all
                ${dragActive ? 'border-primary bg-primary/5' : 'border-border bg-background'}
                hover:border-primary hover:bg-primary/5
              `}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={handleClickUpload}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileInputChange}
                disabled={importing}
              />

              <Upload className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm mb-1">
                {file ? file.name : '点击或拖拽 CSV 文件到此处上传'}
              </p>
              <p className="text-xs text-muted-foreground">
                支持 CSV 格式，最大 5MB
              </p>
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* 导入进度 */}
          {importing && (
            <div className="mt-4">
              <p className="text-sm mb-2">正在导入...</p>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary animate-pulse w-full" />
              </div>
            </div>
          )}

          {/* 导入结果 */}
          {result && (
            <div className="mt-4">
              <Alert
                variant={result.failed === 0 ? 'default' : 'destructive'}
                className={result.failed === 0 ? 'border-green-500 text-green-700' : ''}
              >
                <p className="text-sm">
                  导入完成: 成功 {result.success} 个，失败 {result.failed} 个
                </p>
              </Alert>

              {/* 成功列表 */}
              {result.successList.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    成功导入 ({result.successList.length})
                  </h4>
                  <div className="max-h-48 overflow-auto border rounded-md p-2">
                    {result.successList.slice(0, 10).map((client, index) => (
                      <div key={index} className="text-sm py-1 border-b last:border-0">
                        <div className="font-medium">{client.name}</div>
                        <div className="text-xs text-muted-foreground">{client.contactEmail}</div>
                      </div>
                    ))}
                    {result.successList.length > 10 && (
                      <div className="text-xs text-muted-foreground py-1">
                        还有 {result.successList.length - 10} 个...
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 失败列表 */}
              {result.failedList.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    导入失败 ({result.failedList.length})
                  </h4>
                  <div className="max-h-48 overflow-auto border rounded-md p-2">
                    {result.failedList.map((item, index) => (
                      <div key={index} className="text-sm py-2 border-b last:border-0">
                        <div className="font-medium">第 {item.row} 行: {item.data.name}</div>
                        <div className="text-xs text-destructive">{item.error}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={handleClose}>
            {result ? '关闭' : '取消'}
          </Button>
          {!result && (
            <Button
              onClick={handleImport}
              disabled={!file || importing}
            >
              {importing ? '导入中...' : '开始导入'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
