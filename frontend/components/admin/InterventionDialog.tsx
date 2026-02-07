/**
 * Intervention Dialog Component
 *
 * Story 7.3: 客户管理与流失风险预警
 *
 * 记录客户干预操作的对话框
 */

'use client'

import React, { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Box,
  Typography,
  Chip,
  Stack,
  Alert,
  CircularProgress,
} from '@mui/material'
import {
  Phone as PhoneIcon,
  Assessment as AssessmentIcon,
  School as SchoolIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material'
import {
  CreateInterventionData,
  InterventionSuggestion,
  INTERVENTION_TYPE_LABELS,
  INTERVENTION_RESULT_LABELS,
} from '@/lib/api/clients-activity'

interface InterventionDialogProps {
  open: boolean
  organizationId: string
  organizationName: string
  suggestions: InterventionSuggestion[]
  onClose: () => void
  onSubmit: (data: CreateInterventionData) => Promise<void>
}

const INTERVENTION_ICONS: Record<string, React.ReactNode> = {
  contact: <PhoneIcon />,
  survey: <AssessmentIcon />,
  training: <SchoolIcon />,
  config_adjustment: <SettingsIcon />,
}

const INTERVENTION_TYPES = [
  { value: 'contact', label: '联系客户' },
  { value: 'survey', label: '发送调研' },
  { value: 'training', label: '提供培训' },
  { value: 'config_adjustment', label: '配置调整' },
]

const INTERVENTION_RESULTS = [
  { value: 'contacted', label: '已联系' },
  { value: 'resolved', label: '已解决' },
  { value: 'churned', label: '已流失' },
  { value: 'pending', label: '待处理' },
]

export function InterventionDialog({
  open,
  organizationId,
  organizationName,
  suggestions,
  onClose,
  onSubmit,
}: InterventionDialogProps) {
  const [interventionType, setInterventionType] = useState('contact')
  const [result, setResult] = useState('contacted')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    try {
      setLoading(true)
      setError(null)
      await onSubmit({
        interventionType: interventionType as any,
        result: result as any,
        notes: notes || undefined,
      })
      handleClose()
    } catch (err: any) {
      setError(err.message || '提交失败')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setInterventionType('contact')
    setResult('contacted')
    setNotes('')
    setError(null)
    onClose()
  }

  const handleSuggestionClick = (suggestion: InterventionSuggestion) => {
    setInterventionType(suggestion.type)
    setNotes(suggestion.description)
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        记录客户干预
        <Typography variant="body2" color="text.secondary">
          {organizationName}
        </Typography>
      </DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* 干预建议 */}
        {suggestions.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              干预建议
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {suggestions.map((suggestion, index) => (
                <Chip
                  key={index}
                  icon={INTERVENTION_ICONS[suggestion.type]}
                  label={suggestion.title}
                  color={
                    suggestion.priority === 'high'
                      ? 'error'
                      : suggestion.priority === 'medium'
                      ? 'warning'
                      : 'default'
                  }
                  onClick={() => handleSuggestionClick(suggestion)}
                  sx={{ cursor: 'pointer' }}
                />
              ))}
            </Stack>
          </Box>
        )}

        <Stack spacing={2}>
          <TextField
            select
            label="干预类型"
            value={interventionType}
            onChange={(e) => setInterventionType(e.target.value)}
            fullWidth
            required
          >
            {INTERVENTION_TYPES.map((type) => (
              <MenuItem key={type.value} value={type.value}>
                {type.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="干预结果"
            value={result}
            onChange={(e) => setResult(e.target.value)}
            fullWidth
            required
          >
            {INTERVENTION_RESULTS.map((r) => (
              <MenuItem key={r.value} value={r.value}>
                {r.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="备注"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            fullWidth
            multiline
            rows={3}
            placeholder="记录干预详情..."
          />
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          取消
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading}
          startIcon={loading && <CircularProgress size={16} />}
        >
          保存
        </Button>
      </DialogActions>
    </Dialog>
  )
}
