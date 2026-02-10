'use client'

/**
 * 判断题差距分析结果展示组件
 * 展示基于判断题问卷的差距分析结果
 */

import { useState } from 'react'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import LinearProgress from '@mui/material/LinearProgress'
import Grid from '@mui/material/Grid'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import Divider from '@mui/material/Divider'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import Box from '@mui/material/Box'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import WarningIcon from '@mui/icons-material/Warning'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import LightbulbIcon from '@mui/icons-material/Lightbulb'
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch'
import BarChartIcon from '@mui/icons-material/BarChart'
import CircularProgress from '@mui/material/CircularProgress'

interface BinaryGapAnalysisResult {
  total_clauses: number
  satisfied_clauses: number
  gap_clauses: number
  compliance_rate: number
  summary: {
    overview: string
    top_gap_clusters: string[]
    recommendations: string[]
  }
  gap_details: Array<{
    cluster_id: string
    cluster_name: string
    clause_id: string
    clause_text: string
    question_text: string
    user_answer: boolean
    gap: boolean
    priority: 'HIGH' | 'MEDIUM' | 'LOW'
  }>
  gap_clusters: Array<{
    cluster_id: string
    cluster_name: string
    total_clauses: number
    gap_clauses: number
    gap_rate: number
    priority: string
  }>
}

interface BinaryGapAnalysisResultDisplayProps {
  result: BinaryGapAnalysisResult
  onGenerateActionPlan?: () => void
  loading?: boolean
}

