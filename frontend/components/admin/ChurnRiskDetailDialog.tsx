/**
 * Churn Risk Detail Dialog Component
 *
 * Story 7.3: 客户管理与流失风险预警
 *
 * 显示流失风险客户详情和干预操作
 */

'use client'

import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Grid,
  Chip,
  Stack,
  Divider,
  Alert,
  AlertTitle,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  CircularProgress,
  Paper,
} from '@mui/material'
import {
  Warning as WarningIcon,
  TrendingDown as TrendingDownIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  CalendarToday as CalendarIcon,
  Assessment as AssessmentIcon,
  History as HistoryIcon,
} from '@mui/icons-material'
import {
  ClientActivity,
  Intervention,
  InterventionSuggestion,
  getClientActivityDetails,
  getInterventionSuggestions,
  getInterventionHistory,
  createIntervention,
  ACTIVITY_STATUS_LABELS,
  INTERVENTION_TYPE_LABELS,
  INTERVENTION_RESULT_LABELS,
} from '@/lib/api/clients-activity'
import { ActivityStatusBadge } from './ActivityStatusBadge'
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
  const [details, setDetails] = useState<any>(null)
  const [suggestions, setSuggestions] = useState<InterventionSuggestion[]>([])
  const [interventions, setInterventions] = useState<Intervention[]>([])
  const [interventionDialogOpen, setInterventionDialogOpen] = useState(false)

  useEffect(() => {
    if (open && client) {
      loadDetails()
    }
  }, [open, client])

  const loadDetails = async () => {
    if (!client) return

    try {
      setLoading(true)
      const [detailsData, suggestionsData, historyData] = await Promise.all([
        getClientActivityDetails(client.organizationId),
        getInterventionSuggestions(client.organizationId),
        getInterventionHistory(client.organizationId),
      ])
      setDetails(detailsData)
      setSuggestions(suggestionsData)
      setInterventions(historyData)
    } catch (err) {
      console.error('Failed to load details:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateIntervention = async (data: any) => {
    if (!client) return
    await createIntervention(client.organizationId, data)
    await loadDetails()
    onInterventionCreated?.()
  }

  if (!client) return null

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <WarningIcon color="error" />
            <Typography variant="h6">流失风险客户详情</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            {client.name}
          </Typography>
        </DialogTitle>

        <DialogContent>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Grid container spacing={3}>
              {/* 风险告警 */}
              <Grid item xs={12}>
                <Alert severity="error" variant="filled">
                  <AlertTitle>流失风险警告</AlertTitle>
                  该客户月活率为 {client.monthlyActivityRate.toFixed(1)}%，低于 60% 阈值，建议立即采取干预措施。
                </Alert>
              </Grid>

              {/* 基本信息 */}
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    联系信息
                  </Typography>
                  <Stack spacing={1}>
                    {client.contactPerson && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PersonIcon fontSize="small" color="action" />
                        <Typography variant="body2">{client.contactPerson}</Typography>
                      </Box>
                    )}
                    {client.contactEmail && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <EmailIcon fontSize="small" color="action" />
                        <Typography variant="body2">{client.contactEmail}</Typography>
                      </Box>
                    )}
                    {client.lastActiveAt && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CalendarIcon fontSize="small" color="action" />
                        <Typography variant="body2">
                          最后活跃: {new Date(client.lastActiveAt).toLocaleString('zh-CN')}
                        </Typography>
                      </Box>
                    )}
                  </Stack>
                </Paper>
              </Grid>

              {/* 活跃度统计 */}
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    活跃度统计
                  </Typography>
                  <Stack spacing={1}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">月活率</Typography>
                      <Typography variant="body2" fontWeight="bold" color="error">
                        {client.monthlyActivityRate.toFixed(1)}%
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">30天活跃天数</Typography>
                      <Typography variant="body2">{client.activeDaysLast30} 天</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">登录活跃率</Typography>
                      <Typography variant="body2">{client.loginActivityRate.toFixed(1)}%</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">内容消费率</Typography>
                      <Typography variant="body2">{client.contentActivityRate.toFixed(1)}%</Typography>
                    </Box>
                  </Stack>
                </Paper>
              </Grid>

              {/* 流失原因 */}
              {client.churnRiskFactors.length > 0 && (
                <Grid item xs={12}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      流失原因分析
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {client.churnRiskFactors.map((factor, index) => (
                        <Chip
                          key={index}
                          icon={<TrendingDownIcon />}
                          label={factor}
                          color="error"
                          variant="outlined"
                        />
                      ))}
                    </Stack>
                  </Paper>
                </Grid>
              )}

              {/* 干预建议 */}
              {suggestions.length > 0 && (
                <Grid item xs={12}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      干预建议
                    </Typography>
                    <List dense>
                      {suggestions.map((suggestion, index) => (
                        <ListItem key={index}>
                          <ListItemIcon>
                            <AssessmentIcon color={
                              suggestion.priority === 'high' ? 'error' :
                              suggestion.priority === 'medium' ? 'warning' : 'action'
                            } />
                          </ListItemIcon>
                          <ListItemText
                            primary={suggestion.title}
                            secondary={suggestion.description}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Paper>
                </Grid>
              )}

              {/* 干预历史 */}
              {interventions.length > 0 && (
                <Grid item xs={12}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      干预历史
                    </Typography>
                    <List dense>
                      {interventions.map((intervention) => (
                        <ListItem key={intervention.id}>
                          <ListItemIcon>
                            <HistoryIcon />
                          </ListItemIcon>
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="body2">
                                  {INTERVENTION_TYPE_LABELS[intervention.interventionType]}
                                </Typography>
                                <Chip
                                  label={INTERVENTION_RESULT_LABELS[intervention.result]}
                                  size="small"
                                  color={
                                    intervention.result === 'resolved' ? 'success' :
                                    intervention.result === 'churned' ? 'error' :
                                    intervention.result === 'contacted' ? 'info' : 'default'
                                  }
                                />
                              </Box>
                            }
                            secondary={
                              <>
                                <Typography variant="caption" display="block">
                                  {intervention.notes}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {new Date(intervention.createdAt).toLocaleString('zh-CN')}
                                </Typography>
                              </>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Paper>
                </Grid>
              )}
            </Grid>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose}>
            关闭
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => setInterventionDialogOpen(true)}
            startIcon={<PhoneIcon />}
          >
            记录干预
          </Button>
        </DialogActions>
      </Dialog>

      <InterventionDialog
        open={interventionDialogOpen}
        organizationId={client.organizationId}
        organizationName={client.name}
        suggestions={suggestions}
        onClose={() => setInterventionDialogOpen(false)}
        onSubmit={handleCreateIntervention}
      />
    </>
  )
}
