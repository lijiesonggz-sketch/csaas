import React from 'react'
import { Box, Typography } from '@mui/material'
import { Inbox } from '@mui/icons-material'

interface EmptyStateProps {
  description?: string
  icon?: React.ReactNode
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  description = '暂无数据',
  icon = <Inbox sx={{ fontSize: 48, color: 'text.disabled' }} />,
}) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 4,
        color: 'text.secondary',
      }}
    >
      <Box sx={{ mb: 2 }}>{icon}</Box>
      <Typography variant="body1" color="text.secondary">
        {description}
      </Typography>
    </Box>
  )
}
