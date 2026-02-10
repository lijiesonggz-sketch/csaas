'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  Tooltip,
  IconButton,
} from '@mui/material'
import {
  Dashboard as DashboardIcon,
  Folder as FolderIcon,
  Description as DescriptionIcon,
  Settings as SettingsIcon,
  People as PeopleIcon,
  Radar as RadarIcon,
  ExpandLess,
  ExpandMore,
  ChevronLeft,
  ChevronRight,
} from '@mui/icons-material'

interface MenuItem {
  key: string
  icon: React.ReactNode
  label: string
  children?: MenuItem[]
}

const menuItems: MenuItem[] = [
  {
    key: '/dashboard',
    icon: <DashboardIcon />,
    label: '工作台',
  },
  {
    key: '/projects',
    icon: <FolderIcon />,
    label: '项目管理',
  },
  {
    key: '/radar',
    icon: <RadarIcon />,
    label: '技术雷达',
  },
  {
    key: '/reports',
    icon: <DescriptionIcon />,
    label: '报告中心',
  },
  {
    key: '/team',
    icon: <PeopleIcon />,
    label: '团队管理',
  },
  {
    key: '/admin',
    icon: <SettingsIcon />,
    label: '系统管理',
    children: [
      { key: '/admin/dashboard', icon: <DashboardIcon />, label: '运营仪表板' },
      { key: '/admin/content-quality', icon: <DescriptionIcon />, label: '内容质量管理' },
      { key: '/admin/clients', icon: <PeopleIcon />, label: '客户管理' },
      { key: '/admin/cost-optimization', icon: <SettingsIcon />, label: '成本优化' },
      { key: '/admin/branding', icon: <SettingsIcon />, label: '品牌配置' },
      { key: '/admin/radar-sources', icon: <RadarIcon />, label: '信息源配置' },
      { key: '/admin/peer-crawler', icon: <SettingsIcon />, label: '同业爬虫管理' },
      { key: '/admin/peer-crawler/health', icon: <SettingsIcon />, label: '爬虫健康监控' },
    ],
  },
]

interface SidebarProps {
  collapsed?: boolean
  onCollapseChange?: (collapsed: boolean) => void
  width?: number
  collapsedWidth?: number
}

