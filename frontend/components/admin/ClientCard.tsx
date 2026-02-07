/**
 * ClientCard Component
 *
 * Story 6.2: 咨询公司批量客户管理后台
 *
 * 客户卡片组件 - 显示客户基本信息和操作按钮
 */

import React from 'react'
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Box,
  Chip,
  IconButton,
  Tooltip,
  Stack,
} from '@mui/material'
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Settings as SettingsIcon,
  Business as BusinessIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material'
import {
  Client,
  IndustryType,
  OrganizationScale,
  OrganizationStatus,
} from '@/lib/api/clients'

interface ClientCardProps {
  client: Client
  onEdit: (client: Client) => void
  onDelete: (client: Client) => void
  onConfig: (client: Client) => void
  selected?: boolean
  onSelect?: (client: Client, selected: boolean) => void
}

// 行业类型标签映射
const INDUSTRY_LABELS: Record<IndustryType, string> = {
  [IndustryType.BANKING]: '银行',
  [IndustryType.SECURITIES]: '证券',
  [IndustryType.INSURANCE]: '保险',
  [IndustryType.ENTERPRISE]: '企业',
}

// 机构规模标签映射
const SCALE_LABELS: Record<OrganizationScale, string> = {
  [OrganizationScale.LARGE]: '大型',
  [OrganizationScale.MEDIUM]: '中型',
  [OrganizationScale.SMALL]: '小型',
}

// 状态标签映射
const STATUS_LABELS: Record<OrganizationStatus, string> = {
  [OrganizationStatus.ACTIVE]: '活跃',
  [OrganizationStatus.INACTIVE]: '停用',
  [OrganizationStatus.TRIAL]: '试用',
}

// 状态颜色映射
const STATUS_COLORS: Record<
  OrganizationStatus,
  'success' | 'default' | 'warning' | 'error'
> = {
  [OrganizationStatus.ACTIVE]: 'success',
  [OrganizationStatus.INACTIVE]: 'default',
  [OrganizationStatus.TRIAL]: 'warning',
}

export function ClientCard({
  client,
  onEdit,
  onDelete,
  onConfig,
  selected = false,
  onSelect,
}: ClientCardProps) {
  const handleCardClick = () => {
    if (onSelect) {
      onSelect(client, !selected)
    }
  }

  return (
    <Card
      data-testid="client-card"
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        cursor: onSelect ? 'pointer' : 'default',
        border: selected ? '2px solid' : '1px solid',
        borderColor: selected ? 'primary.main' : 'divider',
        transition: 'all 0.2s',
        '&:hover': {
          boxShadow: 3,
          borderColor: onSelect ? 'primary.main' : 'divider',
        },
      }}
      onClick={onSelect ? handleCardClick : undefined}
    >
      <CardContent sx={{ flexGrow: 1, pb: 1 }}>
        {/* 客户名称和状态 */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
          <BusinessIcon sx={{ mr: 1, color: 'primary.main', mt: 0.5 }} />
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" component="div" gutterBottom data-testid="client-name">
              {client.name}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {client.status && (
                <Chip
                  data-testid="client-status"
                  label={STATUS_LABELS[client.status]}
                  color={STATUS_COLORS[client.status]}
                  size="small"
                />
              )}
              {client.industryType && (
                <Chip
                  data-testid="client-industry"
                  label={INDUSTRY_LABELS[client.industryType]}
                  variant="outlined"
                  size="small"
                />
              )}
              {client.scale && (
                <Chip
                  label={SCALE_LABELS[client.scale]}
                  variant="outlined"
                  size="small"
                />
              )}
            </Box>
          </Box>
        </Box>

        {/* 联系信息 */}
        <Stack spacing={1} sx={{ mb: 2 }}>
          {client.contactPerson && (
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <PersonIcon sx={{ fontSize: 18, mr: 1, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                {client.contactPerson}
              </Typography>
            </Box>
          )}
          {client.contactEmail && (
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <EmailIcon sx={{ fontSize: 18, mr: 1, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary" noWrap>
                {client.contactEmail}
              </Typography>
            </Box>
          )}
        </Stack>

        {/* 统计信息 */}
        <Box
          sx={{
            display: 'flex',
            gap: 2,
            p: 1.5,
            backgroundColor: 'action.hover',
            borderRadius: 1,
          }}
        >
          <Box sx={{ flex: 1, textAlign: 'center' }}>
            <Typography variant="h6" color="primary">
              {client.userCount || 0}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              用户数
            </Typography>
          </Box>
          <Box sx={{ flex: 1, textAlign: 'center' }}>
            <Typography variant="h6" color="primary">
              {client.pushCount || 0}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              推送数
            </Typography>
          </Box>
        </Box>

        {/* 推送配置信息 */}
        {(client.pushStartTime || client.dailyPushLimit) && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary" display="block">
              推送配置:
            </Typography>
            <Typography variant="body2" color="text.primary">
              {client.pushStartTime && client.pushEndTime
                ? `${client.pushStartTime} - ${client.pushEndTime}`
                : '未设置'}
              {client.dailyPushLimit && ` · 每日${client.dailyPushLimit}条`}
            </Typography>
          </Box>
        )}

        {/* 最后推送时间 */}
        {client.lastPushAt && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="caption" color="text.secondary">
              最后推送: {new Date(client.lastPushAt).toLocaleString('zh-CN')}
            </Typography>
          </Box>
        )}
      </CardContent>

      {/* 操作按钮 */}
      <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }} data-testid="client-actions">
        <Tooltip title="推送配置">
          <IconButton
            size="small"
            color="primary"
            onClick={(e) => {
              e.stopPropagation()
              onConfig(client)
            }}
          >
            <SettingsIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="编辑">
          <IconButton
            size="small"
            color="primary"
            onClick={(e) => {
              e.stopPropagation()
              onEdit(client)
            }}
          >
            <EditIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="删除">
          <IconButton
            size="small"
            color="error"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(client)
            }}
          >
            <DeleteIcon />
          </IconButton>
        </Tooltip>
      </CardActions>
    </Card>
  )
}
