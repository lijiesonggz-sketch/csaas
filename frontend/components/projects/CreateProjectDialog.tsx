'use client'

import React, { useState } from 'react'
import { ProjectsAPI, CreateProjectRequest } from '@/lib/api/projects'
import { Close } from '@mui/icons-material'
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Box, Typography, CircularProgress, Alert, IconButton } from '@mui/material'

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

  if (!open) return null

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'background.paper',
          borderRadius: 4,
        },
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 2, borderBottom: '1px solid #e5e7eb' }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          创建新项目
        </Typography>
        <IconButton
          onClick={handleClose}
          disabled={loading}
          aria-label="关闭对话框"
        >
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 6, py: 4 }}>
        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <Box>
            <Typography variant="body2" component="label" htmlFor="project-name" sx={{ display: 'block', fontWeight: 500, mb: 1, color: 'text.primary' }}>
              项目名称 <Box component="span" sx={{ color: 'error.main' }}>*</Box>
            </Typography>
            <TextField
              id="project-name"
              fullWidth
              required
              value={formData.name}
              onChange={handleChange('name')}
              disabled={loading}
              placeholder="例如：ISO27001合规性评估"
              size="small"
            />
          </Box>

          <Box>
            <Typography variant="body2" component="label" htmlFor="project-description" sx={{ display: 'block', fontWeight: 500, mb: 1, color: 'text.primary' }}>
              项目描述
            </Typography>
            <TextField
              id="project-description"
              fullWidth
              multiline
              rows={3}
              value={formData.description}
              onChange={handleChange('description')}
              disabled={loading}
              placeholder="简要描述项目目标和范围"
              size="small"
            />
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 4 }}>
            <Box>
              <Typography variant="body2" component="label" htmlFor="client-name" sx={{ display: 'block', fontWeight: 500, mb: 1, color: 'text.primary' }}>
                客户名称
              </Typography>
              <TextField
                id="client-name"
                fullWidth
                value={formData.clientName}
                onChange={handleChange('clientName')}
                disabled={loading}
                placeholder="例如：某某科技有限公司"
                size="small"
              />
            </Box>

            <Box>
              <Typography variant="body2" component="label" htmlFor="standard-name" sx={{ display: 'block', fontWeight: 500, mb: 1, color: 'text.primary' }}>
                合规标准
              </Typography>
              <TextField
                id="standard-name"
                fullWidth
                value={formData.standardName}
                onChange={handleChange('standardName')}
                disabled={loading}
                placeholder="例如：ISO27001、GDPR"
                size="small"
              />
            </Box>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 6, py: 3, gap: 2, borderTop: '1px solid #e5e7eb' }}>
        <Button
          onClick={handleClose}
          disabled={loading}
          size="large"
        >
          取消
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={loading}
          size="large"
          onClick={handleSubmit}
          startIcon={loading ? <CircularProgress size={20} /> : null}
          sx={{
            background: 'linear-gradient(90deg, #6366f1 0%, #9333ea 100%)',
            color: 'white',
            '&:hover': {
              background: 'linear-gradient(90deg, #5555f6 0%, #7e22ce 100%)',
              boxShadow: '0 4px 6px rgba(99, 102, 241, 0.4)',
            },
          }}
        >
          {loading ? '创建中...' : '创建项目'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
