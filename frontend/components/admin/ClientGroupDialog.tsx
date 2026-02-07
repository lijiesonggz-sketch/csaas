/**
 * ClientGroupDialog Component
 *
 * Story 6.2: 咨询公司批量客户管理后台
 *
 * 客户分组管理对话框
 */

import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  Alert,
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Typography,
  Divider,
} from '@mui/material'
import {
  Delete as DeleteIcon,
  Add as AddIcon,
  Group as GroupIcon,
} from '@mui/icons-material'
import { ClientGroup, CreateClientGroupData, Client } from '@/lib/api/clients'

interface ClientGroupDialogProps {
  open: boolean
  onClose: () => void
  onCreateGroup: (data: CreateClientGroupData) => Promise<ClientGroup>
  onDeleteGroup: (groupId: string) => Promise<void>
  onAddClientsToGroup: (groupId: string, clientIds: string[]) => Promise<void>
  onRemoveClientFromGroup: (groupId: string, clientId: string) => Promise<void>
  groups: ClientGroup[]
  clients: Client[]
  selectedClients: Client[]
}

export function ClientGroupDialog({
  open,
  onClose,
  onCreateGroup,
  onDeleteGroup,
  onAddClientsToGroup,
  onRemoveClientFromGroup,
  groups,
  clients,
  selectedClients,
}: ClientGroupDialogProps) {
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupDescription, setNewGroupDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)

  // 重置表单
  useEffect(() => {
    if (open) {
      setNewGroupName('')
      setNewGroupDescription('')
      setError(null)
      setExpandedGroup(null)
    }
  }, [open])

  // 创建分组
  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      setError('请输入分组名称')
      return
    }

    try {
      setCreating(true)
      setError(null)
      await onCreateGroup({
        name: newGroupName.trim(),
        description: newGroupDescription.trim() || undefined,
      })
      setNewGroupName('')
      setNewGroupDescription('')
    } catch (err: any) {
      setError(err.message || '创建分组失败')
    } finally {
      setCreating(false)
    }
  }

  // 删除分组
  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('确定要删除此分组吗？分组中的客户不会被删除。')) {
      return
    }

    try {
      await onDeleteGroup(groupId)
    } catch (err: any) {
      setError(err.message || '删除分组失败')
    }
  }

  // 添加选中的客户到分组
  const handleAddToGroup = async (groupId: string) => {
    if (selectedClients.length === 0) {
      setError('请先选择要添加的客户')
      return
    }

    try {
      setError(null)
      await onAddClientsToGroup(
        groupId,
        selectedClients.map((c) => c.id),
      )
    } catch (err: any) {
      setError(err.message || '添加客户到分组失败')
    }
  }

  // 从分组移除客户
  const handleRemoveFromGroup = async (groupId: string, clientId: string) => {
    try {
      await onRemoveClientFromGroup(groupId, clientId)
    } catch (err: any) {
      setError(err.message || '移除客户失败')
    }
  }

  // 切换分组展开状态
  const toggleGroup = (groupId: string) => {
    setExpandedGroup(expandedGroup === groupId ? null : groupId)
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>客户分组管理</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 2 }}>
          {error && <Alert severity="error">{error}</Alert>}

          {/* 选中的客户提示 */}
          {selectedClients.length > 0 && (
            <Alert severity="info">
              已选择 {selectedClients.length} 个客户，可以将它们添加到分组中
            </Alert>
          )}

          {/* 创建新分组 */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              创建新分组
            </Typography>
            <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
              <TextField
                fullWidth
                size="small"
                label="分组名称"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="例如: 城商行客户"
              />
              <TextField
                fullWidth
                size="small"
                label="描述 (可选)"
                value={newGroupDescription}
                onChange={(e) => setNewGroupDescription(e.target.value)}
                placeholder="例如: 城市商业银行客户分组"
              />
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleCreateGroup}
                disabled={creating || !newGroupName.trim()}
                sx={{ minWidth: 100 }}
              >
                创建
              </Button>
            </Stack>
          </Box>

          <Divider />

          {/* 分组列表 */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              现有分组 ({groups.length})
            </Typography>
            {groups.length === 0 ? (
              <Alert severity="info">暂无分组，请创建新分组</Alert>
            ) : (
              <List sx={{ maxHeight: 400, overflow: 'auto' }}>
                {groups.map((group) => (
                  <Box key={group.id}>
                    <ListItem
                      sx={{
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        mb: 1,
                        cursor: 'pointer',
                        '&:hover': {
                          backgroundColor: 'action.hover',
                        },
                      }}
                      onClick={() => toggleGroup(group.id)}
                    >
                      <GroupIcon sx={{ mr: 2, color: 'primary.main' }} />
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="subtitle1">{group.name}</Typography>
                            <Chip
                              label={`${group.memberships?.length || 0} 个客户`}
                              size="small"
                            />
                          </Box>
                        }
                        secondary={group.description}
                      />
                      <ListItemSecondaryAction>
                        {selectedClients.length > 0 && (
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleAddToGroup(group.id)
                            }}
                            sx={{ mr: 1 }}
                          >
                            添加选中
                          </Button>
                        )}
                        <IconButton
                          edge="end"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteGroup(group.id)
                          }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>

                    {/* 展开显示分组成员 */}
                    {expandedGroup === group.id && group.memberships && group.memberships.length > 0 && (
                      <Box
                        sx={{
                          ml: 4,
                          mb: 2,
                          p: 2,
                          backgroundColor: 'action.hover',
                          borderRadius: 1,
                        }}
                      >
                        <Typography variant="caption" color="text.secondary" gutterBottom>
                          分组成员:
                        </Typography>
                        <List dense>
                          {group.memberships.map((membership) => (
                            <ListItem key={membership.id}>
                              <ListItemText
                                primary={membership.organization?.name || '未知客户'}
                                secondary={membership.organization?.contactEmail}
                              />
                              <ListItemSecondaryAction>
                                <IconButton
                                  edge="end"
                                  size="small"
                                  onClick={() =>
                                    handleRemoveFromGroup(group.id, membership.organizationId)
                                  }
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </ListItemSecondaryAction>
                            </ListItem>
                          ))}
                        </List>
                      </Box>
                    )}
                  </Box>
                ))}
              </List>
            )}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>关闭</Button>
      </DialogActions>
    </Dialog>
  )
}
