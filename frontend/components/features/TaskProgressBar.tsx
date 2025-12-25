'use client'

/**
 * 任务进度条组件
 * 显示实时进度和当前步骤
 */

import { Progress, Spin, Alert } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined } from '@ant-design/icons'
import { useTaskProgress } from '@/lib/hooks/useTaskProgress'

interface TaskProgressBarProps {
  taskId: string | null
  onCompleted?: () => void
  onFailed?: (error: string) => void
}

export default function TaskProgressBar({ taskId, onCompleted, onFailed }: TaskProgressBarProps) {
  const { progress, message, currentStep, isCompleted, isFailed, error } = useTaskProgress(taskId)

  // 触发回调
  if (isCompleted && onCompleted) {
    onCompleted()
  }

  if (isFailed && onFailed && error) {
    onFailed(error)
  }

  if (!taskId) {
    return null
  }

  return (
    <div className="space-y-4 p-6 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-3">
        {isCompleted ? (
          <CheckCircleOutlined className="text-2xl text-green-500" />
        ) : isFailed ? (
          <CloseCircleOutlined className="text-2xl text-red-500" />
        ) : (
          <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
        )}

        <div className="flex-1">
          <h3 className="text-lg font-semibold">
            {isCompleted ? '✅ 生成完成' : isFailed ? '❌ 生成失败' : '🔄 正在生成...'}
          </h3>
          <p className="text-sm text-gray-600">{message || '准备中...'}</p>
        </div>
      </div>

      <Progress
        percent={progress}
        status={isCompleted ? 'success' : isFailed ? 'exception' : 'active'}
        strokeColor={{
          '0%': '#108ee9',
          '100%': '#87d068',
        }}
      />

      {currentStep && !isCompleted && !isFailed && (
        <div className="text-sm text-gray-500">
          <span className="font-medium">当前步骤：</span>
          {currentStep}
        </div>
      )}

      {isCompleted && (
        <Alert
          message="综述生成成功"
          description="三模型并行调用完成，质量验证通过，结果已聚合。请查看下方的生成结果。"
          type="success"
          showIcon
        />
      )}

      {isFailed && error && (
        <Alert
          message="综述生成失败"
          description={error}
          type="error"
          showIcon
        />
      )}

      {!isCompleted && !isFailed && (
        <div className="grid grid-cols-3 gap-4 text-center text-sm">
          <div className={`p-3 rounded ${progress >= 33 ? 'bg-green-100' : 'bg-gray-100'}`}>
            <div className="font-medium">GPT-4</div>
            <div className="text-xs text-gray-500">
              {progress >= 33 ? '已完成' : progress > 0 ? '处理中...' : '等待中'}
            </div>
          </div>
          <div className={`p-3 rounded ${progress >= 66 ? 'bg-green-100' : 'bg-gray-100'}`}>
            <div className="font-medium">Claude</div>
            <div className="text-xs text-gray-500">
              {progress >= 66 ? '已完成' : progress > 33 ? '处理中...' : '等待中'}
            </div>
          </div>
          <div className={`p-3 rounded ${progress >= 100 ? 'bg-green-100' : 'bg-gray-100'}`}>
            <div className="font-medium">通义千问</div>
            <div className="text-xs text-gray-500">
              {progress >= 100 ? '已完成' : progress > 66 ? '处理中...' : '等待中'}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
