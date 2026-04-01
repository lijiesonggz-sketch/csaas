'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'

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
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="rounded-sm max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#1E3A5F] font-[var(--font-plus-jakarta)]">
            添加成员
          </DialogTitle>
          <DialogDescription className="text-[#94A3B8]">
            通过邮箱地址添加新成员到组织
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-[#1E3A5F]">
              邮箱地址
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (emailError) validateEmail(e.target.value)
              }}
              placeholder="user@example.com"
              className={emailError ? 'border-red-500 rounded-sm' : 'rounded-sm'}
              disabled={isLoading}
            />
            {emailError && (
              <p className="text-sm text-red-600">{emailError}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="role" className="text-[#1E3A5F]">
              角色
            </Label>
            <Select
              value={role}
              onValueChange={(value) => setRole(value as 'admin' | 'member')}
              disabled={isLoading}
            >
              <SelectTrigger className="rounded-sm" id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">成员</SelectItem>
                <SelectItem value="admin">管理员</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
            className="rounded-sm"
          >
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !email.trim()}
            className="bg-[#1E3A5F] hover:bg-[#162e4d] text-white rounded-sm"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                添加中...
              </>
            ) : (
              '确认添加'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
