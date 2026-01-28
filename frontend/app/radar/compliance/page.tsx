'use client'

import { Box, Container, Typography, Card, CardContent } from '@mui/material'
import { Gavel } from '@mui/icons-material'

/**
 * Compliance Radar Page
 *
 * 合规雷达 - 风险预警与应对剧本
 */
export default function ComplianceRadarPage() {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          <Gavel sx={{ mr: 1, verticalAlign: 'middle' }} />
          合规雷达
        </Typography>
        <Typography variant="body1" color="text.secondary">
          风险预警与应对剧本
        </Typography>
      </Box>

      <Card>
        <CardContent>
          <Typography variant="body1">
            合规雷达功能即将推出...
          </Typography>
        </CardContent>
      </Card>
    </Container>
  )
}
