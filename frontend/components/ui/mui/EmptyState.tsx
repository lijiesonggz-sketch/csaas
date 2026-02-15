import { Box, Typography, Button, BoxProps } from '@mui/material'

/**
 * 空状态组件
 * 用于展示空状态，包含图标、标题、描述和操作按钮
 */
interface EmptyStateProps extends BoxProps {
  icon: React.ReactNode
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  ...boxProps
}: EmptyStateProps) {
  return (
    <Box
      sx={{
        textAlign: 'center',
        py: 6,
        bgcolor: 'background.default',
        borderRadius: 2,
      }}
      {...boxProps}
    >
      <Box sx={{ fontSize: 48, color: 'text.secondary', mb: 2, opacity: 0.5 }}>
        {icon}
      </Box>
      <Typography variant="body1" color="text.secondary" gutterBottom>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {description}
        </Typography>
      )}
      {actionLabel && onAction && (
        <Button
          variant="contained"
          onClick={onAction}
          sx={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            px: 2,
            py: 1,
            borderRadius: 1,
            fontWeight: 600,
            textTransform: 'none',
            boxShadow: '0 4px 14px rgba(102, 126, 234, 0.4)',
          }}
        >
          {actionLabel}
        </Button>
      )}
    </Box>
  )
}

export default EmptyState
