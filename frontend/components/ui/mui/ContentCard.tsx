import { Paper } from '@mui/material'
import { styled } from '@mui/material/styles'

/**
 * 内容卡片组件
 * 纸白色背景的通用内容容器
 */
const ContentCardComponent = styled(Paper)(({ theme }) => ({
  borderRadius: theme.spacing(2),
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05), 0 4px 12px rgba(0, 0, 0, 0.05)',
  transition: 'box-shadow 0.2s ease-in-out',
  '&:hover': {
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1), 0 8px 24px rgba(0, 0, 0, 0.08)',
  },
}))

export default ContentCardComponent
