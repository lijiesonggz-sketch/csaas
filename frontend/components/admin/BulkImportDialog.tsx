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
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Alert,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Divider,
  Link,
} from '@mui/material'
import {
  CloudUpload as UploadIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Download as DownloadIcon,
} from '@mui/icons-material'
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
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>批量导入客户</DialogTitle>
      <DialogContent>
        <Box sx={{ py: 2 }}>
          {/* 下载模板提示 */}
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2" gutterBottom>
              请先下载 CSV 模板，按照模板格式填写客户信息后上传。
            </Typography>
            <Button
              size="small"
              startIcon={<DownloadIcon />}
              onClick={handleDownloadTemplate}
              sx={{ mt: 1 }}
            >
              下载 CSV 模板
            </Button>
          </Alert>

          {/* 文件上传区域 */}
          {!result && (
            <Box
              sx={{
                border: '2px dashed',
                borderColor: dragActive ? 'primary.main' : 'divider',
                borderRadius: 2,
                p: 4,
                textAlign: 'center',
                backgroundColor: dragActive ? 'action.hover' : 'background.paper',
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  borderColor: 'primary.main',
                  backgroundColor: 'action.hover',
                },
              }}
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
                style={{ display: 'none' }}
                onChange={handleFileInputChange}
                disabled={importing}
              />

              <UploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="body1" gutterBottom>
                {file ? file.name : '点击或拖拽 CSV 文件到此处上传'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                支持 CSV 格式，最大 5MB
              </Typography>
            </Box>
          )}

          {/* 错误提示 */}
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}

          {/* 导入进度 */}
          {importing && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" gutterBottom>
                正在导入...
              </Typography>
              <LinearProgress />
            </Box>
          )}

          {/* 导入结果 */}
          {result && (
            <Box sx={{ mt: 2 }}>
              <Alert
                severity={result.failed === 0 ? 'success' : 'warning'}
                sx={{ mb: 2 }}
              >
                <Typography variant="body2">
                  导入完成: 成功 {result.success} 个，失败 {result.failed} 个
                </Typography>
              </Alert>

              {/* 成功列表 */}
              {result.successList.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    <SuccessIcon
                      sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5, color: 'success.main' }}
                    />
                    成功导入 ({result.successList.length})
                  </Typography>
                  <List dense sx={{ maxHeight: 200, overflow: 'auto' }}>
                    {result.successList.slice(0, 10).map((client, index) => (
                      <ListItem key={index}>
                        <ListItemText
                          primary={client.name}
                          secondary={client.contactEmail}
                        />
                      </ListItem>
                    ))}
                    {result.successList.length > 10 && (
                      <ListItem>
                        <ListItemText
                          secondary={`还有 ${result.successList.length - 10} 个...`}
                        />
                      </ListItem>
                    )}
                  </List>
                </Box>
              )}

              {/* 失败列表 */}
              {result.failedList.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    <ErrorIcon
                      sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5, color: 'error.main' }}
                    />
                    导入失败 ({result.failedList.length})
                  </Typography>
                  <List dense sx={{ maxHeight: 200, overflow: 'auto' }}>
                    {result.failedList.map((item, index) => (
                      <ListItem key={index}>
                        <ListItemText
                          primary={`第 ${item.row} 行: ${item.data.name}`}
                          secondary={item.error}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>
          {result ? '关闭' : '取消'}
        </Button>
        {!result && (
          <Button
            onClick={handleImport}
            variant="contained"
            disabled={!file || importing}
          >
            {importing ? '导入中...' : '开始导入'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
