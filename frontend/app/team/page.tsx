'use client'

/**
 * Team Management Page
 *
 * Story 1.5 - Organization Member Management Page
 * Allows organization admins to manage team members
 */

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Users, Plus, Edit, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { organizationsApi } from '@/lib/api/organizations'
import { OrganizationMember } from '@/lib/types/organization'
import { formatChinaDate } from '@/lib/utils/dateTime'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { PageHeader } from '@/components/ui/page-header'
import { AddMemberDialog } from './components/AddMemberDialog'
import { EditMemberDialog } from './components/EditMemberDialog'
import { ConfirmRemoveDialog } from './components/ConfirmRemoveDialog'

// Extended session user type with organization data
interface SessionUser {
  id?: string
  name?: string
  email?: string
  role?: string
  organizationId?: string
  organizationRole?: 'admin' | 'member'
}

export default function TeamManagementPage() {
  const { data: session } = useSession()

  // Data state
  const [members, setMembers] = useState<OrganizationMember[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Pagination state
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState<OrganizationMember | null>(null)
  const [mutating, setMutating] = useState(false)

  // Get organization ID and role from session
  const user = session?.user as SessionUser | undefined
  const organizationId = user?.organizationId
  const organizationRole = user?.organizationRole
  const isAdmin = organizationRole === 'admin'

  // Fetch members
  const fetchMembers = useCallback(async () => {
    if (!organizationId) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const response = await organizationsApi.getOrganizationMembers(
        organizationId,
        page + 1,
        rowsPerPage
      )
      setMembers(response?.data || [])
      setTotal(response?.pagination?.total || 0)
    } catch (err: any) {
      setError(err.message || '加载成员列表失败')
    } finally {
      setIsLoading(false)
    }
  }, [organizationId, page, rowsPerPage])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  // Add member handler
  const handleAddSubmit = async (data: { email: string; role: 'admin' | 'member' }) => {
    if (!organizationId) return
    setMutating(true)
    try {
      await organizationsApi.addMemberByEmail(organizationId, data.email, data.role)
      toast.success('成员添加成功')
      setAddDialogOpen(false)
      fetchMembers()
    } catch (err: any) {
      const msg = err.message || '添加成员失败'
      if (msg.includes('already a member') || msg.includes('已是')) {
        toast.error('该用户已是组织成员')
      } else if (msg.includes('not found') || msg.includes('找不到')) {
        toast.error('找不到该用户，请检查邮箱地址')
      } else {
        toast.error(msg)
      }
    } finally {
      setMutating(false)
    }
  }

  // Remove member handler
  const handleConfirmRemove = async () => {
    if (!organizationId || !selectedMember) return
    setMutating(true)
    try {
      await organizationsApi.removeMember(organizationId, selectedMember.userId)
      toast.success('成员已移除')
      setRemoveDialogOpen(false)
      setSelectedMember(null)
      fetchMembers()
    } catch (err: any) {
      toast.error(err.message || '移除成员失败')
    } finally {
      setMutating(false)
    }
  }

  // Update member role handler
  const handleEditSubmit = async (role: 'admin' | 'member') => {
    if (!organizationId || !selectedMember) return
    setMutating(true)
    try {
      await organizationsApi.updateMemberRole(organizationId, selectedMember.userId, role)
      toast.success('成员角色已更新')
      setEditDialogOpen(false)
      setSelectedMember(null)
      fetchMembers()
    } catch (err: any) {
      toast.error(err.message || '更新成员角色失败')
    } finally {
      setMutating(false)
    }
  }

  // Pagination handlers
  const handleChangePage = (newPage: number) => {
    setPage(newPage)
  }

  const handleChangeRowsPerPage = (value: string) => {
    setRowsPerPage(parseInt(value, 10))
    setPage(0)
  }

  const handleEdit = (member: OrganizationMember) => {
    setSelectedMember(member)
    setEditDialogOpen(true)
  }

  const handleRemove = (member: OrganizationMember) => {
    setSelectedMember(member)
    setRemoveDialogOpen(true)
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh] bg-[#FEFDFB]">
        <Loader2 className="w-8 h-8 animate-spin text-[#1E3A5F]" />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="p-6 bg-[#FEFDFB]">
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-sm">
          加载成员列表失败: {error}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 bg-[#FEFDFB] min-h-screen">
      <PageHeader
        title="团队管理"
        description="维护咨询团队成员、角色权限和组织协作边界"
        icon={<Users className="h-6 w-6" />}
        variant="default"
        className="p-8"
        action={
          isAdmin ? (
            <Button
              onClick={() => setAddDialogOpen(true)}
              className="rounded-sm bg-white text-[#1E3A5F] hover:bg-white/90"
            >
              <Plus className="w-4 h-4 mr-2" />
              添加成员
            </Button>
          ) : null
        }
      />

      {/* Members Table */}
      <Card className="border border-[#E2E8F0] rounded-sm shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#1E3A5F] hover:bg-[#1E3A5F]">
                  <TableHead className="text-white">姓名</TableHead>
                  <TableHead className="text-white">邮箱</TableHead>
                  <TableHead className="text-white">角色</TableHead>
                  <TableHead className="text-white">加入时间</TableHead>
                  {isAdmin && <TableHead className="text-white text-right">操作</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 5 : 4} className="text-center py-8">
                      <p className="text-[#94A3B8]">暂无成员</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  members.map((member: OrganizationMember) => {
                    const isSelf = member.userId === session?.user?.id
                    return (
                      <TableRow key={member.id} className="hover:bg-[#FEFDFB]">
                        <TableCell className="font-medium">{member.user?.name || '-'}</TableCell>
                        <TableCell>{member.user?.email || '-'}</TableCell>
                        <TableCell>
                          <Badge
                            variant={member.role === 'admin' ? 'default' : 'secondary'}
                            className={
                              member.role === 'admin'
                                ? 'bg-[#059669] text-white rounded-sm'
                                : 'bg-[#94A3B8] text-white rounded-sm'
                            }
                          >
                            {member.role === 'admin' ? '管理员' : '成员'}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatChinaDate(member.createdAt)}</TableCell>
                        {isAdmin && (
                          <TableCell className="text-right">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-block">
                                    <button
                                      onClick={() => handleEdit(member)}
                                      disabled={isSelf}
                                      className="p-2 hover:bg-[#E2E8F0] rounded-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                      aria-label={`编辑 ${member.user?.name || ''}`}
                                    >
                                      <Edit className="w-4 h-4 text-[#1E3A5F]" />
                                    </button>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {isSelf ? '不能编辑自己' : '编辑角色'}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-block">
                                    <button
                                      onClick={() => handleRemove(member)}
                                      disabled={isSelf}
                                      className="p-2 hover:bg-red-50 rounded-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                      aria-label={`移除 ${member.user?.name || ''}`}
                                    >
                                      <Trash2 className="w-4 h-4 text-red-600" />
                                    </button>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {isSelf ? '不能移除自己' : '移除成员'}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#E2E8F0]">
            <p className="text-sm text-[#94A3B8]">
              显示 {page * rowsPerPage + 1} - {Math.min((page + 1) * rowsPerPage, total)} 共 {total}{' '}
              条
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-[#94A3B8]">每页行数:</span>
              <Select value={rowsPerPage.toString()} onValueChange={handleChangeRowsPerPage}>
                <SelectTrigger className="w-16 h-8 rounded-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleChangePage(page - 1)}
                  disabled={page === 0}
                  className="h-8 rounded-sm"
                >
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleChangePage(page + 1)}
                  disabled={(page + 1) * rowsPerPage >= total}
                  className="h-8 rounded-sm"
                >
                  下一页
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <AddMemberDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onSubmit={handleAddSubmit}
        isLoading={mutating}
      />

      <EditMemberDialog
        open={editDialogOpen}
        member={selectedMember}
        onClose={() => {
          setEditDialogOpen(false)
          setSelectedMember(null)
        }}
        onSubmit={handleEditSubmit}
        isLoading={mutating}
      />

      <ConfirmRemoveDialog
        open={removeDialogOpen}
        member={selectedMember}
        onClose={() => {
          setRemoveDialogOpen(false)
          setSelectedMember(null)
        }}
        onConfirm={handleConfirmRemove}
        isLoading={mutating}
      />
    </div>
  )
}
