'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Card,
  CardContent,
  CardHeader,
  Button,
  Alert,
  AlertTitle,
  Box,
  Typography,
  TextField,
  LinearProgress,
  Chip,
  Tabs,
  Tab,
  Grid,
} from '@mui/material'
import {
  ArrowBack,
  Send,
  CheckCircle,
  Warning,
  BarChart,
} from '@mui/icons-material'
import { message } from '@/lib/message'

interface QuickGapAnalysisResult {
  gap_analysis: {
    overview: string
    compliance_rate: number
    total_requirements: number
    satisfied_requirements: number
    gap_requirements: number
    gaps: Array<{
      requirement: string
      severity: 'HIGH' | 'MEDIUM' | 'LOW'
      recommendation: string
    }>
  }
}

export default function QuickGapAnalysisPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId as string

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<QuickGapAnalysisResult | null>(null)
  const [activeTab, setActiveTab] = useState(0)

  const handleSubmit = async () => {
    if (!input.trim()) {
      message.warning('请输入分析内容')
      return
    }

    try {
      setLoading(true)
      // TODO: Implement actual API call
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Mock result
      setResult({
        gap_analysis: {
          overview: '基于您提供的信息，我们发现了以下差距：',
          compliance_rate: 75,
          total_requirements: 20,
          satisfied_requirements: 15,
          gap_requirements: 5,
          gaps: [
            {
              requirement: '数据备份策略',
              severity: 'HIGH',
              recommendation: '建议建立定期备份机制',
            },
            {
              requirement: '访问控制',
              severity: 'MEDIUM',
              recommendation: '建议实施基于角色的访问控制',
            },
          ],
        },
      })
      message.success('分析完成！')
    } catch (err: any) {
      message.error(err.message || '分析失败')
    } finally {
      setLoading(false)
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'HIGH':
        return 'error'
      case 'MEDIUM':
        return 'warning'
      case 'LOW':
        return 'info'
      default:
        return 'default'
    }
  }

  return (
    <main className="max-w-[1920px] mx-auto px-6 py-8">
      <header className="flex items-start justify-between mb-8">
        <div>
          <Typography variant="h4" component="h1" sx={{ mb: 1 }}>
            快速差距分析
          </Typography>
          <Typography variant="body2" color="text.secondary">
            输入您的现状描述，快速获取差距分析结果
          </Typography>
        </div>

        <Button startIcon={<ArrowBack />} onClick={() => router.back()}>
          返回
        </Button>
      </header>

      {!result ? (
        <Card>
          <CardContent>
            <TextField
              fullWidth
              multiline
              rows={10}
              placeholder="请描述您当前的IT安全现状，包括已实施的控制措施、流程和工具..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              sx={{ mb: 2 }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                startIcon={<Send />}
                onClick={handleSubmit}
                disabled={loading || !input.trim()}
              >
                {loading ? '分析中...' : '开始分析'}
              </Button>
            </Box>

            {loading && (
              <Box sx={{ mt: 3 }}>
                <LinearProgress />
                <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
                  正在分析您的现状...
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <Card sx={{ mb: 3 }}>
            <CardHeader title="分析结果概览" avatar={<BarChart />} />
            <CardContent>
              <Grid container spacing={3}>
                <Grid item xs={12} md={3}>
                  <Typography variant="body2" color="text.secondary">合规率</Typography>
                  <Typography variant="h4">{result.gap_analysis.compliance_rate}%</Typography>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Typography variant="body2" color="text.secondary">总要求数</Typography>
                  <Typography variant="h4">{result.gap_analysis.total_requirements}</Typography>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Typography variant="body2" color="text.secondary">已满足</Typography>
                  <Typography variant="h4" color="success.main">{result.gap_analysis.satisfied_requirements}</Typography>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Typography variant="body2" color="text.secondary">差距项</Typography>
                  <Typography variant="h4" color="error.main">{result.gap_analysis.gap_requirements}</Typography>
                </Grid>
              </Grid>

              <Box sx={{ mt: 3 }}>
                <Typography variant="body1">{result.gap_analysis.overview}</Typography>
              </Box>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="详细差距" />
            <CardContent>
              {result.gap_analysis.gaps.map((gap, index) => (
                <Box key={index} sx={{ mb: 3, pb: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography variant="h6">{gap.requirement}</Typography>
                    <Chip
                      label={gap.severity}
                      color={getSeverityColor(gap.severity) as any}
                      size="small"
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {gap.recommendation}
                  </Typography>
                </Box>
              ))}
            </CardContent>
          </Card>

          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Button variant="outlined" onClick={() => setResult(null)} sx={{ mr: 1 }}>
              重新分析
            </Button>
          </Box>
        </>
      )}
    </main>
  )
}
