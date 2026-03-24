'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { History, Database, AlertCircle, Loader2 } from 'lucide-react'
import { ProjectsAPI } from '@/lib/api/projects'

interface RollbackButtonProps {
  projectId: string
  taskType: string
  taskTypeName: string
  backupExists?: boolean
  onRollbackComplete?: () => void
  disabled?: boolean
}

interface BackupInfo {
  hasBackup: boolean
  backupCreatedAt?: string
  currentCreatedAt?: string
}

export default function RollbackButton({
  projectId,
  taskType,
  taskTypeName,
  backupExists = false,
  onRollbackComplete,
  disabled = false,
}: RollbackButtonProps) {
  const [loading, setLoading] = useState(false)
  const [backupInfo, setBackupInfo] = useState<BackupInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [open, setOpen] = useState(false)

  const handleClick = () => {
    if (!disabled && backupExists) {
      loadBackupInfo()
    }
  }

  const handleClose = () => {
    setOpen(false)
    setShowConfirm(false)
    setError(null)
  }

  const loadBackupInfo = async () => {
    try {
      setLoading(true)
      const info = await ProjectsAPI.getBackupInfo(projectId, taskType)
      setBackupInfo(info)
    } catch (err: any) {
      console.error('Failed to load backup info:', err)
      setError(err.message || '加载备份信息失败')
    } finally {
      setLoading(false)
    }
  }

  const handleRollback = async () => {
    try {
      setLoading(true)
      setError(null)

      await ProjectsAPI.rollbackTask(projectId, {
        type: taskType as any,
      })

      onRollbackComplete?.()
      handleClose()
    } catch (err: any) {
      console.error('Failed to rollback task:', err)
      setError(err.message || '回退失败')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '未知'
    return new Date(dateString).toLocaleString('zh-CN')
  }

  if (!backupExists) {
    return (
      <Button variant="outline" disabled>
        <History className="w-4 h-4 mr-2" />
        回退版本
      </Button>
    )
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" onClick={handleClick} disabled={disabled}>
          <History className="w-4 h-4 mr-2" />
          回退版本
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80">
        {loading ? (
          <div className="p-4 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : error ? (
          <div className="p-2">
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertTitle>错误</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        ) : (
          <>
            <div className="p-3">
              <p className="font-semibold text-sm mb-3">版本历史</p>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm text-slate-600">当前版本</span>
                </div>
                <p className="text-xs text-slate-400 pl-6">
                  {formatDate(backupInfo?.currentCreatedAt)}
                </p>
              </div>

              <DropdownMenuSeparator className="my-2" />

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-slate-500" />
                  <span className="text-sm text-slate-600">备份版本</span>
                </div>
                <p className="text-xs text-slate-400 pl-6">
                  {formatDate(backupInfo?.backupCreatedAt)}
                </p>
              </div>
            </div>

            <DropdownMenuSeparator />

            <div className="p-1">
              {!showConfirm ? (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault()
                    setShowConfirm(true)
                  }}
                  className="justify-center text-amber-600 cursor-pointer"
                >
                  回退到备份版本
                </DropdownMenuItem>
              ) : (
                <div className="p-2 space-y-2">
                  <p className="text-sm text-center">确认回退到备份版本？</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowConfirm(false)}
                      className="flex-1"
                    >
                      取消
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handleRollback}
                      disabled={loading}
                      className="flex-1"
                    >
                      {loading ? '处理中...' : '确认回退'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
