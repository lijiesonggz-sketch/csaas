'use client'

/**
 * Team Management Page
 *
 * Story 1.5 - Organization Member Management Page
 * Allows organization admins to manage team members
 */

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Chip,
  CircularProgress,
  Alert,
  Tooltip,
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  People as PeopleIcon,
} from '@mui/icons-material'
import { toast } from 'sonner'
import { organizationsApi } from '@/lib/api/organizations'
import { OrganizationMember } from '@/lib/types/organization'
import { formatChinaDate } from '@/lib/utils/dateTime'

// Extended session user type with organization data
interface SessionUser {
  id?: string
  name?: string
  email?: string
  role?: string
  organizationId?: string
  organizationRole?: 'admin' | 'member'
}
import { AddMemberDialog } from './components/AddMemberDialog'
import { EditMemberDialog } from './components/EditMemberDialog'
import { ConfirmRemoveDialog } from './components/ConfirmRemoveDialog'

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
        rowsPerPage,
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
  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage)
  }

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10))
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
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  // Error state
  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">加载成员列表失败: {error}</Alert>
      </Box>
    )
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PeopleIcon color="primary" />
          <Typography variant="h4" component="h1">
            团队管理
          </Typography>
        </Box>
        {isAdmin && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setAddDialogOpen(true)}
          >
            添加成员
          </Button>
        )}
      </Box>

      {/* Members Table */}
      <Paper elevation={1}>
        <TableContainer>
          <Table aria-label="组织成员列表">
            <TableHead>
              <TableRow>
                <TableCell>姓名</TableCell>
                <TableCell>邮箱</TableCell>
                <TableCell>角色</TableCell>
                <TableCell>加入时间</TableCell>
                {isAdmin && <TableCell align="right">操作</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 5 : 4} align="center">
                    <Typography color="text.secondary" sx={{ py: 4 }}>
                      暂无成员
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                members.map((member: OrganizationMember) => {
                  const isSelf = member.userId === session?.user?.id
                  return (
                    <TableRow key={member.id}>
                      <TableCell>{member.user?.name || '-'}</TableCell>
                      <TableCell>{member.user?.email || '-'}</TableCell>
                      <TableCell>
                        <Chip
                          label={member.role === 'admin' ? '管理员' : '成员'}
                          color={member.role === 'admin' ? 'primary' : 'default'}
                          size="small"
                        />
                      </TableCell>

                      <TableCell>
                        {formatChinaDate(member.createdAt)}
                      </TableCell>
                      {isAdmin && (
                        <TableCell align="right">
                          <Tooltip title={isSelf ? '不能编辑自己' : '编辑角色'}>
                            <span>
                              <IconButton
                                size="small"
                                onClick={() => handleEdit(member)}
                                disabled={isSelf}
                                aria-label={`编辑 ${member.user?.name || ''}`}
                              >
                                <EditIcon />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title={isSelf ? '不能移除自己' : '移除成员'}>
                            <span>
                              <IconButton
                                size="small"
                                onClick={() => handleRemove(member)}
                                disabled={isSelf}
                                color="error"
                                aria-label={`移除 ${member.user?.name || ''}`}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 20, 50]}
          labelRowsPerPage="每页行数"
          labelDisplayedRows={({ from, to, count }) =>
            `${from}-${to} 共 ${count} 条`
          }
        />
      </Paper>

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
    </Box>
  )
}
