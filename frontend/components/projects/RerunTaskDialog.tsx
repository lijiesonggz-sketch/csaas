'use client'

import React, { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  Checkbox,
  FormControlLabel,
} from '@mui/material'
import { Warning, Info } from '@mui/icons-material'
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
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>重新生成{taskTypeName}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <Warning color="warning" sx={{ mt: 0.5 }} />
          <Box>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
              重要提示
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              您即将重新生成「{taskTypeName}」。此操作将：
            </Typography>
          </Box>
        </Box>

        <Box sx={{ pl: 5, mb: 2 }}>
          <Typography variant="body2" color="text.secondary" component="div">
            <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
              <li>创建一个新的{taskTypeName}任务</li>
              <li>
                {hasBackup ? (
                  <>
                    当前结果已自动备份，可通过「回退」按钮恢复
                  </>
                ) : (
                  <>将当前结果保存为备份版本</>
                )}
              </li>
              <li>使用最新的AI模型重新生成内容</li>
              <li>可能产生额外的AI API调用成本</li>
            </ul>
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <Info color="info" fontSize="small" sx={{ mt: 0.3 }} />
          <Typography variant="body2" color="text.secondary">
            提示：如果您对新结果不满意，可以通过「回退」按钮恢复到之前的版本。
          </Typography>
        </Box>

        <FormControlLabel
          control={<Checkbox checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />}
          label="我已了解上述影响，确认重新生成"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          取消
        </Button>
        <Button variant="contained" onClick={handleRerun} disabled={!confirmed || loading} color="warning">
          {loading ? '处理中...' : '确认重新生成'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