export default function Sidebar({
  collapsed = false,
  onCollapseChange,
  width = 200,
  collapsedWidth = 64,
}: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [expandedKeys, setExpandedKeys] = useState<string[]>(['/admin'])

  const handleToggleCollapse = () => {
    onCollapseChange?.(!collapsed)
  }

  const handleExpandToggle = (key: string) => {
    setExpandedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  const handleNavigation = async (key: string) => {
    // Special handling for radar navigation: auto-get user's organization ID
    if (key === '/radar') {
      console.log('[Sidebar] Clicked tech radar navigation')
      try {
        const response = await fetch('/api/organizations/me')
        console.log('[Sidebar] /api/organizations/me response status:', response.status)

        if (response.ok) {
          const data = await response.json()
          console.log('[Sidebar] Organization data:', data)

          const orgId = data.data?.organization?.id
          console.log('[Sidebar] Extracted orgId:', orgId)

          if (orgId) {
            const targetUrl = `/radar?orgId=${orgId}`
            console.log('[Sidebar] Navigating to:', targetUrl)
            router.push(targetUrl)
            return
          } else {
            console.warn('[Sidebar] orgId not found, using default navigation')
          }
        } else {
          console.warn('[Sidebar] API call failed, status:', response.status)
        }
      } catch (error) {
        console.error('[Sidebar] Failed to get organization:', error)
      }
      // If fetch fails, still navigate to /radar and let the page handle it
      console.log('[Sidebar] Using default navigation to /radar')
      router.push('/radar')
    } else {
      router.push(key)
    }
  }

  const isSelected = (key: string) => pathname === key || pathname.startsWith(`${key}/`)
  const isExpanded = (key: string) => expandedKeys.includes(key)

  const renderMenuItem = (item: MenuItem, level = 0) => {
    const hasChildren = item.children && item.children.length > 0
    const selected = isSelected(item.key)
    const expanded = isExpanded(item.key)

    if (hasChildren) {
      return (
        <Box key={item.key}>
          <ListItem disablePadding>
            {collapsed ? (
              <Tooltip title={item.label} placement="right">
                <ListItemButton
                  onClick={() => handleExpandToggle(item.key)}
                  selected={selected}
                  sx={{
                    minHeight: 48,
                    px: 2.5,
                    justifyContent: 'center',
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 0,
                      justifyContent: 'center',
                      color: selected ? 'primary.main' : 'inherit',
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                </ListItemButton>
              </Tooltip>
            ) : (
              <ListItemButton
                onClick={() => handleExpandToggle(item.key)}
                selected={selected}
                sx={{
                  minHeight: 48,
                  px: 2.5,
                  pl: level * 2 + 2,
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: 2,
                    justifyContent: 'center',
                    color: selected ? 'primary.main' : 'inherit',
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontSize: 14,
                    fontWeight: selected ? 600 : 400,
                  }}
                />
                {expanded ? <ExpandLess /> : <ExpandMore />}
              </ListItemButton>
            )}
          </ListItem>
          {!collapsed && (
            <Collapse in={expanded} timeout="auto" unmountOnExit>
              <List component="div" disablePadding>
                {item.children!.map((child) => (
                  <ListItem key={child.key} disablePadding>
                    <ListItemButton
                      onClick={() => handleNavigation(child.key)}
                      selected={pathname === child.key}
                      sx={{
                        minHeight: 40,
                        pl: (level + 1) * 2 + 3,
                      }}
                    >
                      <ListItemText
                        primary={child.label}
                        primaryTypographyProps={{
                          fontSize: 13,
                          fontWeight: pathname === child.key ? 500 : 400,
                          color: pathname === child.key ? 'primary.main' : 'text.secondary',
                        }}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Collapse>
          )}
        </Box>
      )
    }

    return (
      <ListItem key={item.key} disablePadding>
        {collapsed ? (
          <Tooltip title={item.label} placement="right">
            <ListItemButton
              onClick={() => handleNavigation(item.key)}
              selected={selected}
              sx={{
                minHeight: 48,
                px: 2.5,
                justifyContent: 'center',
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  justifyContent: 'center',
                  color: selected ? 'primary.main' : 'inherit',
                }}
              >
                {item.icon}
              </ListItemIcon>
            </ListItemButton>
          </Tooltip>
        ) : (
          <ListItemButton
            onClick={() => handleNavigation(item.key)}
            selected={selected}
            sx={{
              minHeight: 48,
              px: 2.5,
              pl: level * 2 + 2,
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: 0,
                mr: 2,
                justifyContent: 'center',
                color: selected ? 'primary.main' : 'inherit',
              }}
            >
              {item.icon}
            </ListItemIcon>
            <ListItemText
              primary={item.label}
              primaryTypographyProps={{
                fontSize: 14,
                fontWeight: selected ? 600 : 400,
              }}
            />
          </ListItemButton>
        )}
      </ListItem>
    )
  }

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: collapsed ? collapsedWidth : width,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: collapsed ? collapsedWidth : width,
          boxSizing: 'border-box',
          position: 'fixed',
          left: 0,
          top: 64,
          bottom: 0,
          height: 'calc(100vh - 64px)',
          bgcolor: 'grey.900',
          color: 'common.white',
          transition: (theme) =>
            theme.transitions.create('width', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
          overflowX: 'hidden',
        },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <List sx={{ flexGrow: 1, pt: 2 }}>
          {menuItems.map((item) => renderMenuItem(item))}
        </List>
        <Box sx={{ p: 1, borderTop: 1, borderColor: 'rgba(255,255,255,0.12)' }}>
          <IconButton
            onClick={handleToggleCollapse}
            sx={{
              color: 'common.white',
              width: '100%',
              justifyContent: 'center',
            }}
          >
            {collapsed ? <ChevronRight /> : <ChevronLeft />}
          </IconButton>
        </Box>
      </Box>
    </Drawer>
  )
}
