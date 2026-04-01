'use client'

import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle, Info, Loader2 } from 'lucide-react'
import { ProjectsAPI } from '@/lib/api/projects'

interface RerunTaskDialogProps {
  open: boolean
  onClose: () => void
  projectId: string
  taskType: string
  taskTypeName: string
  hasBackup?: boolean
  onRerunComplete?: () => void
}

export default function RerunTaskDialog({
  open,
  onClose,
  projectId,
  taskType,
  taskTypeName,
  hasBackup = false,
  onRerunComplete,
}: RerunTaskDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  const handleRerun = async () => {
    if (!confirmed) {
      setError('请先确认您了解上述影响')
      return
    }

    try {
      setLoading(true)
      setError(null)

      await ProjectsAPI.rerunTask(projectId, {
        type: taskType as any,
      })

      onRerunComplete?.()
      onClose()
    } catch (err: any) {
      console.error('Failed to rerun task:', err)
      setError(err.message || '重跑任务失败')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setConfirmed(false)
      setError(null)
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="rounded-sm max-w-md">
        <DialogHeader>
          <DialogTitle>重新生成{taskTypeName}</DialogTitle>
          <DialogDescription />
        </DialogHeader>

        {error && (
          <Alert variant="destructive" className="mb-3">
            <AlertDescription className="flex items-center justify-between">
              {error}
              <button
                type="button"
                onClick={() => setError(null)}
                className="text-xs underline ml-2"
              >
                关闭
              </button>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-3 mb-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-[#1E3A5F] mb-1">重要提示</p>
            <p className="text-sm text-[#64748B]">
              您即将重新生成「{taskTypeName}」。此操作将：
            </p>
          </div>
        </div>

        <ul className="pl-9 mb-3 space-y-1 text-sm text-[#64748B] list-disc list-inside">
          <li>创建一个新的{taskTypeName}任务</li>
          <li>
            {hasBackup
              ? '当前结果已自动备份，可通过「回退」按钮恢复'
              : '将当前结果保存为备份版本'}
          </li>
          <li>使用最新的AI模型重新生成内容</li>
          <li>可能产生额外的AI API调用成本</li>
        </ul>

        <div className="flex gap-2 mb-4">
          <Info className="w-4 h-4 text-[#1E3A5F] mt-0.5 flex-shrink-0" />
          <p className="text-xs text-[#94A3B8]">
            提示：如果您对新结果不满意，可以通过「回退」按钮恢复到之前的版本。
          </p>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <Checkbox
            id="confirm-rerun"
            checked={confirmed}
            onCheckedChange={(checked) => setConfirmed(checked === true)}
          />
          <Label htmlFor="confirm-rerun" className="text-sm text-[#1E3A5F] cursor-pointer">
            我已了解上述影响，确认重新生成
          </Label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading} className="rounded-sm">
            取消
          </Button>
          <Button
            onClick={handleRerun}
            disabled={!confirmed || loading}
            className="rounded-sm bg-amber-600 hover:bg-amber-700 text-white"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                处理中...
              </>
            ) : (
              '确认重新生成'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
