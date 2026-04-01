'use client'

/**
 * 判断题差距分析结果展示组件
 * 展示基于判断题问卷的差距分析结果
 */

import { useState } from 'react'
import { CheckCircle, AlertTriangle, TrendingUp, Lightbulb, Rocket, BarChart3, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'

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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH':
        return 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700'
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700'
      case 'LOW':
        return 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600'
    }
  }

  const getPriorityTag = (priority: string) => {
    const labels: Record<string, string> = {
      HIGH: '高优先级',
      MEDIUM: '中优先级',
      LOW: '低优先级',
    }
    return (
      <Badge className={getPriorityColor(priority)} variant="outline">
        {labels[priority] || priority}
      </Badge>
    )
  }

  const getComplianceRateColor = (rate: number) => {
    if (rate >= 0.8) return 'text-green-600'
    if (rate >= 0.6) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <div className="space-y-6">
      {/* 总体统计 */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">合规率</p>
              <p className={`text-3xl font-bold flex items-center gap-1 ${getComplianceRateColor(result.compliance_rate)}`}>
                <BarChart3 className="w-6 h-6" />
                {(result.compliance_rate * 100).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">总条款</p>
              <p className="text-3xl font-bold">
                {result.total_clauses} <span className="text-sm">项</span>
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">已满足</p>
              <p className="text-3xl font-bold text-green-600 flex items-center gap-1">
                <CheckCircle className="w-6 h-6" />
                {result.satisfied_clauses} <span className="text-sm">项</span>
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">差距条款</p>
              <p className="text-3xl font-bold text-red-600 flex items-center gap-1">
                <AlertTriangle className="w-6 h-6" />
                {result.gap_clauses} <span className="text-sm">项</span>
              </p>
            </div>
          </div>

          {result.summary.overview && (
            <>
              <div className="my-4 border-t border-gray-200 dark:border-gray-700" />
              <Alert>
                <AlertDescription>{result.summary.overview}</AlertDescription>
              </Alert>
            </>
          )}
        </CardContent>
      </Card>

      {/* 差距聚类汇总 */}
      {result.gap_clusters.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-4">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="text-lg font-semibold">差距聚类汇总</h3>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {result.gap_clusters.map((cluster) => (
                <Card key={cluster.cluster_id} className="h-full border-2">
                  <CardContent className="p-4">
                    <p className="text-base mb-2">{cluster.cluster_name}</p>
                    <p className={`text-3xl font-bold ${
                      cluster.gap_rate >= 0.5 ? 'text-red-600' :
                      cluster.gap_rate >= 0.3 ? 'text-yellow-600' :
                      'text-green-600'
                    }`}>
                      {(cluster.gap_rate * 100).toFixed(1)}%
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {cluster.gap_clauses} / {cluster.total_clauses} 条款未满足
                    </p>
                    <div className="mt-2">{getPriorityTag(cluster.priority)}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {result.summary.top_gap_clusters && result.summary.top_gap_clusters.length > 0 && (
              <>
                <div className="my-4 border-t border-gray-200 dark:border-gray-700" />
                <Alert variant="destructive">
                  <p className="text-sm font-medium mb-2">差距最严重的聚类</p>
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
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-lg font-semibold">差距详情</h3>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowAllGaps(!showAllGaps)}
            >
              {showAllGaps ? '收起' : `查看全部 (${result.gap_details.length})`}
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {displayedGaps.map((item, idx) => (
                <div
                  key={idx}
                  className="flex flex-col items-start p-4 border-b border-gray-200 dark:border-gray-700 last:border-0"
                >
                  <div className="flex flex-wrap gap-2 mb-2">
                    <Badge variant="outline">{item.cluster_name}</Badge>
                    <Badge variant="outline">{item.clause_id}</Badge>
                    {getPriorityTag(item.priority)}
                  </div>
                  <div className="w-full space-y-2">
                    <p className="text-sm"><strong>条款要求：</strong> {item.clause_text}</p>
                    <p className="text-sm"><strong>问题：</strong> {item.question_text}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm"><strong>用户回答：</strong>{' '}</span>
                      <Badge className={item.user_answer ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}>
                        {item.user_answer ? '有' : '没有'}
                      </Badge>
                      {item.gap && (
                        <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 ml-1">
                          存在差距
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 无差距情况 */}
      {result.gap_details.length === 0 && (
        <Alert className="bg-green-50 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
          恭喜！未发现明显差距 - 您的组织现状已基本满足标准要求。
        </Alert>
      )}

      {/* 改进建议 */}
      {result.summary.recommendations && result.summary.recommendations.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-4">
            <Lightbulb className="w-5 h-5" />
            <h3 className="text-lg font-semibold">改进建议</h3>
          </CardHeader>
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
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="flex flex-col items-center gap-6">
                <div className="text-center">
                  <TrendingUp className="w-12 h-12 text-blue-600 mx-auto mb-2" />
                  <h3 className="text-lg font-semibold">需要改进措施吗？</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    基于以上差距分析，AI可以为您生成针对性的改进措施
                  </p>
                </div>
                <Button
                  size="lg"
                  onClick={onGenerateActionPlan}
                  disabled={loading}
                  className="min-w-[160px]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <TrendingUp className="w-4 h-4 mr-2" />
                      生成改进措施
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
