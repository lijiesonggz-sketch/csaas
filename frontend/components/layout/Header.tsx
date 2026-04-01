'use client'

import { useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  User,
  Settings,
  LogOut,
  Menu,
  Bell,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { clearTokenCache } from '@/lib/utils/api'
import { buildRadarHistoryRoute } from '@/lib/api/radar'
import { useRadarUnreadCount } from '@/lib/hooks/useRadarUnreadCount'

interface HeaderProps {
  onMenuToggle?: () => void
  showMenuButton?: boolean
}

function getSafeDisplayName(name?: string | null, email?: string | null): string {
  const trimmedName = name?.trim()
  if (!trimmedName) return email || ''
  if (trimmedName.includes('\uFFFD')) return email || trimmedName
  return trimmedName
}

export default function Header({ onMenuToggle, showMenuButton = false }: HeaderProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const displayName = getSafeDisplayName(session?.user?.name, session?.user?.email)
  const organizationId = session?.user?.organizationId
  const { unreadCount } = useRadarUnreadCount({
    enabled: Boolean(session?.user && organizationId),
  })

  const handleLogout = () => {
    clearTokenCache()
    signOut({ callbackUrl: '/login' })
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
    <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-[#FEFDFB] border-b border-[#E2E8F0] flex items-center justify-between px-6">
      {/* Left: Logo + Menu toggle */}
      <div className="flex items-center gap-3">
        {showMenuButton && (
          <button
            onClick={onMenuToggle}
            className="p-1.5 rounded hover:bg-gray-100 transition-colors"
            aria-label="toggle menu"
          >
            <Menu className="w-5 h-5 text-gray-600" />
          </button>
        )}
        <span
          className="text-xl font-bold text-[#1E3A5F]"
          style={{ fontFamily: 'var(--font-plus-jakarta), sans-serif' }}
        >
          CSAAS
        </span>
      </div>

      {/* Right: Notifications + User menu */}
      {session?.user && (
        <div className="flex items-center gap-3">
          {/* Notifications */}
          <button
            onClick={() => router.push(buildRadarHistoryRoute(organizationId))}
            className="relative p-2 rounded hover:bg-gray-100 transition-colors"
            aria-label="推送历史"
          >
            <Bell className="w-5 h-5 text-gray-500" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full px-1">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* User dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 py-1 px-2 rounded hover:bg-gray-100 transition-colors">
                <Avatar className="w-8 h-8 bg-[#1E3A5F]">
                  <AvatarFallback className="bg-[#1E3A5F] text-white text-sm">
                    {displayName?.[0]?.toUpperCase() || <User className="w-4 h-4" />}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden sm:block text-left">
                  <div className="text-sm font-medium text-gray-900 leading-tight">{displayName}</div>
                  <div className="text-[11px] text-gray-400 leading-tight">{getRoleLabel(session.user.role)}</div>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem>
                <User className="w-4 h-4 mr-2" />
                个人信息
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="w-4 h-4 mr-2" />
                设置
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                <LogOut className="w-4 h-4 mr-2" />
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </header>
  )
}
