import { Card } from '@mui/material'
import { styled } from '@mui/material/styles'

/**
 * 统计卡片组件
 * 用于展示统计数据，带悬浮效果
 */
const StatCardComponent = styled(Card)(({ theme }) => ({
  borderRadius: theme.spacing(2),
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05), 0 4px 12px rgba(0, 0, 0, 0.05)',
  transition: 'all 0.2s ease-in-out',
  '&:hover': {
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1), 0 8px 24px rgba(0, 0, 0, 0.08)',
    transform: 'translateY(-2px)',
  },
}))

export default StatCardComponent
