'use client'

import { useSession, signOut } from 'next-auth/react'
import { Layout, Avatar, Dropdown, Space, Typography } from 'antd'
import { LogoutOutlined, UserOutlined, SettingOutlined } from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { clearTokenCache } from '@/lib/utils/api'

const { Header: AntHeader } = Layout
const { Text } = Typography

export default function Header() {
  const { data: session } = useSession()

  const handleLogout = () => {
    clearTokenCache()
    signOut({ callbackUrl: '/login' })
  }

  const menuItems: MenuProps['items'] = [
    {
      key: 'profile',
      label: '个人信息',
      icon: <UserOutlined />,
    },
    {
      key: 'settings',
      label: '设置',
      icon: <SettingOutlined />,
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      label: '退出登录',
      icon: <LogoutOutlined />,
      danger: true,
      onClick: handleLogout,
    },
  ]

  const getRoleLabel = (role: string) => {
    const roleMap: Record<string, string> = {
      consultant: '主咨询师',
      client_pm: '企业PM',
      respondent: '被调研者',
    }
    return roleMap[role] || role
  }

  return (
    <AntHeader
      style={{
        background: '#fff',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Csaas
        </div>
      </div>

      <div>
        {session?.user && (
          <Dropdown menu={{ items: menuItems }} placement="bottomRight">
            <Space style={{ cursor: 'pointer' }}>
              <Avatar
                style={{ background: '#667eea' }}
                icon={<UserOutlined />}
              />
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.4 }}>
                <div style={{ fontWeight: 500 }}>
                  {session.user.name || session.user.email}
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {getRoleLabel(session.user.role)}
                </Text>
              </div>
            </Space>
          </Dropdown>
        )}
      </div>
    </AntHeader>
  )
}