export default function BinaryGapAnalysisResultDisplay({
  result,
  onGenerateActionPlan,
  loading = false,
}: BinaryGapAnalysisResultDisplayProps) {
  const [showAllGaps, setShowAllGaps] = useState(false)

  // 按优先级排序差距
  const sortedGapDetails = [...result.gap_details].sort((a, b) => {
    const priorityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 }
    return priorityOrder[b.priority] - priorityOrder[a.priority]
  })

  // 显示的差距（默认只显示前10个）
  const displayedGaps = showAllGaps ? sortedGapDetails : sortedGapDetails.slice(0, 10)

  const getPriorityColor = (priority: string): 'error' | 'warning' | 'success' | 'default' => {
    switch (priority) {
      case 'HIGH':
        return 'error'
      case 'MEDIUM':
        return 'warning'
      case 'LOW':
        return 'success'
      default:
        return 'default'
    }
  }

  const getPriorityTag = (priority: string) => {
    const labels: Record<string, string> = {
      HIGH: '高优先级',
      MEDIUM: '中优先级',
      LOW: '低优先级',
    }
    return <Chip label={labels[priority] || priority} color={getPriorityColor(priority)} size="small" />
  }

  const getComplianceRateColor = (rate: number) => {
    if (rate >= 0.8) return '#52c41a'
    if (rate >= 0.6) return '#faad14'
    return '#f5222d'
  }

  return (
    <div className="space-y-6">
      {/* 总体统计 */}
      <Card>
        <CardContent>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, md: 3 }}>
              <Box>
                <Typography variant="body2" color="text.secondary">合规率</Typography>
                <Typography variant="h4" sx={{ color: getComplianceRateColor(result.compliance_rate), display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <BarChartIcon /> {(result.compliance_rate * 100).toFixed(1)}%
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Box>
                <Typography variant="body2" color="text.secondary">总条款</Typography>
                <Typography variant="h4">{result.total_clauses} <Typography component="span" variant="body2">项</Typography></Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Box>
                <Typography variant="body2" color="text.secondary">已满足</Typography>
                <Typography variant="h4" sx={{ color: '#52c41a', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <CheckCircleIcon /> {result.satisfied_clauses} <Typography component="span" variant="body2">项</Typography>
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Box>
                <Typography variant="body2" color="text.secondary">差距条款</Typography>
                <Typography variant="h4" sx={{ color: '#f5222d', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <WarningIcon /> {result.gap_clauses} <Typography component="span" variant="body2">项</Typography>
                </Typography>
              </Box>
            </Grid>
          </Grid>

          {result.summary.overview && (
            <>
              <Divider sx={{ my: 2 }} />
              <Alert severity="info" sx={{ mb: 2 }}>{result.summary.overview}</Alert>
            </>
          )}
        </CardContent>
      </Card>

      {/* 差距聚类汇总 */}
      {result.gap_clusters.length > 0 && (
        <Card>
          <CardHeader
            title={<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><WarningIcon /> 差距聚类汇总</Box>}
            titleTypographyProps={{ variant: 'subtitle1' }}
          />
          <CardContent>
            <Grid container spacing={2}>
              {result.gap_clusters.map((cluster) => (
                <Grid size={{ xs: 12, md: 4 }} key={cluster.cluster_id}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent>
                      <Typography variant="body1" gutterBottom>{cluster.cluster_name}</Typography>
                      <Typography variant="h4" sx={{
                        color: cluster.gap_rate >= 0.5 ? '#f5222d' : cluster.gap_rate >= 0.3 ? '#faad14' : '#52c41a',
                      }}>
                        {(cluster.gap_rate * 100).toFixed(1)}%
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        {cluster.gap_clauses} / {cluster.total_clauses} 条款未满足
                      </Typography>
                      <Box sx={{ mt: 1 }}>{getPriorityTag(cluster.priority)}</Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>

            {result.summary.top_gap_clusters && result.summary.top_gap_clusters.length > 0 && (
              <>
                <Divider sx={{ my: 2 }} />
                <Alert severity="warning">
                  <Typography variant="subtitle2" gutterBottom>差距最严重的聚类</Typography>
                  <ul className="mb-0">
                    {result.summary.top_gap_clusters.map((cluster, idx) => (
                      <li key={idx}>{cluster}</li>
                    ))}
                  </ul>
                </Alert>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* 具体差距详情 */}
      {result.gap_details.length > 0 && (
        <Card>
          <CardHeader
            title={<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><WarningIcon /> 差距详情</Box>}
            titleTypographyProps={{ variant: 'subtitle1' }}
            action={
              <Button size="small" onClick={() => setShowAllGaps(!showAllGaps)}>
                {showAllGaps ? '收起' : `查看全部 (${result.gap_details.length})`}
              </Button>
            }
          />
          <CardContent>
            <List>
              {displayedGaps.map((item, idx) => (
                <ListItem key={idx} sx={{ flexDirection: 'column', alignItems: 'flex-start', borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                    <Chip label={item.cluster_name} size="small" />
                    <Chip label={item.clause_id} size="small" variant="outlined" />
                    {getPriorityTag(item.priority)}
                  </Stack>
                  <Box sx={{ width: '100%' }}>
                    <Typography variant="body2"><strong>条款要求：</strong> {item.clause_text}</Typography>
                    <Typography variant="body2"><strong>问题：</strong> {item.question_text}</Typography>
                    <Typography variant="body2" component="div">
                      <strong>用户回答：</strong>{' '}
                      <Chip label={item.user_answer ? '有' : '没有'} color={item.user_answer ? 'success' : 'error'} size="small" />
                      {item.gap && <Chip label="存在差距" color="error" size="small" sx={{ ml: 1 }} />}
                    </Typography>
                  </Box>
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      {/* 无差距情况 */}
      {result.gap_details.length === 0 && (
        <Alert severity="success">
          恭喜！未发现明显差距 - 您的组织现状已基本满足标准要求。
        </Alert>
      )}

      {/* 改进建议 */}
      {result.summary.recommendations && result.summary.recommendations.length > 0 && (
        <Card>
          <CardHeader
            title={<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><LightbulbIcon /> 改进建议</Box>}
            titleTypographyProps={{ variant: 'subtitle1' }}
          />
          <CardContent>
            <ul>
              {result.summary.recommendations.map((rec, idx) => (
                <li key={idx} className="mb-2">{rec}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* 生成改进措施按钮 */}
      {onGenerateActionPlan && result.gap_details.length > 0 && (
        <Card>
          <CardContent>
            <Box sx={{ textAlign: 'center' }}>
              <Stack spacing={2} alignItems="center">
                <Box>
                  <RocketLaunchIcon sx={{ fontSize: 48, color: 'primary.main' }} />
                  <Typography variant="h6" sx={{ mt: 1 }}>需要改进措施吗？</Typography>
                  <Typography variant="body2" color="text.secondary">
                    基于以上差距分析，AI可以为您生成针对性的改进措施
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <TrendingUpIcon />}
                  onClick={onGenerateActionPlan}
                  disabled={loading}
                >
                  生成改进措施
                </Button>
              </Stack>
            </Box>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
