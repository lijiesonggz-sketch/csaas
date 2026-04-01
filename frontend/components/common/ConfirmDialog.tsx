'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  content: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
}

const colorVariants: Record<Exclude<ConfirmDialogProps['confirmColor'], undefined>, string> = {
  primary: 'bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white',
  secondary: 'bg-[#64748B] hover:bg-[#64748B]/90 text-white',
  error: 'bg-[#DC2626] hover:bg-[#DC2626]/90 text-white',
  info: 'bg-[#0EA5E9] hover:bg-[#0EA5E9]/90 text-white',
  success: 'bg-[#059669] hover:bg-[#059669]/90 text-white',
  warning: 'bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-white',
};

export function ConfirmDialog({
  open,
  title,
  content,
  confirmText = '确认',
  cancelText = '取消',
  confirmColor = 'primary',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-[#1E3A5F]">
            {title}
          </DialogTitle>
          <DialogDescription className="text-sm text-[#64748B]">
            {content}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2 sm:justify-end">
          <Button
            variant="outline"
            onClick={onCancel}
            className="border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#1E3A5F]"
          >
            {cancelText}
          </Button>
          <Button
            onClick={onConfirm}
            className={colorVariants[confirmColor]}
            autoFocus
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
