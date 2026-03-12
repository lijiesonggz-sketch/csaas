'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Upload, Settings, Users, Search, RefreshCw, Filter } from 'lucide-react'
import { ClientCard } from '@/components/admin/ClientCard'
import { AddClientDialog } from '@/components/admin/AddClientDialog'
import { BulkConfigDialog } from '@/components/admin/BulkConfigDialog'
import { BulkImportDialog } from '@/components/admin/BulkImportDialog'
import { ClientGroupDialog } from '@/components/admin/ClientGroupDialog'
import {
  Client,
  ClientGroup,
  CreateClientData,
  UpdateClientData,
  BulkConfigData,
  IndustryType,
  OrganizationStatus,
  getClients,
  createClient,
  updateClient,
  deleteClient,
  bulkImportFromCsv,
  downloadCsvTemplate,
  bulkConfigClients,
  getClientGroups,
  createClientGroup,
  deleteClientGroup,
  addClientsToGroup,
  removeClientFromGroup,
  CreateClientGroupData,
} from '@/lib/api/clients'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'

/**
 * 客户管理页面
 *
 * Story 6.2: 咨询公司批量客户管理后台
 *
 * 功能:
 * - 客户列表展示
 * - 添加/编辑/删除客户
 * - CSV 批量导入
 * - 批量配置推送设置
 * - 客户分组管理
 * - 搜索和筛选
 */
