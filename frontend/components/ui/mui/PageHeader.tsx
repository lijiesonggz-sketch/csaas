import { Box, Typography, IconButton, BoxProps } from '@mui/material'

/**
 * 页面头部组件
 * 渐变头部组件，包含标题、描述、图标和操作按钮
 */
interface PageHeaderProps extends BoxProps {
  title: string
  description?: string
  icon?: React.ReactNode
  action?: React.ReactNode
}

export function PageHeader({ title, description, icon, action, ...boxProps }: PageHeaderProps) {
  return (
    <Box
      sx={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        borderRadius: 3,
        padding: 4,
        position: 'relative',
        overflow: 'hidden',
        marginBottom: 3,
      }}
      {...boxProps}
    >
      <Box sx={{ position: 'relative', zIndex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          {icon && (
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                bgcolor: 'rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(10px)',
              }}
            >
              {icon}
            </Box>
          )}
          <Box sx={{ flex: 1 }}>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {title}
            </Typography>
            {description && (
              <Typography variant="body1" sx={{ opacity: 0.9 }}>
                {description}
              </Typography>
            )}
          </Box>
          {action}
        </Box>
      </Box>
    </Box>
  )
}

export default PageHeader
