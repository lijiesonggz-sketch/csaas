'use client'

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  CircularProgress,
} from '@mui/material'
import { OrganizationMember } from '@/lib/types/organization'

interface ConfirmRemoveDialogProps {
  open: boolean
  member: OrganizationMember | null
  onClose: () => void
  onConfirm: () => void
  isLoading: boolean
}

export function ConfirmRemoveDialog({
  open,
  member,
  onClose,
  onConfirm,
  isLoading,
}: ConfirmRemoveDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>确认移除成员</DialogTitle>
      <DialogContent>
        <Typography>
          确定要将 <strong>{member?.user?.name || member?.user?.email || '该成员'}</strong> 从组织中移除吗？
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          移除后，该成员将无法访问组织的项目和资源。
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isLoading}>
          取消
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color="error"
          disabled={isLoading}
          startIcon={isLoading ? <CircularProgress size={16} /> : undefined}
        >
          {isLoading ? '移除中...' : '确认移除'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
