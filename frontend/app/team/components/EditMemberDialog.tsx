'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Box,
  CircularProgress,
} from '@mui/material'
import { OrganizationMember } from '@/lib/types/organization'

interface EditMemberDialogProps {
  open: boolean
  member: OrganizationMember | null
  onClose: () => void
  onSubmit: (role: 'admin' | 'member') => void
  isLoading: boolean
}

export function EditMemberDialog({
  open,
  member,
  onClose,
  onSubmit,
  isLoading,
}: EditMemberDialogProps) {
  const [role, setRole] = useState<'admin' | 'member'>('member')

  useEffect(() => {
    if (member) {
      setRole(member.role)
    }
  }, [member])

  const handleSubmit = () => {
    onSubmit(role)
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>编辑成员角色</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            成员: {member?.user?.name || '-'} ({member?.user?.email || '-'})
          </Typography>
          <FormControl fullWidth>
            <InputLabel>角色</InputLabel>
            <Select
              value={role}
              label="角色"
              onChange={(e) => setRole(e.target.value as 'admin' | 'member')}
              disabled={isLoading}
            >
              <MenuItem value="member">成员</MenuItem>
              <MenuItem value="admin">管理员</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isLoading}>
          取消
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={isLoading || role === member?.role}
          startIcon={isLoading ? <CircularProgress size={16} /> : undefined}
        >
          {isLoading ? '更新中...' : '确认修改'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
