/**
 * Churn Risk Detail Dialog Component
 *
 * Story 7.3: 客户管理与流失风险预警
 *
 * 显示流失风险客户详情和干预操作
 */

'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'
import {
  AlertTriangle,
  TrendingDown,
  User,
  Mail,
  Calendar,
  BarChart3,
  History,
  Phone,
} from 'lucide-react'
import {
  ClientActivity,
  Intervention,
  InterventionSuggestion,
  getClientActivityDetails,
  getInterventionSuggestions,
  getInterventionHistory,
  createIntervention,
  INTERVENTION_TYPE_LABELS,
  INTERVENTION_RESULT_LABELS,
  CreateInterventionData,
} from '@/lib/api/clients-activity'
import { InterventionDialog } from './InterventionDialog'

interface ChurnRiskDetailDialogProps {
  open: boolean
  client: ClientActivity | null
  onClose: () => void
  onInterventionCreated?: () => void
}

export function ChurnRiskDetailDialog({
  open,
  client,
  onClose,
  onInterventionCreated,
}: ChurnRiskDetailDialogProps) {
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<InterventionSuggestion[]>([])
  const [interventions, setInterventions] = useState<Intervention[]>([])
  const [interventionDialogOpen, setInterventionDialogOpen] = useState(false)

  const loadDetails = useCallback(async () => {
    if (!client) return

    try {
      setLoading(true)
      const [, suggestionsData, historyData] = await Promise.all([
        getClientActivityDetails(client.organizationId),
        getInterventionSuggestions(client.organizationId),
        getInterventionHistory(client.organizationId),
      ])
      setSuggestions(suggestionsData)
      setInterventions(historyData)
    } catch (err) {
      console.error('Failed to load details:', err)
    } finally {
      setLoading(false)
    }
  }, [client])

  useEffect(() => {
    if (open && client) {
      void loadDetails()
    }
  }, [client, loadDetails, open])

  const handleCreateIntervention = async (data: CreateInterventionData) => {
    if (!client) return
    await createIntervention(client.organizationId, data)
    await loadDetails()
    onInterventionCreated?.()
  }

  if (!client) return null

  const resultBadgeVariant = (result: string): 'default' | 'destructive' | 'outline' | 'secondary' => {
    if (result === 'resolved') return 'default'
    if (result === 'churned') return 'destructive'
    if (result === 'contacted') return 'secondary'
    return 'outline'
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              流失风险客户详情
            </DialogTitle>
            <DialogDescription>{client.name}</DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* 风险告警 */}
              <Alert variant="destructive">
                <AlertTitle>流失风险警告</AlertTitle>
                <AlertDescription>
                  该客户月活率为 {client.monthlyActivityRate.toFixed(1)}%，低于 60% 阈值，建议立即采取干预措施。
                </AlertDescription>
              </Alert>

              <div className="grid md:grid-cols-2 gap-4">
                {/* 基本信息 */}
                <div className="border rounded-lg p-4">
                  <h4 className="text-sm font-medium mb-3">联系信息</h4>
                  <div className="space-y-2">
                    {client.contactPerson && (
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{client.contactPerson}</span>
                      </div>
                    )}
                    {client.contactEmail && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{client.contactEmail}</span>
                      </div>
                    )}
                    {client.lastActiveAt && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          最后活跃: {new Date(client.lastActiveAt).toLocaleString('zh-CN')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 活跃度统计 */}
                <div className="border rounded-lg p-4">
                  <h4 className="text-sm font-medium mb-3">活跃度统计</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">月活率</span>
                      <span className="text-sm font-bold text-destructive">
                        {client.monthlyActivityRate.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">30天活跃天数</span>
                      <span className="text-sm">{client.activeDaysLast30} 天</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">登录活跃率</span>
                      <span className="text-sm">{client.loginActivityRate.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">内容消费率</span>
                      <span className="text-sm">{client.contentActivityRate.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 流失原因 */}
              {client.churnRiskFactors.length > 0 && (
                <div className="border rounded-lg p-4">
                  <h4 className="text-sm font-medium mb-3">流失原因分析</h4>
                  <div className="flex flex-wrap gap-2">
                    {client.churnRiskFactors.map((factor, index) => (
                      <Badge key={index} variant="destructive" className="gap-1">
                        <TrendingDown className="h-3 w-3" />
                        {factor}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* 干预建议 */}
              {suggestions.length > 0 && (
                <div className="border rounded-lg p-4">
                  <h4 className="text-sm font-medium mb-3">干预建议</h4>
                  <div className="space-y-2">
                    {suggestions.map((suggestion, index) => (
                      <div key={index} className="flex items-start gap-3 p-2 rounded hover:bg-muted">
                        <BarChart3
                          className={cn(
                            "h-5 w-5 mt-0.5",
                            suggestion.priority === 'high' ? 'text-destructive' :
                            suggestion.priority === 'medium' ? 'text-orange-500' :
                            'text-muted-foreground'
                          )}
                        />
                        <div>
                          <p className="text-sm font-medium">{suggestion.title}</p>
                          <p className="text-xs text-muted-foreground">{suggestion.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 干预历史 */}
              {interventions.length > 0 && (
                <div className="border rounded-lg p-4">
                  <h4 className="text-sm font-medium mb-3">干预历史</h4>
                  <div className="space-y-3">
                    {interventions.map((intervention) => (
                      <div key={intervention.id} className="flex items-start gap-3 p-2 rounded hover:bg-muted">
                        <History className="h-5 w-5 mt-0.5 text-muted-foreground" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium">
                              {INTERVENTION_TYPE_LABELS[intervention.interventionType]}
                            </span>
                            <Badge variant={resultBadgeVariant(intervention.result)} className="text-xs">
                              {INTERVENTION_RESULT_LABELS[intervention.result]}
                            </Badge>
                          </div>
                          <p className="text-xs mb-1">{intervention.notes}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(intervention.createdAt).toLocaleString('zh-CN')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button onClick={onClose} variant="outline">
              关闭
            </Button>
            <Button
              variant="destructive"
              onClick={() => setInterventionDialogOpen(true)}
            >
              <Phone className="h-4 w-4 mr-1" />
              记录干预
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <InterventionDialog
        open={interventionDialogOpen}
        organizationName={client.name}
        suggestions={suggestions}
        onClose={() => setInterventionDialogOpen(false)}
        onSubmit={handleCreateIntervention}
      />
    </>
  )
}
