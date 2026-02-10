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
  LinearProgress,
  Chip,
  Tabs,
  Tab,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material'
import {
  ArrowBack,
  Book,
  Search,
  ExpandMore,
} from '@mui/icons-material'
import { message } from '@/lib/message'

interface InterpretationResult {
  standard: string
  clauses: Array<{
    id: string
    title: string
    content: string
    interpretation: string
  }>
}

export default function StandardInterpretationPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId as string

  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<InterpretationResult | null>(null)
  const [activeTab, setActiveTab] = useState(0)

  const handleAnalyze = async () => {
    try {
      setLoading(true)
      // TODO: Implement actual API call
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Mock result
      setResult({
        standard: 'ISO 27001',
        clauses: [
          {
            id: 'A.5.1',
            title: '信息安全策略',
            content: '应建立信息安全策略...',
            interpretation: '组织应制定明确的信息安全策略...',
          },
          {
            id: 'A.6.1',
            title: '内部组织',
            content: '应建立信息安全管理框架...',
            interpretation: '组织应建立适当的管理框架...',
          },
        ],
      })
      message.success('分析完成！')
    } catch (err: any) {
      message.error(err.message || '分析失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="max-w-[1920px] mx-auto px-6 py-8">
      <header className="flex items-start justify-between mb-8">
        <div>
          <Typography variant="h4" component="h1" sx={{ mb: 1 }}>
            标准解读
          </Typography>
          <Typography variant="body2" color="text.secondary">
            上传标准文档，获取AI智能解读
          </Typography>
        </div>

        <Button startIcon={<ArrowBack />} onClick={() => router.back()}>
          返回
        </Button>
      </header>

      {!result ? (
        <Card>
          <CardContent>
            <Box
              sx={{
                border: '2px dashed',
                borderColor: 'divider',
                borderRadius: 2,
                p: 6,
                textAlign: 'center',
              }}
            >
              <Button
                variant="contained"
                startIcon={<Book />}
                onClick={handleAnalyze}
                disabled={loading}
              >
                {loading ? '分析中...' : '开始解读'}
              </Button>

              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                点击开始解读标准文档
              </Typography>

              {loading && (
                <Box sx={{ mt: 3 }}>
                  <LinearProgress />
                  <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
                    正在解读标准文档...
                  </Typography>
                </Box>
              )}
            </Box>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card sx={{ mb: 3 }}>
            <CardHeader title={`标准解读 - ${result.standard}`} avatar={<Book />} />
            <CardContent>
              {result.clauses.map((clause, index) => (
                <Accordion key={clause.id}>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip label={clause.id} size="small" color="primary" />
                      <Typography fontWeight="bold">{clause.title}</Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>条款内容</Typography>
                      <Typography variant="body2">{clause.content}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>AI解读</Typography>
                      <Typography variant="body2" color="text.secondary">{clause.interpretation}</Typography>
                    </Box>
                  </AccordionDetails>
                </Accordion>
              ))}
            </CardContent>
          </Card>

          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Button variant="outlined" onClick={() => setResult(null)}>
              重新解读
            </Button>
          </Box>
        </>
      )}
    </main>
  )
}
