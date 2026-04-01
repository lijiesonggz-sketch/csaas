'use client'

import React from 'react'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Funnel, Star } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * PeerMonitoringFilter组件属性
 */
interface PeerMonitoringFilterProps {
  filter: 'all' | 'watched' | 'specific-peer'
  selectedPeer?: string
  watchedPeers: string[]
  onFilterChange: (filter: 'all' | 'watched' | 'specific-peer') => void
  onPeerChange?: (peer: string) => void
}

/**
 * PeerMonitoringFilter组件 - 同业动态筛选器
 *
 * Story 8.6 - AC4
 *
 * 功能：
 * - 全部同业动态筛选
 * - 我关注的同业筛选
 * - 特定同业机构筛选
 * - 高亮显示关注的同业机构名称
 */
export const PeerMonitoringFilter: React.FC<PeerMonitoringFilterProps> = ({
  filter,
  selectedPeer,
  watchedPeers,
  onFilterChange,
  onPeerChange,
}) => {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Funnel className="w-4 h-4 text-[#94A3B8]" />
        <span className="text-sm text-[#94A3B8]">筛选条件</span>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {/* 全部 */}
        <Badge
          className={cn(
            "rounded-sm cursor-pointer px-3 py-1.5",
            filter === 'all'
              ? "bg-[#1E3A5F] text-white hover:bg-[#152a47]"
              : "bg-slate-100 text-[#94A3B8] hover:bg-slate-200"
          )}
          onClick={() => onFilterChange('all')}
        >
          全部同业动态
        </Badge>

        {/* 我关注的同业 */}
        <Badge
          className={cn(
            "rounded-sm cursor-pointer px-3 py-1.5 flex items-center gap-1",
            filter === 'watched'
              ? "bg-[#059669] text-white hover:bg-[#047857]"
              : "bg-slate-100 text-[#94A3B8] hover:bg-slate-200"
          )}
          onClick={() => onFilterChange('watched')}
        >
          <Star className="w-3 h-3" />
          我关注的同业
        </Badge>

        {/* 特定同业选择 */}
        {watchedPeers.length > 0 && (
          <Select
            value={filter === 'specific-peer' ? selectedPeer || '__all__' : '__all__'}
            onValueChange={(peer) => {
              if (peer && peer !== '__all__') {
                onFilterChange('specific-peer')
                onPeerChange?.(peer)
              } else if (peer === '__all__') {
                onFilterChange('all')
                onPeerChange?.('')
              }
            }}
          >
            <SelectTrigger className="rounded-sm border-[#E2E8F0] w-48 ml-2" aria-label="选择同业">
              <SelectValue placeholder="选择同业" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">全部</SelectItem>
              {watchedPeers.map((peer) => (
                <SelectItem key={peer} value={peer}>
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-amber-500" />
                    {peer}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* 当前筛选状态提示 */}
      {filter === 'watched' && (
        <p className="text-xs text-[#059669] mt-2">
          仅显示您关注的同业机构动态
        </p>
      )}
      {filter === 'specific-peer' && selectedPeer && (
        <p className="text-xs text-[#1E3A5F] mt-2">
          仅显示 {selectedPeer} 的动态
        </p>
      )}
    </div>
  )
}
