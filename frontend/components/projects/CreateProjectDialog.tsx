'use client'

import React, { useState } from 'react'
import { ProjectsAPI, CreateProjectRequest } from '@/lib/api/projects'
import { X } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface CreateProjectDialogProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

export default function CreateProjectDialog({ open, onClose, onCreated }: CreateProjectDialogProps) {
  const [formData, setFormData] = useState<CreateProjectRequest>({
    name: '',
    description: '',
    clientName: '',
    standardName: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (field: keyof CreateProjectRequest) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }))
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      setError('项目名称不能为空')
      return
    }

    try {
      setLoading(true)
      setError(null)

      await ProjectsAPI.createProject(formData)

      setFormData({
        name: '',
        description: '',
        clientName: '',
        standardName: '',
      })

      onCreated()
    } catch (err: any) {
      console.error('Failed to create project:', err)
      setError(err.message || '创建项目失败')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setFormData({
        name: '',
        description: '',
        clientName: '',
        standardName: '',
      })
      setError(null)
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[600px] rounded-sm">
        <DialogHeader>
          <DialogTitle className="font-[var(--font-plus-jakarta)]">创建新项目</DialogTitle>
          <DialogDescription>
            填写项目信息以创建新的合规咨询项目
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {error && (
            <Alert variant="destructive" className="rounded-sm">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="project-name" className="text-[#1E3A5F]">
              项目名称 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="project-name"
              required
              value={formData.name}
              onChange={handleChange('name')}
              disabled={loading}
              placeholder="例如：ISO27001合规性评估"
              className="rounded-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-description" className="text-[#1E3A5F]">项目描述</Label>
            <Textarea
              id="project-description"
              rows={3}
              value={formData.description}
              onChange={handleChange('description')}
              disabled={loading}
              placeholder="简要描述项目目标和范围"
              className="rounded-sm resize-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="client-name" className="text-[#1E3A5F]">客户名称</Label>
              <Input
                id="client-name"
                value={formData.clientName}
                onChange={handleChange('clientName')}
                disabled={loading}
                placeholder="例如：某某科技有限公司"
                className="rounded-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="standard-name" className="text-[#1E3A5F]">合规标准</Label>
              <Input
                id="standard-name"
                value={formData.standardName}
                onChange={handleChange('standardName')}
                disabled={loading}
                placeholder="例如：ISO27001、GDPR"
                className="rounded-sm"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-4">
            <Button
              type="button"
              onClick={handleClose}
              disabled={loading}
              variant="outline"
              className="rounded-sm"
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-[#1E3A5F] hover:bg-[#162e4d] text-white rounded-sm"
            >
              {loading ? '创建中...' : '创建项目'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
