/**
 * Churn Risk Clients Page
 *
 * Story 7.3: 客户管理与流失风险预警
 *
 * 显示流失风险客户列表，支持筛选和干预操作
 */

'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Container,
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Grid,
  Chip,
  Stack,
  Alert,
  Snackbar,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
} from '@mui/material'
import {
  ArrowBack as ArrowBackIcon,
  Refresh as RefreshIcon,
  Phone as PhoneIcon,
  TrendingDown as TrendingDownIcon,
  Warning as WarningIcon,
} from '@mui/icons-material'
import {
  ClientActivity,
  ClientSegment,
  getChurnRiskClients,
  getClientSegmentation,
  getInterventionSuggestions,
  createIntervention,
  ACTIVITY_STATUS_LABELS,
} from '@/lib/api/clients-activity'
import { ActivityStatusBadge } from '@/components/admin/ActivityStatusBadge'
import { ClientSegmentationChart } from '@/components/admin/ClientSegmentationChart'
import { ChurnRiskDetailDialog } from '@/components/admin/ChurnRiskDetailDialog'
import { InterventionDialog } from '@/components/admin/InterventionDialog'

export default function ChurnRiskPage() {
  const router = useRouter()
  const [clients, setClients] = useState<ClientActivity[]>([])
  const [segments, setSegments] = useState<ClientSegment[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedClient, setSelectedClient] = useState<ClientActivity | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [interventionDialogOpen, setInterventionDialogOpen] = useState(false)
  const [interventionSuggestions, setInterventionSuggestions] = useState<any[]>([])
  const [snackbar, setSnackbar] = useState<{
    open: boolean
    message: string
    severity: 'success' | 'error' | 'info'
  }>({
    open: false,
    message: '',
    severity: 'success',
  })

  // 加载数据
  const loadData = async () => {
    try {
      setLoading(true)
      const [clientsData, segmentationData] = await Promise.all([
        getChurnRiskClients(),
        getClientSegmentation(),
      ])
      setClients(clientsData.data)
      setSegments(segmentationData.segments)
    } catch (err: any) {
      showSnackbar(err.message || '加载数据失败', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const showSnackbar = (
    message: string,
    severity: 'success' | 'error' | 'info' = 'success'
  ) => {
    setSnackbar({ open: true, message, severity })
  }

  const handleBack = () => {
    router.push('/admin/clients')
  }

  const handleViewDetails = async (client: ClientActivity) => {
    setSelectedClient(client)
    setDetailDialogOpen(true)
  }

  const handleQuickIntervention = async (client: ClientActivity) => {
    setSelectedClient(client)
    const suggestions = await getInterventionSuggestions(client.organizationId)
    setInterventionSuggestions(suggestions)
    setInterventionDialogOpen(true)
  }

  const handleCreateIntervention = async (data: any) => {
    if (!selectedClient) return
    await createIntervention(selectedClient.organizationId, data)
    showSnackbar('干预记录已保存')
    loadData()
  }

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    )
  }

  const churnRiskCount = segments.find(s => s.name === 'low_active')?.count || 0
  const totalCustomers = segments.reduce((sum, s) => sum + s.count, 0)
  const churnRiskPercentage = totalCustomers > 0
    ? Math.round((churnRiskCount / totalCustomers) * 100)
    : 0

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box>
        {/* 返回按钮 */}
        <Box sx={{ mb: 2 }}>
          <IconButton
            onClick={handleBack}
            sx={{
              color: 'primary.main',
              '&:hover': {
                backgroundColor: 'primary.light',
                color: 'white',
              },
            }}
          >
            <ArrowBackIcon />
          </IconButton>
        </Box>

        {/* 页面标题 */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              <WarningIcon color="error" sx={{ mr: 1, verticalAlign: 'middle' }} />
              流失风险客户
            </Typography>
            <Typography variant="body2" color="text.secondary">
              月活率低于 60% 的客户需要关注和干预
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadData}
          >
            刷新
          </Button>
        </Box>

        {/* 统计概览 */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid xs={{ xs: 12, sm: 6, md: 3 }}>
            <Paper sx={{ p: 2, textAlign: 'center', borderLeft: 4, borderColor: 'error.main' }}>
              <Typography variant="h4" color="error">
                {churnRiskCount}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                风险客户数
              </Typography>
            </Paper>
          </Grid>
          <Grid xs={{ xs: 12, sm: 6, md: 3 }}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="warning.main">
                {churnRiskPercentage}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                风险客户占比
              </Typography>
            </Paper>
          </Grid>
          <Grid xs={{ xs: 12, sm: 6, md: 3 }}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="info.main">
                {clients.length > 0
                  ? (clients.reduce((sum, c) => sum + c.monthlyActivityRate, 0) / clients.length).toFixed(1)
                  : 0}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                平均月活率
              </Typography>
            </Paper>
          </Grid>
          <Grid xs={{ xs: 12, sm: 6, md: 3 }}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="success.main">
                {totalCustomers - churnRiskCount}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                健康客户数
              </Typography>
            </Paper>
          </Grid>
        </Grid>

        {/* 图表和客户列表 */}
        <Grid container spacing={3}>
          {/* 分布图表 */}
          <Grid xs={{ xs: 12, md: 4 }}>
            <ClientSegmentationChart data={segments} />
          </Grid>

          {/* 风险客户列表 */}
          <Grid xs={{ xs: 12, md: 8 }}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                风险客户列表
                <Chip
                  label={`${clients.length} 家`}
                  size="small"
                  color="error"
                  sx={{ ml: 1 }}
                />
              </Typography>

              {clients.length === 0 ? (
                <Alert severity="success" sx={{ mt: 2 }}>
                  太好了！当前没有流失风险客户。
                </Alert>
              ) : (
                <TableContainer sx={{ mt: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>客户名称</TableCell>
                        <TableCell>月活率</TableCell>
                        <TableCell>流失原因</TableCell>
                        <TableCell>联系人</TableCell>
                        <TableCell align="right">操作</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {clients.map((client) => (
                        <TableRow key={client.organizationId} hover>
                          <TableCell>
                            <Typography variant="body2" fontWeight="medium">
                              {client.name}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <ActivityStatusBadge
                              status={client.activityStatus}
                              rate={client.monthlyActivityRate}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                              {client.churnRiskFactors.slice(0, 2).map((factor, idx) => (
                                <Chip
                                  key={idx}
                                  label={factor}
                                  size="small"
                                  variant="outlined"
                                  color="error"
                                />
                              ))}
                              {client.churnRiskFactors.length > 2 && (
                                <Chip
                                  label={`+${client.churnRiskFactors.length - 2}`}
                                  size="small"
                                  variant="outlined"
                                />
                              )}
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">
                              {client.contactPerson || '-'}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Stack direction="row" spacing={1} justifyContent="flex-end">
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => handleViewDetails(client)}
                              >
                                详情
                              </Button>
                              <Button
                                size="small"
                                variant="contained"
                                color="error"
                                startIcon={<PhoneIcon />}
                                onClick={() => handleQuickIntervention(client)}
                              >
                                干预
                              </Button>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          </Grid>
        </Grid>
      </Box>

      {/* 详情对话框 */}
      <ChurnRiskDetailDialog
        open={detailDialogOpen}
        client={selectedClient}
        onClose={() => setDetailDialogOpen(false)}
        onInterventionCreated={loadData}
      />

      {/* 干预对话框 */}
      {selectedClient && (
        <InterventionDialog
          open={interventionDialogOpen}
          organizationId={selectedClient.organizationId}
          organizationName={selectedClient.name}
          suggestions={interventionSuggestions}
          onClose={() => setInterventionDialogOpen(false)}
          onSubmit={handleCreateIntervention}
        />
      )}

      {/* 提示消息 */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  )
}
