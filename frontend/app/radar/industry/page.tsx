'use client'

import { Box, Container, Typography, Card, CardContent } from '@mui/material'
import { Business } from '@mui/icons-material'

/**
 * Industry Radar Page
 *
 * 行业雷达 - 同业标杆学习
 */
export default function IndustryRadarPage() {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          <Business sx={{ mr: 1, verticalAlign: 'middle' }} />
          行业雷达
        </Typography>
        <Typography variant="body1" color="text.secondary">
          同业标杆学习
        </Typography>
      </Box>

      <Card>
        <CardContent>
          <Typography variant="body1">
            行业雷达功能即将推出...
          </Typography>
        </CardContent>
      </Card>
    </Container>
  )
}
