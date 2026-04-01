/**
 * Intervention Dialog Component
 *
 * Story 7.3: 客户管理与流失风险预警
 *
 * 记录客户干预操作的对话框
 */

'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState } from 'react'
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
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2 } from 'lucide-react'
import {
  Phone,
  BarChart3,
  GraduationCap,
  Settings,
} from 'lucide-react'
import {
  CreateInterventionData,
  InterventionSuggestion,
} from '@/lib/api/clients-activity'

interface InterventionDialogProps {
  open: boolean
  organizationName: string
  suggestions: InterventionSuggestion[]
  onClose: () => void
  onSubmit: (data: CreateInterventionData) => Promise<void>
}

const INTERVENTION_ICONS: Record<string, React.ReactNode> = {
  contact: <Phone className="h-3 w-3" />,
  survey: <BarChart3 className="h-3 w-3" />,
  training: <GraduationCap className="h-3 w-3" />,
  config_adjustment: <Settings className="h-3 w-3" />,
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
  organizationName,
  suggestions,
  onClose,
  onSubmit,
}: InterventionDialogProps) {
  const [interventionType, setInterventionType] = useState<CreateInterventionData['interventionType']>('contact')
  const [result, setResult] = useState<CreateInterventionData['result']>('contacted')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    try {
      setLoading(true)
      setError(null)
      await onSubmit({
        interventionType,
        result,
        notes: notes || undefined,
      })
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败')
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

  const getPriorityVariant = (priority: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    if (priority === 'high') return 'destructive'
    if (priority === 'medium') return 'secondary'
    return 'outline'
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>记录客户干预</DialogTitle>
          <DialogDescription>{organizationName}</DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* 干预建议 */}
        {suggestions.length > 0 && (
          <div className="mb-4">
            <Label className="mb-2 block">干预建议</Label>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion, index) => (
                <Badge
                  key={index}
                  variant={getPriorityVariant(suggestion.priority)}
                  className="cursor-pointer gap-1"
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  {INTERVENTION_ICONS[suggestion.type]}
                  {suggestion.title}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="intervention-type">干预类型</Label>
            <Select
              value={interventionType}
              onValueChange={(value) => setInterventionType(value as CreateInterventionData['interventionType'])}
            >
              <SelectTrigger id="intervention-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTERVENTION_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="result">干预结果</Label>
            <Select
              value={result}
              onValueChange={(value) => setResult(value as CreateInterventionData['result'])}
            >
              <SelectTrigger id="result">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTERVENTION_RESULTS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">备注</Label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="记录干预详情..."
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleClose} disabled={loading} variant="outline">
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
