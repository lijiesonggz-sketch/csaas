'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Layout, Menu } from 'antd'
import {
  DashboardOutlined,
  ProjectOutlined,
  FileTextOutlined,
  SettingOutlined,
  TeamOutlined,
  RadarChartOutlined,
} from '@ant-design/icons'
import type { MenuProps } from 'antd'

const { Sider } = Layout

type MenuItem = Required<MenuProps>['items'][number]

const items: MenuItem[] = [
  {
    key: '/dashboard',
    icon: <DashboardOutlined />,
    label: '工作台',
  },
  {
    key: '/projects',
    icon: <ProjectOutlined />,
    label: '项目管理',
  },
  {
    key: '/radar',
    icon: <RadarChartOutlined />,
    label: '技术雷达',
  },
  {
    key: '/reports',
    icon: <FileTextOutlined />,
    label: '报告中心',
  },
  {
    key: '/team',
    icon: <TeamOutlined />,
    label: '团队管理',
  },
  {
    key: '/settings',
    icon: <SettingOutlined />,
    label: '系统设置',
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)

  const handleMenuClick: MenuProps['onClick'] = async (e) => {
    // 特殊处理雷达导航：自动获取用户的组织ID
    if (e.key === '/radar') {
      console.log('[Sidebar] 点击技术雷达导航')
      try {
        // 获取用户的组织
        const response = await fetch('/api/organizations/me')
        console.log('[Sidebar] /api/organizations/me response status:', response.status)

        if (response.ok) {
          const data = await response.json()
          console.log('[Sidebar] 组织数据:', data)

          const orgId = data.data?.organization?.id
          console.log('[Sidebar] 提取的orgId:', orgId)

          if (orgId) {
            const targetUrl = `/radar?orgId=${orgId}`
            console.log('[Sidebar] 跳转到:', targetUrl)
            router.push(targetUrl)
            return
          } else {
            console.warn('[Sidebar] 未找到orgId，使用默认跳转')
          }
        } else {
          console.warn('[Sidebar] API调用失败，状态码:', response.status)
        }
      } catch (error) {
        console.error('[Sidebar] 获取组织失败:', error)
      }
      // 如果获取失败，仍然跳转到 /radar，让页面自己处理
      console.log('[Sidebar] 使用默认跳转到 /radar')
      router.push('/radar')
    } else {
      router.push(e.key)
    }
  }

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      onCollapse={setCollapsed}
      style={{
        overflow: 'auto',
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 64,
        bottom: 0,
      }}
    >
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[pathname]}
        items={items}
        onClick={handleMenuClick}
        style={{ borderRight: 0 }}
      />
    </Sider>
  )
}
