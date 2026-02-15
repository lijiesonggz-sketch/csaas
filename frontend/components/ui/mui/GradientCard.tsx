import { Paper } from '@mui/material'
import { styled } from '@mui/material/styles'

/**
 * 渐变卡片组件
 * 支持渐变背景和悬停效果的卡片容器
 */
const GradientCard = styled(Paper, {
  shouldForwardProp: (prop) => prop !== 'hover',
})<{ hover?: boolean }>(({ theme, hover }) => ({
  borderRadius: theme.spacing(2),
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  color: 'white',
  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.25)',
  transition: 'all 0.3s ease-in-out',
  ...(hover && {
    cursor: 'pointer',
    '&:hover': {
      transform: 'translateY(-4px)',
      boxShadow: '0 8px 24px rgba(102, 126, 234, 0.35)',
    },
  }),
}))

export default GradientCard
