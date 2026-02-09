'use client'

import React from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  Paper,
  Divider,
} from '@mui/material'
import {
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  AccessTime as TimeIcon,
} from '@mui/icons-material'
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
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {isLoading && <CircularProgress size={20} />}
          {isSuccess && <SuccessIcon color="success" />}
          {isFailed && <ErrorIcon color="error" />}
          <Typography variant="h6">
            测试采集 - {source?.source || ''}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        {isLoading && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CircularProgress size={40} />
            <Typography variant="body1" sx={{ mt: 2 }}>
              正在采集，请稍候...
            </Typography>
          </Box>
        )}

        {isFailed && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold">
              采集失败
            </Typography>
            <Typography variant="body2">{result.error}</Typography>
          </Alert>
        )}

        {isSuccess && (
          <Box>
            {/* 状态栏 */}
            <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
              <Chip
                icon={<SuccessIcon />}
                label="采集成功"
                color="success"
                size="small"
              />
              {result.result?.duration && (
                <Chip
                  icon={<TimeIcon />}
                  label={`耗时: ${result.result.duration}ms`}
                  size="small"
                />
              )}
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* 标题 */}
            {result.result?.title && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  标题
                </Typography>
                <Typography variant="h6">
                  {result.result.title}
                </Typography>
              </Box>
            )}

            {/* 作者 */}
            {result.result?.author && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  作者
                </Typography>
                <Typography variant="body1">
                  {result.result.author}
                </Typography>
              </Box>
            )}

            {/* 发布日期 */}
            {result.result?.publishDate && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  发布日期
                </Typography>
                <Typography variant="body1">
                  {new Date(result.result.publishDate).toLocaleString('zh-CN')}
                </Typography>
              </Box>
            )}

            {/* 摘要 */}
            {result.result?.summary && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  摘要
                </Typography>
                <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                  <Typography variant="body2">
                    {result.result.summary}
                  </Typography>
                </Paper>
              </Box>
            )}

            {/* 正文预览 */}
            {result.result?.contentPreview && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  正文预览（前500字）
                </Typography>
                <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                  <Typography
                    variant="body2"
                    sx={{
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      maxHeight: 200,
                      overflow: 'auto',
                    }}
                  >
                    {result.result.contentPreview}
                  </Typography>
                </Paper>
              </Box>
            )}

            {/* 原始URL */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                采集URL
              </Typography>
              <Typography
                variant="body2"
                component="a"
                href={result.result?.url || source?.url}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ color: 'primary.main' }}
              >
                {result.result?.url || source?.url}
              </Typography>
            </Box>

            <Alert severity="info" sx={{ mt: 2 }}>
              注意：测试采集的内容不会保存到数据库，仅用于验证配置是否正确。
            </Alert>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          {isLoading ? '取消' : '关闭'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
