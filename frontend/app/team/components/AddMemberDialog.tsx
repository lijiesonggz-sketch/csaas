'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  CircularProgress,
} from '@mui/material'

interface AddMemberDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: { email: string; role: 'admin' | 'member' }) => void
  isLoading: boolean
}

export function AddMemberDialog({ open, onClose, onSubmit, isLoading }: AddMemberDialogProps) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'member'>('member')
  const [emailError, setEmailError] = useState('')

  const validateEmail = (value: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!value.trim()) {
      setEmailError('请输入邮箱地址')
      return false
    }
    if (!emailRegex.test(value)) {
      setEmailError('请输入有效的邮箱地址')
      return false
    }
    setEmailError('')
    return true
  }

  const handleSubmit = () => {
    if (!validateEmail(email)) return
    onSubmit({ email: email.trim(), role })
    // Reset form state after submission
    setEmail('')
    setRole('member')
    setEmailError('')
  }

  const handleClose = () => {
    setEmail('')
    setRole('member')
    setEmailError('')
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>添加成员</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="邮箱地址"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (emailError) validateEmail(e.target.value)
            }}
            error={!!emailError}
            helperText={emailError}
            fullWidth
            autoFocus
            disabled={isLoading}
          />
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
        <Button onClick={handleClose} disabled={isLoading}>
          取消
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={isLoading || !email.trim()}
          startIcon={isLoading ? <CircularProgress size={16} /> : undefined}
        >
          {isLoading ? '添加中...' : '确认添加'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
