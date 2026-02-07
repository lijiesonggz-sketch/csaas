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
  TextField,
  MenuItem,
  InputAdornment,
  Chip,
  Stack,
  Alert,
  Snackbar,
  CircularProgress,
  Checkbox,
  Tooltip,
  Divider,
} from '@mui/material'
import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  Upload as UploadIcon,
  Settings as SettingsIcon,
  Group as GroupIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material'
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

  // 提示消息
  const [snackbar, setSnackbar] = useState<{
    open: boolean
    message: string
    severity: 'success' | 'error' | 'info' | 'warning'
  }>({
    open: false,
    message: '',
    severity: 'success',
  })

  // 返回上一页
  const handleBack = () => {
    router.push('/dashboard')
  }

  // 显示提示消息
  const showSnackbar = (
    message: string,
    severity: 'success' | 'error' | 'info' | 'warning' = 'success',
  ) => {
    setSnackbar({ open: true, message, severity })
  }

  // 关闭提示消息
  const handleCloseSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }))
  }

  // 加载客户列表
  const loadClients = async () => {
    try {
      setLoading(true)
      const data = await getClients()
      setClients(data)
    } catch (err: any) {
      showSnackbar(err.message || '加载客户列表失败', 'error')
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
    showSnackbar('客户创建成功')
    loadClients()
  }

  // 更新客户
  const handleUpdateClient = async (data: UpdateClientData) => {
    if (!editingClient) return
    await updateClient(editingClient.id, data)
    showSnackbar('客户更新成功')
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
      showSnackbar('客户删除成功')
      loadClients()
    } catch (err: any) {
      showSnackbar(err.message || '删除失败', 'error')
    }
  }

  // 批量导入
  const handleBulkImport = async (file: File) => {
    const result = await bulkImportFromCsv(file)
    showSnackbar(
      `导入完成: 成功 ${result.success} 个，失败 ${result.failed} 个`,
      result.failed > 0 ? 'warning' : 'success',
    )
    loadClients()
    return result
  }

  // 批量配置
  const handleBulkConfig = async (data: BulkConfigData) => {
    await bulkConfigClients(data)
    showSnackbar(`已成功配置 ${data.organizationIds.length} 个客户`)
    setSelectedClients([])
    loadClients()
  }

  // 创建分组
  const handleCreateGroup = async (data: CreateClientGroupData) => {
    const group = await createClientGroup(data)
    showSnackbar('分组创建成功')
    loadGroups()
    return group
  }

  // 删除分组
  const handleDeleteGroup = async (groupId: string) => {
    await deleteClientGroup(groupId)
    showSnackbar('分组删除成功')
    loadGroups()
  }

  // 添加客户到分组
  const handleAddClientsToGroup = async (groupId: string, clientIds: string[]) => {
    await addClientsToGroup(groupId, clientIds)
    showSnackbar('客户已添加到分组')
    loadGroups()
  }

  // 从分组移除客户
  const handleRemoveClientFromGroup = async (groupId: string, clientId: string) => {
    await removeClientFromGroup(groupId, clientId)
    showSnackbar('客户已从分组移除')
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
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    )
  }

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

        {/* 页面标题和操作按钮 */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom data-testid="page-title">
              客户管理
            </Typography>
            <Typography variant="body2" color="text.secondary">
              管理您的客户组织，配置推送设置和分组
            </Typography>
          </Box>
          <Stack direction="row" spacing={2}>
            <Button
              data-testid="bulk-import-button"
              variant="outlined"
              startIcon={<UploadIcon />}
              onClick={() => setBulkImportDialogOpen(true)}
            >
              批量导入
            </Button>
            <Button
              data-testid="group-management-button"
              variant="outlined"
              startIcon={<GroupIcon />}
              onClick={() => setGroupDialogOpen(true)}
            >
              分组管理
            </Button>
            <Button
              data-testid="add-client-button"
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setAddDialogOpen(true)}
            >
              添加客户
            </Button>
          </Stack>
        </Box>

        {/* 统计信息 */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="primary">
                  {clients.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  总客户数
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="success.main">
                  {clients.filter((c) => c.status === 'active').length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  活跃客户
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="warning.main">
                  {clients.filter((c) => c.status === 'trial').length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  试用客户
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="info.main">
                  {groups.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  客户分组
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Paper>

        {/* 搜索和筛选 */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                data-testid="search-input"
                fullWidth
                size="small"
                placeholder="搜索客户名称、联系人或邮箱"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                data-testid="industry-filter"
                fullWidth
                select
                size="small"
                label="行业类型"
                value={filterIndustry}
                onChange={(e) => setFilterIndustry(e.target.value as IndustryType | '')}
              >
                <MenuItem value="">全部</MenuItem>
                <MenuItem data-testid="industry-option-banking" value={IndustryType.BANKING}>银行</MenuItem>
                <MenuItem data-testid="industry-option-securities" value={IndustryType.SECURITIES}>证券</MenuItem>
                <MenuItem data-testid="industry-option-insurance" value={IndustryType.INSURANCE}>保险</MenuItem>
                <MenuItem data-testid="industry-option-enterprise" value={IndustryType.ENTERPRISE}>企业</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                data-testid="status-filter"
                fullWidth
                select
                size="small"
                label="状态"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as OrganizationStatus | '')}
              >
                <MenuItem value="">全部</MenuItem>
                <MenuItem data-testid="status-option-active" value={OrganizationStatus.ACTIVE}>活跃</MenuItem>
                <MenuItem data-testid="status-option-inactive" value={OrganizationStatus.INACTIVE}>停用</MenuItem>
                <MenuItem data-testid="status-option-trial" value={OrganizationStatus.TRIAL}>试用</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={2}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={loadClients}
              >
                刷新
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {/* 批量操作栏 */}
        {selectedClients.length > 0 && (
          <Paper sx={{ p: 2, mb: 3, backgroundColor: 'primary.light' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Checkbox
                  checked={selectedClients.length === filteredClients.length}
                  indeterminate={
                    selectedClients.length > 0 && selectedClients.length < filteredClients.length
                  }
                  onChange={handleSelectAll}
                />
                <Typography variant="body1">
                  已选择 {selectedClients.length} 个客户
                </Typography>
              </Box>
              <Stack direction="row" spacing={2}>
                <Button
                  variant="contained"
                  startIcon={<SettingsIcon />}
                  onClick={() => setBulkConfigDialogOpen(true)}
                >
                  批量配置
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<GroupIcon />}
                  onClick={() => setGroupDialogOpen(true)}
                >
                  添加到分组
                </Button>
                <Button variant="outlined" onClick={() => setSelectedClients([])}>
                  取消选择
                </Button>
              </Stack>
            </Box>
          </Paper>
        )}

        {/* 客户列表 */}
        {filteredClients.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              {searchQuery || filterIndustry || filterStatus
                ? '没有找到符合条件的客户'
                : '暂无客户，请添加客户'}
            </Typography>
          </Paper>
        ) : (
          <Grid container spacing={3}>
            {filteredClients.map((client) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={client.id}>
                <ClientCard
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
              </Grid>
            ))}
          </Grid>
        )}

        {/* 添加/编辑客户对话框 */}
        <AddClientDialog
          open={addDialogOpen}
          onClose={() => {
            setAddDialogOpen(false)
            setEditingClient(null)
          }}
          onSubmit={editingClient ? handleUpdateClient : handleCreateClient}
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

        {/* 提示消息 */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            onClose={handleCloseSnackbar}
            severity={snackbar.severity}
            sx={{ width: '100%' }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </Container>
  )
}
