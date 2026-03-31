'use client'

import { useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  AppBar,
  Toolbar,
  Box,
  Typography,
  Avatar,
  Menu,
  MenuItem,
  IconButton,
  Divider,
  Stack,
  Badge,
  Tooltip,
} from '@mui/material'
import {
  Person as PersonIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  Menu as MenuIcon,
  NotificationsOutlined as NotificationsIcon,
} from '@mui/icons-material'
import { clearTokenCache } from '@/lib/utils/api'
import { buildRadarHistoryRoute } from '@/lib/api/radar'
import { useRadarUnreadCount } from '@/lib/hooks/useRadarUnreadCount'

interface HeaderProps {
  onMenuToggle?: () => void
  showMenuButton?: boolean
}

function getSafeDisplayName(name?: string | null, email?: string | null): string {
  const trimmedName = name?.trim()

  if (!trimmedName) {
    return email || ''
  }

  // Fallback when the stored display name already contains Unicode replacement chars.
  if (trimmedName.includes('\uFFFD')) {
    return email || trimmedName
  }

  return trimmedName
}

export default function Header({ onMenuToggle, showMenuButton = false }: HeaderProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const open = Boolean(anchorEl)
  const displayName = getSafeDisplayName(session?.user?.name, session?.user?.email)
  const organizationId = session?.user?.organizationId
  const {
    unreadCount,
  } = useRadarUnreadCount({
    enabled: Boolean(session?.user && organizationId),
  })

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleLogout = () => {
    clearTokenCache()
    signOut({ callbackUrl: '/login' })
    handleClose()
  }

  const getRoleLabel = (role: string) => {
    const roleMap: Record<string, string> = {
      consultant: '主咨询师',
      client_pm: '企业PM',
      respondent: '被调研者',
    }
    return roleMap[role] || role
  }

  return (
    <AppBar
      position="fixed"
      elevation={1}
      sx={{
        bgcolor: 'background.paper',
        color: 'text.primary',
        zIndex: (theme) => theme.zIndex.drawer + 1,
      }}
    >
      <Toolbar sx={{ justifyContent: 'space-between', px: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {showMenuButton && (
            <IconButton
              color="inherit"
              aria-label="toggle menu"
              onClick={onMenuToggle}
              edge="start"
            >
              <MenuIcon />
            </IconButton>
          )}
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              fontSize: 20,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Csaas
          </Typography>
        </Box>

        <Box>
          {session?.user && (
            <Stack direction="row" alignItems="center" spacing={1}>
              <Tooltip title="推送历史">
                <IconButton
                  color="inherit"
                  aria-label="打开推送历史"
                  onClick={() => router.push(buildRadarHistoryRoute(organizationId))}
                >
                  <Badge
                    color="error"
                    badgeContent={unreadCount}
                    max={99}
                    showZero
                  >
                    <NotificationsIcon />
                  </Badge>
                </IconButton>
              </Tooltip>

              <Stack
                direction="row"
                alignItems="center"
                spacing={1}
                onClick={handleClick}
                sx={{
                  cursor: 'pointer',
                  py: 0.5,
                  px: 1,
                  borderRadius: 1,
                  '&:hover': {
                    bgcolor: 'action.hover',
                  },
                }}
                aria-controls={open ? 'user-menu' : undefined}
                aria-haspopup="true"
                aria-expanded={open ? 'true' : undefined}
              >
                <Avatar
                  sx={{
                    width: 32,
                    height: 32,
                    bgcolor: 'primary.main',
                  }}
                >
                  <PersonIcon fontSize="small" />
                </Avatar>
                <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                  <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.4 }}>
                    {displayName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.4 }}>
                    {getRoleLabel(session.user.role)}
                  </Typography>
                </Box>
              </Stack>

              <Menu
                id="user-menu"
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                onClick={handleClose}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                PaperProps={{
                  sx: {
                    minWidth: 180,
                    mt: 1,
                  },
                }}
              >
                <MenuItem onClick={handleClose}>
                  <PersonIcon fontSize="small" sx={{ mr: 1.5 }} />
                  个人信息
                </MenuItem>
                <MenuItem onClick={handleClose}>
                  <SettingsIcon fontSize="small" sx={{ mr: 1.5 }} />
                  设置
                </MenuItem>
                <Divider />
                <MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}>
                  <LogoutIcon fontSize="small" sx={{ mr: 1.5 }} />
                  退出登录
                </MenuItem>
              </Menu>
            </Stack>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  )
}
