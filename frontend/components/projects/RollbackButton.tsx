'use client'

import React, { useState } from 'react'
import { Button, Menu, MenuItem, Typography, Box, Divider, Alert, CircularProgress } from '@mui/material'
import { History, Backup } from '@mui/icons-material'
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
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [loading, setLoading] = useState(false)
  const [backupInfo, setBackupInfo] = useState<BackupInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  const open = Boolean(anchorEl)

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    if (!disabled && backupExists) {
      setAnchorEl(event.currentTarget)
      loadBackupInfo()
    }
  }

  const handleClose = () => {
    setAnchorEl(null)
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

  return (
    <>
      <Button
        variant="outlined"
        startIcon={<History />}
        onClick={handleClick}
        disabled={disabled || !backupExists}
        color="secondary"
      >
        回退版本
      </Button>

      <Menu anchorEl={anchorEl} open={open} onClose={handleClose} PaperProps={{ sx: { minWidth: 350 } }}>
        {loading ? (
          <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Box sx={{ p: 2 }}>
            <Alert severity="error">{error}</Alert>
          </Box>
        ) : (
          <>
            <Box sx={{ p: 2 }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                版本历史
              </Typography>

              <Box sx={{ mt: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Backup fontSize="small" color="success" />
                  <Typography variant="body2" color="text.secondary">
                    当前版本
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ pl: 3 }}>
                  {formatDate(backupInfo?.currentCreatedAt)}
                </Typography>
              </Box>

              <Divider sx={{ my: 1.5 }} />

              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <History fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">
                    备份版本
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ pl: 3 }}>
                  {formatDate(backupInfo?.backupCreatedAt)}
                </Typography>
              </Box>
            </Box>

            <Divider />

            <Box sx={{ p: 1 }}>
              {!showConfirm ? (
                <MenuItem
                  onClick={() => setShowConfirm(true)}
                  sx={{ justifyContent: 'center', color: 'warning.main' }}
                >
                  回退到备份版本
                </MenuItem>
              ) : (
                <Box sx={{ p: 1 }}>
                  <Typography variant="body2" gutterBottom align="center">
                    确认回退到备份版本？
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                    <Button size="small" onClick={() => setShowConfirm(false)} fullWidth>
                      取消
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      color="warning"
                      onClick={handleRollback}
                      fullWidth
                      disabled={loading}
                    >
                      {loading ? '处理中...' : '确认回退'}
                    </Button>
                  </Box>
                </Box>
              )}
            </Box>
          </>
        )}
      </Menu>
    </>
  )
}
