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
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Trash2,
  Plus,
  Users,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
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
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>客户分组管理</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-2">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* 选中的客户提示 */}
          {selectedClients.length > 0 && (
            <Alert>
              <AlertDescription>
                已选择 {selectedClients.length} 个客户，可以将它们添加到分组中
              </AlertDescription>
            </Alert>
          )}

          {/* 创建新分组 */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">创建新分组</h4>
            <div className="flex gap-2">
              <Input
                placeholder="分组名称"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="flex-1"
              />
              <Input
                placeholder="描述 (可选)"
                value={newGroupDescription}
                onChange={(e) => setNewGroupDescription(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={handleCreateGroup}
                disabled={creating || !newGroupName.trim()}
              >
                <Plus className="h-4 w-4 mr-1" />
                创建
              </Button>
            </div>
          </div>

          <div className="border-t" />

          {/* 分组列表 */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">现有分组 ({groups.length})</h4>
            {groups.length === 0 ? (
              <Alert>
                <AlertDescription>暂无分组，请创建新分组</AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {groups.map((group) => (
                  <div key={group.id}>
                    <div
                      className={`
                        border rounded-lg p-3 cursor-pointer transition-colors
                        hover:bg-muted
                      `}
                      onClick={() => toggleGroup(group.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <Users className="h-5 w-5 text-primary" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">{group.name}</span>
                              <Badge variant="secondary" className="text-xs">
                                {group.memberships?.length || 0} 个客户
                              </Badge>
                            </div>
                            {group.description && (
                              <p className="text-xs text-muted-foreground truncate">
                                {group.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {selectedClients.length > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleAddToGroup(group.id)
                              }}
                            >
                              添加选中
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteGroup(group.id)
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          {expandedGroup === group.id ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 展开显示分组成员 */}
                    {expandedGroup === group.id && group.memberships && group.memberships.length > 0 && (
                      <div className="ml-8 mt-2 p-3 bg-muted rounded-lg">
                        <p className="text-xs text-muted-foreground mb-2">分组成员:</p>
                        <div className="space-y-2">
                          {group.memberships.map((membership) => (
                            <div
                              key={membership.id}
                              className="flex items-center justify-between p-2 bg-background rounded"
                            >
                              <div>
                                <p className="text-sm font-medium">
                                  {membership.organization?.name || '未知客户'}
                                </p>
                                {membership.organization?.contactEmail && (
                                  <p className="text-xs text-muted-foreground">
                                    {membership.organization.contactEmail}
                                  </p>
                                )}
                              </div>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() =>
                                  handleRemoveFromGroup(group.id, membership.organizationId)
                                }
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose}>关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