export default function ClientsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [clients, setClients] = useState<Client[]>([])
  const [groups, setGroups] = useState<ClientGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedClients, setSelectedClients] = useState<Client[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filterIndustry, setFilterIndustry] = useState<IndustryType | ''>('')
  const [filterStatus, setFilterStatus] = useState<OrganizationStatus | ''>('')

  // 对话框状态
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [bulkConfigDialogOpen, setBulkConfigDialogOpen] = useState(false)
  const [bulkImportDialogOpen, setBulkImportDialogOpen] = useState(false)
  const [groupDialogOpen, setGroupDialogOpen] = useState(false)

  // 返回上一页
  const handleBack = () => {
    router.push('/dashboard')
  }

  // 显示提示消息
  const showToast = (
    message: string,
    variant: 'default' | 'destructive' = 'default',
  ) => {
    toast({
      title: variant === 'destructive' ? '错误' : '成功',
      description: message,
      variant,
    })
  }

  // 加载客户列表
  const loadClients = async () => {
    try {
      setLoading(true)
      const data = await getClients()
      setClients(data)
    } catch (err: any) {
      showToast(err.message || '加载客户列表失败', 'destructive')
    } finally {
      setLoading(false)
    }
  }

  // 加载客户分组
  const loadGroups = async () => {
    try {
      const data = await getClientGroups()
      setGroups(data)
    } catch (err: any) {
      console.error('加载分组失败:', err)
    }
  }

  // 初始加载
  useEffect(() => {
    loadClients()
    loadGroups()
  }, [])

  // 创建客户
  const handleCreateClient = async (data: CreateClientData) => {
    await createClient(data)
    showToast('客户创建成功')
    loadClients()
  }

  // 更新客户
  const handleUpdateClient = async (data: UpdateClientData) => {
    if (!editingClient) return
    await updateClient(editingClient.id, data)
    showToast('客户更新成功')
    setEditingClient(null)
    loadClients()
  }

  // 删除客户
  const handleDeleteClient = async (client: Client) => {
    if (!confirm(`确定要删除客户 "${client.name}" 吗？`)) {
      return
    }

    try {
      await deleteClient(client.id)
      showToast('客户删除成功')
      loadClients()
    } catch (err: any) {
      showToast(err.message || '删除失败', 'destructive')
    }
  }

  // 批量导入
  const handleBulkImport = async (file: File) => {
    const result = await bulkImportFromCsv(file)
    showToast(
      `导入完成: 成功 ${result.success} 个，失败 ${result.failed} 个`,
      result.failed > 0 ? 'destructive' : 'default',
    )
    loadClients()
    return result
  }

  // 批量配置
  const handleBulkConfig = async (data: BulkConfigData) => {
    await bulkConfigClients(data)
    showToast(`已成功配置 ${data.organizationIds.length} 个客户`)
    setSelectedClients([])
    loadClients()
  }

  // 创建分组
  const handleCreateGroup = async (data: CreateClientGroupData) => {
    const group = await createClientGroup(data)
    showToast('分组创建成功')
    loadGroups()
    return group
  }

  // 删除分组
  const handleDeleteGroup = async (groupId: string) => {
    await deleteClientGroup(groupId)
    showToast('分组删除成功')
    loadGroups()
  }

  // 添加客户到分组
  const handleAddClientsToGroup = async (groupId: string, clientIds: string[]) => {
    await addClientsToGroup(groupId, clientIds)
    showToast('客户已添加到分组')
    loadGroups()
  }

  // 从分组移除客户
  const handleRemoveClientFromGroup = async (groupId: string, clientId: string) => {
    await removeClientFromGroup(groupId, clientId)
    showToast('客户已从分组移除')
    loadGroups()
  }

  // 选择/取消选择客户
  const handleSelectClient = (client: Client, selected: boolean) => {
    if (selected) {
      setSelectedClients((prev) => [...prev, client])
    } else {
      setSelectedClients((prev) => prev.filter((c) => c.id !== client.id))
    }
  }

  // 全选/取消全选
  const handleSelectAll = () => {
    if (selectedClients.length === filteredClients.length) {
      setSelectedClients([])
    } else {
      setSelectedClients(filteredClients)
    }
  }

  // 筛选客户
  const filteredClients = clients.filter((client) => {
    // 搜索过滤
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchName = client.name.toLowerCase().includes(query)
      const matchContact = client.contactPerson?.toLowerCase().includes(query)
      const matchEmail = client.contactEmail?.toLowerCase().includes(query)
      if (!matchName && !matchContact && !matchEmail) {
        return false
      }
    }

    // 行业过滤
    if (filterIndustry && client.industryType !== filterIndustry) {
      return false
    }

    // 状态过滤
    if (filterStatus && client.status !== filterStatus) {
      return false
    }

    return true
  })

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

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

      {/* 页面标题和操作按钮 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold" data-testid="page-title">
            客户管理
          </h1>
          <p className="text-muted-foreground mt-1">
            管理您的客户组织，配置推送设置和分组
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            data-testid="bulk-import-button"
            variant="outline"
            onClick={() => setBulkImportDialogOpen(true)}
          >
            <Upload className="w-4 h-4 mr-2" />
            批量导入
          </Button>
          <Button
            data-testid="group-management-button"
            variant="outline"
            onClick={() => setGroupDialogOpen(true)}
          >
            <Users className="w-4 h-4 mr-2" />
            分组管理
          </Button>
          <Button
            data-testid="add-client-button"
            onClick={() => setAddDialogOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            添加客户
          </Button>
        </div>
      </div>

      {/* 统计信息 */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">{clients.length}</div>
              <div className="text-sm text-muted-foreground">总客户数</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {clients.filter((c) => c.status === 'active').length}
              </div>
              <div className="text-sm text-muted-foreground">活跃客户</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-amber-500">
                {clients.filter((c) => c.status === 'trial').length}
              </div>
              <div className="text-sm text-muted-foreground">试用客户</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{groups.length}</div>
              <div className="text-sm text-muted-foreground">客户分组</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 搜索和筛选 */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="md:col-span-1">
              <Label htmlFor="search" className="sr-only">搜索</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="search"
                  data-testid="search-input"
                  placeholder="搜索客户名称、联系人或邮箱"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="industry" className="sr-only">行业类型</Label>
              <Select
                value={filterIndustry}
                onValueChange={(value) => setFilterIndustry(value as IndustryType | '')}
              >
                <SelectTrigger id="industry" data-testid="industry-filter">
                  <SelectValue placeholder="全部行业" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部</SelectItem>
                  <SelectItem data-testid="industry-option-banking" value={IndustryType.BANKING}>银行</SelectItem>
                  <SelectItem data-testid="industry-option-securities" value={IndustryType.SECURITIES}>证券</SelectItem>
                  <SelectItem data-testid="industry-option-insurance" value={IndustryType.INSURANCE}>保险</SelectItem>
                  <SelectItem data-testid="industry-option-enterprise" value={IndustryType.ENTERPRISE}>企业</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="status" className="sr-only">状态</Label>
              <Select
                value={filterStatus}
                onValueChange={(value) => setFilterStatus(value as OrganizationStatus | '')}
              >
                <SelectTrigger id="status" data-testid="status-filter">
                  <SelectValue placeholder="全部状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部</SelectItem>
                  <SelectItem data-testid="status-option-active" value={OrganizationStatus.ACTIVE}>活跃</SelectItem>
                  <SelectItem data-testid="status-option-inactive" value={OrganizationStatus.INACTIVE}>停用</SelectItem>
                  <SelectItem data-testid="status-option-trial" value={OrganizationStatus.TRIAL}>试用</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              onClick={loadClients}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              刷新
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 批量操作栏 */}
      {selectedClients.length > 0 && (
        <Card className="mb-6 bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedClients.length === filteredClients.length}
                  onCheckedChange={handleSelectAll}
                />
                <span>已选择 {selectedClients.length} 个客户</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => setBulkConfigDialogOpen(true)}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  批量配置
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setGroupDialogOpen(true)}
                >
                  <Users className="w-4 h-4 mr-2" />
                  添加到分组
                </Button>
                <Button variant="outline" onClick={() => setSelectedClients([])}>
                  取消选择
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 客户列表 */}
      {filteredClients.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            {searchQuery || filterIndustry || filterStatus
              ? '没有找到符合条件的客户'
              : '暂无客户，请添加客户'}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredClients.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              onEdit={(c) => {
                setEditingClient(c)
                setAddDialogOpen(true)
              }}
              onDelete={handleDeleteClient}
              onConfig={(c) => {
                setSelectedClients([c])
                setBulkConfigDialogOpen(true)
              }}
              selected={selectedClients.some((c) => c.id === client.id)}
              onSelect={handleSelectClient}
            />
          ))}
        </div>
      )}

      {/* 添加/编辑客户对话框 */}
      <AddClientDialog
        open={addDialogOpen}
        onClose={() => {
          setAddDialogOpen(false)
          setEditingClient(null)
        }}
        onSubmit={async (data: CreateClientData | UpdateClientData) => {
          if (editingClient) {
            await handleUpdateClient(data as UpdateClientData)
          } else {
            await handleCreateClient(data as CreateClientData)
          }
        }}
        client={editingClient}
        mode={editingClient ? 'edit' : 'create'}
      />

      {/* 批量配置对话框 */}
      <BulkConfigDialog
        open={bulkConfigDialogOpen}
        onClose={() => setBulkConfigDialogOpen(false)}
        onSubmit={handleBulkConfig}
        selectedClients={selectedClients}
      />

      {/* 批量导入对话框 */}
      <BulkImportDialog
        open={bulkImportDialogOpen}
        onClose={() => setBulkImportDialogOpen(false)}
        onImport={handleBulkImport}
        onDownloadTemplate={downloadCsvTemplate}
      />

      {/* 分组管理对话框 */}
      <ClientGroupDialog
        open={groupDialogOpen}
        onClose={() => setGroupDialogOpen(false)}
        onCreateGroup={handleCreateGroup}
        onDeleteGroup={handleDeleteGroup}
        onAddClientsToGroup={handleAddClientsToGroup}
        onRemoveClientFromGroup={handleRemoveClientFromGroup}
        groups={groups}
        clients={clients}
        selectedClients={selectedClients}
      />
    </div>
  )
}
