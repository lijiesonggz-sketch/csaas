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
import { ArrowLeft, RefreshCw, Phone, TrendingDown, AlertTriangle } from 'lucide-react'
import {
  ClientActivity,
  ClientSegment,
  getChurnRiskClients,
  getClientSegmentation,
  getInterventionSuggestions,
  createIntervention,
} from '@/lib/api/clients-activity'
import { ActivityStatusBadge } from '@/components/admin/ActivityStatusBadge'
import { ClientSegmentationChart } from '@/components/admin/ClientSegmentationChart'
import { ChurnRiskDetailDialog } from '@/components/admin/ChurnRiskDetailDialog'
import { InterventionDialog } from '@/components/admin/InterventionDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'

export default function ChurnRiskPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [clients, setClients] = useState<ClientActivity[]>([])
  const [segments, setSegments] = useState<ClientSegment[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedClient, setSelectedClient] = useState<ClientActivity | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [interventionDialogOpen, setInterventionDialogOpen] = useState(false)
  const [interventionSuggestions, setInterventionSuggestions] = useState<any[]>([])

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
      toast({
        title: '错误',
        description: err.message || '加载数据失败',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

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
    toast({
      title: '成功',
      description: '干预记录已保存',
    })
    loadData()
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  const churnRiskCount = segments.find(s => s.name === 'low_active')?.count || 0
  const totalCustomers = segments.reduce((sum, s) => sum + s.count, 0)
  const churnRiskPercentage = totalCustomers > 0
    ? Math.round((churnRiskCount / totalCustomers) * 100)
    : 0

  return (
    <div className="container mx-auto py-8 px-4">
      {/* 返回按钮 */}
      <div className="mb-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleBack}
          className="text-primary hover:text-primary hover:bg-primary/10"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
      </div>

      {/* 页面标题 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <AlertTriangle className="w-8 h-8 text-destructive" />
            流失风险客户
          </h1>
          <p className="text-muted-foreground mt-1">
            月活率低于 60% 的客户需要关注和干预
          </p>
        </div>
        <Button
          variant="outline"
          onClick={loadData}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          刷新
        </Button>
      </div>

      {/* 统计概览 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="border-l-4 border-l-destructive">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-destructive">{churnRiskCount}</div>
            <div className="text-sm text-muted-foreground">风险客户数</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-amber-500">{churnRiskPercentage}%</div>
            <div className="text-sm text-muted-foreground">风险客户占比</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-blue-600">
              {clients.length > 0
                ? (clients.reduce((sum, c) => sum + c.monthlyActivityRate, 0) / clients.length).toFixed(1)
                : 0}%
            </div>
            <div className="text-sm text-muted-foreground">平均月活率</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-green-600">
              {totalCustomers - churnRiskCount}
            </div>
            <div className="text-sm text-muted-foreground">健康客户数</div>
          </CardContent>
        </Card>
      </div>

      {/* 图表和客户列表 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 分布图表 */}
        <div className="lg:col-span-1">
          <ClientSegmentationChart data={segments} />
        </div>

        {/* 风险客户列表 */}
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-lg font-semibold">风险客户列表</h2>
                <Badge variant="destructive">{clients.length} 家</Badge>
              </div>

              {clients.length === 0 ? (
                <Alert className="bg-green-50 border-green-200">
                  <AlertDescription className="text-green-800">
                    太好了！当前没有流失风险客户。
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>客户名称</TableHead>
                        <TableHead>月活率</TableHead>
                        <TableHead>流失原因</TableHead>
                        <TableHead>联系人</TableHead>
                        <TableHead className="text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clients.map((client) => (
                        <TableRow key={client.organizationId}>
                          <TableCell className="font-medium">{client.name}</TableCell>
                          <TableCell>
                            <ActivityStatusBadge
                              status={client.activityStatus}
                              rate={client.monthlyActivityRate}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {client.churnRiskFactors.slice(0, 2).map((factor, idx) => (
                                <Badge
                                  key={idx}
                                  variant="outline"
                                  className="text-destructive border-destructive/30"
                                >
                                  {factor}
                                </Badge>
                              ))}
                              {client.churnRiskFactors.length > 2 && (
                                <Badge variant="outline">
                                  +{client.churnRiskFactors.length - 2}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {client.contactPerson || '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleViewDetails(client)}
                              >
                                详情
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleQuickIntervention(client)}
                              >
                                <Phone className="w-4 h-4 mr-1" />
                                干预
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

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
    </div>
  )
}
