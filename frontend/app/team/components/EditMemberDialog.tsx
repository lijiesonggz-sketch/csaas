'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
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
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="rounded-sm max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#1E3A5F] font-[var(--font-plus-jakarta)]">
            编辑成员角色
          </DialogTitle>
          <DialogDescription className="text-[#94A3B8]">
            修改组织成员的角色权限
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <p className="text-sm text-[#94A3B8]">
              成员: <span className="font-medium text-[#1E3A5F]">{member?.user?.name || '-'}</span> ({member?.user?.email || '-'})
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-role" className="text-[#1E3A5F]">
              角色
            </Label>
            <Select
              value={role}
              onValueChange={(value) => setRole(value as 'admin' | 'member')}
              disabled={isLoading}
            >
              <SelectTrigger className="rounded-sm" id="edit-role">
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
            onClick={onClose}
            disabled={isLoading}
            className="rounded-sm"
          >
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || role === member?.role}
            className="bg-[#1E3A5F] hover:bg-[#162e4d] text-white rounded-sm"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                更新中...
              </>
            ) : (
              '确认修改'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
