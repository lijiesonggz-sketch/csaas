import { Button, ButtonProps } from '@mui/material'
import { styled } from '@mui/material/styles'

/**
 * 主按钮组件
 * 紫色渐变背景的主操作按钮
 */
const PrimaryButtonComponent = styled(Button, {
  shouldForwardProp: (prop) => prop !== 'variantStyle',
})<ButtonProps & { variantStyle?: 'dark' | 'light' | 'white' }>(({ theme, variantStyle }) => ({
  background:
    variantStyle === 'white'
      ? 'white'
      : variantStyle === 'light'
        ? 'rgba(255,255,255,0.2)'
        : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  color: variantStyle === 'dark' || variantStyle === 'light' || !variantStyle ? 'white' : '#667eea',
  padding: theme.spacing(1,3),
  borderRadius: theme.spacing(1),
  fontWeight: 600,
  textTransform: 'none',
  boxShadow:
    variantStyle === 'white'
      ? '0 4px 14px rgba(0, 0, 0, 0.25)'
      : '0 4px 14px rgba(102, 126, 234, 0.4)',
  '&:hover': {
    boxShadow:
      variantStyle === 'white'
        ? '0 6px 20px rgba(0, 0, 0, 0.3)'
        : '0 6px 20px rgba(102, 126, 234, 0.5)',
    transform: 'translateY(-1px)',
    backgroundColor:
      variantStyle === 'white' ? 'rgba(255,255,255,0.95)' : undefined,
  },
  transition: 'all 0.2s ease-in-out',
}))

export default PrimaryButtonComponent