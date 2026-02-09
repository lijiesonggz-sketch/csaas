'use client'

import React from 'react'
import { Box, Chip, Typography, FormControl, InputLabel, Select, MenuItem } from '@mui/material'
import { FilterList, Star } from '@mui/icons-material'

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
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <FilterList color="action" fontSize="small" />
        <Typography variant="subtitle2" color="text.secondary">
          筛选条件
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* 全部 */}
        <Chip
          label="全部同业动态"
          color={filter === 'all' ? 'primary' : 'default'}
          onClick={() => onFilterChange('all')}
          sx={{
            fontWeight: filter === 'all' ? 600 : 400,
            cursor: 'pointer',
          }}
        />

        {/* 我关注的同业 */}
        <Chip
          icon={<Star fontSize="small" />}
          label="我关注的同业"
          color={filter === 'watched' ? 'success' : 'default'}
          onClick={() => onFilterChange('watched')}
          sx={{
            fontWeight: filter === 'watched' ? 600 : 400,
            cursor: 'pointer',
          }}
        />

        {/* 特定同业选择 */}
        {watchedPeers.length > 0 && (
          <FormControl
            size="small"
            sx={{ minWidth: 150, ml: 1 }}
          >
            <InputLabel id="peer-select-label">选择同业</InputLabel>
            <Select
              labelId="peer-select-label"
              value={filter === 'specific-peer' ? selectedPeer || '' : ''}
              label="选择同业"
              onChange={(e) => {
                const peer = e.target.value as string
                if (peer) {
                  onFilterChange('specific-peer')
                  onPeerChange?.(peer)
                }
              }}
              displayEmpty
            >
              <MenuItem value="">
                <em>全部</em>
              </MenuItem>
              {watchedPeers.map((peer) => (
                <MenuItem key={peer} value={peer}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Star fontSize="small" color="warning" />
                    {peer}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </Box>

      {/* 当前筛选状态提示 */}
      {filter === 'watched' && (
        <Typography
          variant="caption"
          color="success.main"
          sx={{ mt: 1, display: 'block' }}
        >
          仅显示您关注的同业机构动态
        </Typography>
      )}
      {filter === 'specific-peer' && selectedPeer && (
        <Typography
          variant="caption"
          color="primary.main"
          sx={{ mt: 1, display: 'block' }}
        >
          仅显示 {selectedPeer} 的动态
        </Typography>
      )}
    </Box>
  )
}
