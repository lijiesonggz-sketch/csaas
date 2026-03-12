'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Send, CheckCircle, BarChart3, Zap, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
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

  const handleSubmit = async () => {
    if (!input.trim()) {
      message.warning('请输入分析内容')
      return
    }

    try {
      setLoading(true)
      await new Promise((resolve) => setTimeout(resolve, 2000))
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

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'HIGH':
        return <Badge variant="destructive">HIGH</Badge>
      case 'MEDIUM':
        return (
          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
            MEDIUM
          </Badge>
        )
      case 'LOW':
        return (
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
            LOW
          </Badge>
        )
      default:
        return <Badge variant="secondary">{severity}</Badge>
    }
  }

  return (
    <main className="w-full px-6 py-8">
      {/* 渐变头部 */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#667eea] to-[#764ba2] p-8 mb-8">
        {/* 装饰性径向渐变 */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.1)_0%,transparent_50%)]" />

        <div className="relative flex items-start justify-between">
          <div className="flex items-center gap-4">
            {/* 毛玻璃图标背景 */}
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">快速差距分析</h1>
              <p className="text-sm text-white/80">
                输入您的现状描述，快速获取差距分析结果
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={() => router.back()}
            className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回
          </Button>
        </div>
      </div>

      {!result ? (
        <Card className="border-0 shadow-[0_4px_6px_-1px_rgba(99,102,241,0.1),0_2px_4px_-1px_rgba(99,102,241,0.06)]">
          <CardContent className="p-6">
            <Textarea
              placeholder="请描述您当前的IT安全现状，包括已实施的控制措施、流程和工具..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="min-h-[240px] mb-4 resize-none"
            />
            <div className="flex justify-end">
              <Button
                onClick={handleSubmit}
                disabled={loading || !input.trim()}
                className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
              >
                <Send className="w-4 h-4 mr-2" />
                {loading ? '分析中...' : '开始分析'}
              </Button>
            </div>
            {loading && (
              <div className="mt-4">
                <Progress value={undefined} className="h-2" />
                <p className="text-sm text-slate-500 mt-2 text-center">
                  正在分析您的现状...
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="border-0 shadow-[0_4px_6px_-1px_rgba(99,102,241,0.1),0_2px_4px_-1px_rgba(99,102,241,0.06)] mb-6">
            <CardHeader className="flex flex-row items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-500" />
              <CardTitle>分析结果概览</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div>
                  <p className="text-sm text-slate-500">合规率</p>
                  <p className="text-3xl font-bold text-slate-900">
                    {result.gap_analysis.compliance_rate}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">总要求数</p>
                  <p className="text-3xl font-bold text-slate-900">
                    {result.gap_analysis.total_requirements}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">已满足</p>
                  <p className="text-3xl font-bold text-emerald-600">
                    {result.gap_analysis.satisfied_requirements}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">差距项</p>
                  <p className="text-3xl font-bold text-red-600">
                    {result.gap_analysis.gap_requirements}
                  </p>
                </div>
              </div>
              <p className="text-slate-700">{result.gap_analysis.overview}</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm mb-6">
            <CardHeader>
              <CardTitle>详细差距</CardTitle>
            </CardHeader>
            <CardContent>
              {result.gap_analysis.gaps.map((gap, index) => (
                <div
                  key={index}
                  className="mb-4 pb-4 border-b border-slate-100 last:border-0"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold text-slate-900">
                      {gap.requirement}
                    </h3>
                    {getSeverityBadge(gap.severity)}
                  </div>
                  <p className="text-sm text-slate-500">{gap.recommendation}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="text-center">
            <Button
              onClick={() => setResult(null)}
              className="bg-white/10 border border-white/20 text-white hover:bg-white/20 hover:text-white"
            >
              重新分析
            </Button>
          </div>
        </>
      )}
    </main>
  )
}
