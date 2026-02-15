import { Paper } from '@mui/material'
import { styled } from '@mui/material/styles'

/**
 * 渐变头部组件
 * 用于页面标题区域的紫色渐变背景
 */
const GradientHeaderComponent = styled(Paper)(({ theme }) => ({
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  color: 'white',
  borderRadius: theme.spacing(3),
  padding: theme.spacing(4),
  position: 'relative',
  overflow: 'hidden',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.1) 0%, transparent 50%)',
  },
}))

export default GradientHeaderComponent
