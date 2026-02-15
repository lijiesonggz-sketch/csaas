import { Button, ButtonProps } from '@mui/material'
import { styled } from '@mui/material/styles'

/**
 * 次要按钮组件
 * 白色或透明背景的次要按钮
 */
const SecondaryButtonComponent = styled(Button, {
  shouldForwardProp: (prop) => prop !== 'variantStyle',
})<ButtonProps & { variantStyle?: 'light' | 'dark' }>(({ theme, variantStyle }) => ({
  borderColor: variantStyle === 'light' ? 'rgba(255,255,255,0.5)' : undefined,
  color: variantStyle === 'light' ? 'white' : '#667eea',
  padding: theme.spacing(1.5, 4),
  borderRadius: theme.spacing(1),
  fontWeight: 600,
  textTransform: 'none',
  fontSize: '1rem',
  '&:hover': {
    borderColor: variantStyle === 'light' ? 'white' : undefined,
    backgroundColor: variantStyle === 'light' ? 'rgba(255,255,255,0.1)' : undefined,
  },
}))

export default SecondaryButtonComponent
