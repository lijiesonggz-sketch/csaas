'use client'

/**
 * 任务进度条组件
 * 显示实时进度和当前步骤
 */

import { useEffect } from 'react'
import { useTaskProgress } from '@/lib/hooks/useTaskProgress'
import { toast } from 'sonner'
import CircularProgress from '@mui/material/CircularProgress'
import LinearProgress from '@mui/material/LinearProgress'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'

interface TaskProgressBarProps {
  taskId: string | null
  onCompleted?: () => void
  onFailed?: (error: string) => void
}

export default function TaskProgressBar({ taskId, onCompleted, onFailed }: TaskProgressBarProps) {
  const { progress, message, currentStep, isCompleted, isFailed, error } = useTaskProgress(taskId)

  // 触发回调（在 useEffect 中执行，避免在渲染期间产生副作用）
  useEffect(() => {
    if (isCompleted && onCompleted) {
      onCompleted()
    }
  }, [isCompleted, onCompleted])

  useEffect(() => {
    if (isFailed && onFailed && error) {
      onFailed(error)
    }
  }, [isFailed, onFailed, error])

  if (!taskId) {
    return null
  }

  return (
    <Box sx={{ p: 3, bgcolor: 'grey.50', borderRadius: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        {isCompleted ? (
          <CheckCircleIcon color="success" sx={{ fontSize: 32 }} />
        ) : isFailed ? (
          <ErrorIcon color="error" sx={{ fontSize: 32 }} />
        ) : (
          <CircularProgress size={32} />
        )}

        <Box sx={{ flex: 1 }}>
          <Typography variant="h6">
            {isCompleted ? '✅ 生成完成' : isFailed ? '❌ 生成失败' : '🔄 正在生成...'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {message || '准备中...'}
          </Typography>
        </Box>
      </Box>

      <LinearProgress
        variant="determinate"
        value={progress}
        color={isCompleted ? 'success' : isFailed ? 'error' : 'primary'}
        sx={{ mb: 2, height: 8, borderRadius: 1 }}
      />

      {currentStep && !isCompleted && !isFailed && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          <strong>当前步骤：</strong>
          {currentStep}
        </Typography>
      )}

      {isCompleted && (
        <Alert severity="success" sx={{ mb: 2 }}>
          <Typography variant="subtitle2">综述生成成功</Typography>
          <Typography variant="body2">
            三模型并行调用完成，质量验证通过，结果已聚合。请查看下方的生成结果。
          </Typography>
        </Alert>
      )}

      {isFailed && error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <Typography variant="subtitle2">综述生成失败</Typography>
          <Typography variant="body2">{error}</Typography>
        </Alert>
      )}

      {!isCompleted && !isFailed && (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, textAlign: 'center' }}>
          <Box
            sx={{
              p: 2,
              borderRadius: 1,
              bgcolor: progress >= 33 ? 'success.light' : 'grey.100',
            }}
          >
            <Typography variant="subtitle2">GPT-4</Typography>
            <Typography variant="caption" color="text.secondary">
              {progress >= 33 ? '已完成' : progress > 0 ? '处理中...' : '等待中'}
            </Typography>
          </Box>
          <Box
            sx={{
              p: 2,
              borderRadius: 1,
              bgcolor: progress >= 66 ? 'success.light' : 'grey.100',
            }}
          >
            <Typography variant="subtitle2">Claude</Typography>
            <Typography variant="caption" color="text.secondary">
              {progress >= 66 ? '已完成' : progress > 33 ? '处理中...' : '等待中'}
            </Typography>
          </Box>
          <Box
            sx={{
              p: 2,
              borderRadius: 1,
              bgcolor: progress >= 100 ? 'success.light' : 'grey.100',
            }}
          >
            <Typography variant="subtitle2">通义千问</Typography>
            <Typography variant="caption" color="text.secondary">
              {progress >= 100 ? '已完成' : progress > 66 ? '处理中...' : '等待中'}
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  )
}
