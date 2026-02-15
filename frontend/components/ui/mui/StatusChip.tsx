import { Chip, ChipProps } from '@mui/material'
import { styled } from '@mui/material/styles'

/**
 * 状态类型
 */
export type StatusType = 'success' | 'info' | 'warning' | 'error' | 'pending'

/**
 * 状态标签组件
 * 支持多种状态类型的标签显示
 */
const StatusChipComponent = styled(Chip, {
  shouldForwardProp: (prop) => prop !== 'statusType',
})<ChipProps & { statusType?: StatusType }>(
  ({ theme, statusType = 'info' }) => ({
    fontWeight: 500,
    borderRadius: theme.spacing(1),
    ...(statusType === 'success' && {
      bgcolor: theme.palette.status?.['success-light'] || '#d1fae5',
      color: theme.palette.status?.success || '#10b981',
    }),
    ...(statusType === 'info' && {
      bgcolor: theme.palette.status?.['info-light'] || '#dbeafe',
      color: theme.palette.status?.info || '#3b82f6',
    }),
    ...(statusType === 'warning' && {
      bgcolor: theme.palette.status?.['warning-light'] || '#fef3c7',
      color: theme.palette.status?.warning || '#f59e0b',
    }),
    ...(statusType === 'error' && {
      bgcolor: theme.palette.status?.['error-light'] || '#fee2e2',
      color: theme.palette.status?.error || '#ef4444',
    }),
    ...(statusType === 'pending' && {
      bgcolor: theme.palette.status?.['pending-light'] || '#f3f4f6',
      color: theme.palette.status?.pending || '#6b7280',
    }),
  }),
)

export default StatusChipComponent
