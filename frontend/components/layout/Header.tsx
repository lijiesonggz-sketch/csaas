'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { User, Settings, LogOut, Menu, Bell } from 'lucide-react'
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
import { clearAuthNavigationUiArtifacts } from '@/lib/auth/session-expiry'

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
    clearAuthNavigationUiArtifacts()
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
    <header
      role="banner"
      className="fixed left-0 right-0 top-0 z-50 flex h-14 items-center justify-between border-b border-[#E2E8F0] bg-[#FEFDFB] px-6 dark:border-slate-800 dark:bg-slate-950"
    >
      {/* Left: Logo + Menu toggle */}
      <div className="flex items-center gap-3">
        {showMenuButton && (
          <button
            onClick={onMenuToggle}
            className="cursor-pointer rounded p-1.5 transition-colors hover:bg-gray-100 dark:hover:bg-slate-800"
            aria-label="toggle menu"
          >
            <Menu className="h-5 w-5 text-gray-600 dark:text-slate-300" />
          </button>
        )}
        <span
          className="text-xl font-bold text-[#1E3A5F] dark:text-slate-50"
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
            className="relative cursor-pointer rounded p-2 transition-colors hover:bg-gray-100 dark:hover:bg-slate-800"
            aria-label="推送历史"
          >
            <Bell className="h-5 w-5 text-gray-500 dark:text-slate-300" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full px-1">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* User dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 transition-colors hover:bg-gray-100 dark:hover:bg-slate-800">
                <Avatar className="h-8 w-8 bg-[#1E3A5F] dark:bg-slate-700">
                  <AvatarFallback className="bg-[#1E3A5F] text-white text-sm">
                    {displayName?.[0]?.toUpperCase() || <User className="w-4 h-4" />}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden sm:block text-left">
                  <div className="text-sm font-medium leading-tight text-gray-900 dark:text-slate-100">
                    {displayName}
                  </div>
                  <div className="text-[11px] leading-tight text-gray-400 dark:text-slate-400">
                    {getRoleLabel(session.user.role)}
                  </div>
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
