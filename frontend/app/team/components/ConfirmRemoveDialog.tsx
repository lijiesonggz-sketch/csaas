'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2, AlertTriangle } from 'lucide-react'
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
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="rounded-sm max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#1E3A5F] font-[var(--font-plus-jakarta)] flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            确认移除成员
          </DialogTitle>
          <DialogDescription className="text-[#94A3B8]">
            此操作将移除该成员对组织的访问权限
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p className="text-[#1E3A5F]">
            确定要将 <strong className="text-[#059669]">{member?.user?.name || member?.user?.email || '该成员'}</strong> 从组织中移除吗？
          </p>
          <p className="text-sm text-[#94A3B8] mt-2">
            移除后，该成员将无法访问组织的项目和资源。
          </p>
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
            onClick={onConfirm}
            disabled={isLoading}
            className="bg-red-600 hover:bg-red-700 text-white rounded-sm"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                移除中...
              </>
            ) : (
              '确认移除'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
