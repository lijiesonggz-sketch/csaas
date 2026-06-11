'use client'

/**
 * 任务进度条组件
 * 显示实时进度和当前步骤
 */

import { useEffect } from 'react'
import { useTaskProgress } from '@/lib/hooks/useTaskProgress'
import { toast } from 'sonner'
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

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
    <div className="p-4 bg-[#F8FAFC] rounded-sm border border-[#E2E8F0]">
      <div className="flex items-center gap-3 mb-3">
        {isCompleted ? (
          <CheckCircle className="h-8 w-8 text-[#059669]" />
        ) : isFailed ? (
          <AlertCircle className="h-8 w-8 text-[#DC2626]" />
        ) : (
          <Loader2 className="h-8 w-8 text-[#1E3A5F] animate-spin" />
        )}

        <div className="flex-1">
          <h3 className="text-lg font-semibold text-[#1E3A5F]">
            {isCompleted ? '✅ 生成完成' : isFailed ? '❌ 生成失败' : '🔄 正在生成...'}
          </h3>
          <p className="text-sm text-[#64748B]">{message || '准备中...'}</p>
        </div>
      </div>

      <Progress
        value={progress}
        className={cn('mb-3 h-2', isCompleted && 'bg-[#059669]', isFailed && 'bg-[#DC2626]')}
      />

      {currentStep && !isCompleted && !isFailed && (
        <p className="text-sm text-[#64748B] mb-3">
          <strong>当前步骤：</strong>
          {currentStep}
        </p>
      )}

      {isCompleted && (
        <Alert className="mb-3 border-[#D1FAE5] bg-[#FEFDFB]">
          <CheckCircle className="h-4 w-4 text-[#059669]" />
          <AlertTitle className="text-[#059669]">综述生成成功</AlertTitle>
          <AlertDescription className="text-[#64748B]">
            三模型并行调用完成，质量验证通过，结果已聚合。请查看下方的生成结果。
          </AlertDescription>
        </Alert>
      )}

      {isFailed && error && (
        <Alert className="mb-3 border-[#FECACA] bg-[#FEF2F2]">
          <AlertCircle className="h-4 w-4 text-[#DC2626]" />
          <AlertTitle className="text-[#DC2626]">综述生成失败</AlertTitle>
          <AlertDescription className="text-[#991B1B]">{error}</AlertDescription>
        </Alert>
      )}

      {!isCompleted && !isFailed && (
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className={cn('p-3 rounded-sm', progress >= 33 ? 'bg-[#D1FAE5]' : 'bg-[#F3F4F6]')}>
            <p className="text-sm font-semibold text-[#1E3A5F]">DeepSeek</p>
            <p className="text-xs text-[#64748B]">
              {progress >= 33 ? '已完成' : progress > 0 ? '处理中...' : '等待中'}
            </p>
          </div>
          <div className={cn('p-3 rounded-sm', progress >= 66 ? 'bg-[#D1FAE5]' : 'bg-[#F3F4F6]')}>
            <p className="text-sm font-semibold text-[#1E3A5F]">Claude</p>
            <p className="text-xs text-[#64748B]">
              {progress >= 66 ? '已完成' : progress > 33 ? '处理中...' : '等待中'}
            </p>
          </div>
          <div className={cn('p-3 rounded-sm', progress >= 100 ? 'bg-[#D1FAE5]' : 'bg-[#F3F4F6]')}>
            <p className="text-sm font-semibold text-[#1E3A5F]">通义千问</p>
            <p className="text-xs text-[#64748B]">
              {progress >= 100 ? '已完成' : progress > 66 ? '处理中...' : '等待中'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
