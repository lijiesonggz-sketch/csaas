'use client'

/**
 * 聚类结果展示组件
 * 显示聚类树形结构、覆盖率统计和高风险条款
 */

import React, { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  ChevronDown,
  FileText,
  Network,
  AlertTriangle,
  CheckCircle,
  Bot,
  Copy,
  Download,
  ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { GenerationResult } from '@/lib/types/ai-generation'
import {
  calculateCoverageFromClauseIds,
  extractClauseIdsFromContent,
  normalizeCoverageSummary,
  type CoverageGranularity,
} from '@/lib/utils/clauseIds'
import MissingClausesHandler from './MissingClausesHandler'

interface StandardDocument {
  id: string
  name: string
  content: string
}

interface ClusterClause {
  source_document_id: string
  source_document_name: string
  clause_id: string
  clause_text: string
  rationale: string
}

interface Cluster {
  id: string
  name: string
  description: string
  clauses: ClusterClause[]
  importance: 'HIGH' | 'MEDIUM' | 'LOW'
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW'
}

interface Category {
  id: string
  name: string
  description: string
  clusters: Cluster[]
}

interface ClusteringResult {
  categories: Category[] // 第一层：大归类
  clustering_logic: string
  generation_mode?: 'structured' | 'ai'
  coverage_summary: {
    by_document: Record<
      string,
      {
        total_clauses: number
        clustered_clauses: number
        missing_clause_ids: string[]
        coverage_granularity?: CoverageGranularity
      }
    >
    overall: {
      total_clauses: number
      clustered_clauses: number
      coverage_rate: number
      coverage_granularity?: CoverageGranularity
    }
  }
}

interface Props {
  result: GenerationResult
  documents?: StandardDocument[] // 添加可选标记
}

function getDisplayModelName(model?: string): string {
  switch ((model || '').toLowerCase()) {
    case 'gpt4':
    case 'gpt-4':
      return 'DeepSeek'
    case 'claude':
      return 'Claude'
    case 'domestic':
    case 'tongyi':
      return '通义千问'
    default:
      return model || 'DeepSeek'
  }
}

function getCoverageGranularityLabel(granularity?: CoverageGranularity): string {
  switch (granularity) {
    case 'leaf_requirement':
      return '叶子要求项'
    case 'article':
      return '条款'
    case 'section':
      return '章节'
    case 'generated':
      return '聚类生成ID'
    default:
      return ''
  }
}

function getGenerationModeLabel(mode?: ClusteringResult['generation_mode']): string {
  switch (mode) {
    case 'structured':
      return '原始层级映射'
    case 'ai':
      return 'AI语义聚类'
    default:
      return ''
  }
}

export default function ClusteringResultDisplay({ result, documents = [] }: Props) {
  // 解析聚类结果 - 支持新旧两种数据格式
  const parsedResult = useMemo(() => {
    try {
      // 新格式：result.content 包含 JSON 字符串
      if (result.content) {
        return {
          clusteringResult:
            typeof result.content === 'string'
              ? (JSON.parse(result.content) as ClusteringResult)
              : (result.content as ClusteringResult),
          parseError: null,
        }
      }

      // 旧格式：result.selectedResult
      if (result.selectedResult) {
        return {
          clusteringResult:
            typeof result.selectedResult === 'string'
              ? (JSON.parse(result.selectedResult) as ClusteringResult)
              : (result.selectedResult as ClusteringResult),
          parseError: null,
        }
      }

      // 直接就是聚类结果
      return {
        clusteringResult: result as unknown as ClusteringResult,
        parseError: null,
      }
    } catch (error) {
      return {
        clusteringResult: null,
        parseError: error as Error,
      }
    }
  }, [result])

  const clusteringResult = parsedResult.clusteringResult
  const storedCoverage = useMemo(
    () => normalizeCoverageSummary(clusteringResult?.coverage_summary),
    [clusteringResult]
  )
  const initialCoverage = useMemo(() => {
    if (!clusteringResult) {
      return undefined
    }

    if (
      !clusteringResult.categories ||
      clusteringResult.generation_mode === 'structured' ||
      documents.length === 0
    ) {
      return storedCoverage
    }

    return recalculateCoverage(clusteringResult.categories, documents)
  }, [clusteringResult, documents, storedCoverage])
  const [categories, setCategories] = useState<Category[]>(() => clusteringResult?.categories ?? [])
  const [coverageSummary, setCoverageSummary] = useState(initialCoverage)

  useEffect(() => {
    if (!clusteringResult?.categories) {
      return
    }

    setCategories(clusteringResult.categories)
    setCoverageSummary(initialCoverage)
  }, [clusteringResult, initialCoverage])

  if (parsedResult.parseError) {
    const parseError = parsedResult.parseError
    console.error('Failed to parse clustering result:', parseError)
    return (
      <Alert className="border-[#FECACA] bg-[#FEF2F2]">
        <AlertTriangle className="h-4 w-4 text-[#DC2626]" />
        <AlertTitle className="text-[#991B1B]">数据解析失败</AlertTitle>
        <AlertDescription className="text-[#7F1D1D]">
          <p>无法解析聚类结果数据</p>
          <p>错误: {(parseError as Error).message}</p>
          <details className="mt-2">
            <summary>查看原始数据</summary>
            <pre className="max-h-[300px] overflow-auto mt-2 text-xs">
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </AlertDescription>
      </Alert>
    )
  }

  // 检查数据有效性
  if (!clusteringResult) {
    return (
      <Alert className="border-[#FECACA] bg-[#FEF2F2]">
        <AlertTriangle className="h-4 w-4 text-[#DC2626]" />
        <AlertTitle className="text-[#991B1B]">数据为空</AlertTitle>
        <AlertDescription className="text-[#7F1D1D]">聚类结果数据为空</AlertDescription>
      </Alert>
    )
  }

  if (!clusteringResult.categories) {
    console.warn('Missing categories in clustering result')
    return (
      <Alert className="border-[#FECACA] bg-[#FEF2F2]">
        <AlertTriangle className="h-4 w-4 text-[#DC2626]" />
        <AlertTitle className="text-[#991B1B]">数据格式错误</AlertTitle>
        <AlertDescription className="text-[#7F1D1D]">
          <p>聚类结果数据格式不正确，缺少 categories 字段</p>
          <p>可用字段: {Object.keys(clusteringResult).join(', ')}</p>
          <details className="mt-2">
            <summary>查看完整数据</summary>
            <pre className="max-h-[400px] overflow-auto mt-2 text-xs">
              {JSON.stringify(clusteringResult, null, 2)}
            </pre>
          </details>
        </AlertDescription>
      </Alert>
    )
  }

  const { clustering_logic } = clusteringResult

  // 风险级别颜色映射
  const getRiskColor = (level: string): string => {
    switch (level) {
      case 'HIGH':
        return 'bg-[#FECACA] text-[#991B1B] border-[#DC2626]'
      case 'MEDIUM':
        return 'bg-[#FEF3C7] text-[#92400E] border-[#F59E0B]'
      case 'LOW':
        return 'bg-[#D1FAE5] text-[#065F46] border-[#059669]'
      default:
        return 'bg-[#F3F4F6] text-[#64748B] border-[#E2E8F0]'
    }
  }

  // 重要性颜色映射
  const getImportanceColor = (level: string): string => {
    switch (level) {
      case 'HIGH':
        return 'bg-[#8B5CF6] text-white border-[#7C3AED]'
      case 'MEDIUM':
        return 'bg-[#1E3A5F] text-white border-[#0F2847]'
      case 'LOW':
        return 'bg-[#E2E8F0] text-[#64748B] border-[#CBD5E1]'
      default:
        return 'bg-[#F3F4F6] text-[#64748B] border-[#E2E8F0]'
    }
  }

  // 从三层结构中提取所有聚类
  const allClusters = categories.flatMap((cat) => cat.clusters)
  const totalClusters = allClusters.length

  // 统计高风险聚类
  const highRiskClusters = allClusters.filter((c) => c.risk_level === 'HIGH')

  // 复制任务ID到剪贴板
  const handleCopyTaskId = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(result.taskId)
      toast.success('任务ID已复制到剪贴板！')
    }
  }

  // 导出聚类结果为CSV
  const handleExportCSV = () => {
    try {
      const csvRows: string[] = []

      // CSV Header
      csvRows.push(
        'Category ID,Category Name,Cluster ID,Cluster Name,Importance,Risk Level,Clause ID,Source Document,Clause Text,Rationale'
      )

      // 遍历三层结构导出数据
      categories.forEach((category) => {
        category.clusters.forEach((cluster) => {
          cluster.clauses.forEach((clause) => {
            const row = [
              category.id,
              category.name,
              cluster.id,
              cluster.name,
              cluster.importance,
              cluster.risk_level,
              clause.clause_id,
              clause.source_document_name,
              `"${clause.clause_text.replace(/"/g, '""')}"`, // 转义双引号
              `"${clause.rationale.replace(/"/g, '""')}"`,
            ]
            csvRows.push(row.join(','))
          })
        })
      })

      // 创建下载
      const csvContent = csvRows.join('\n')
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `clustering_result_${result.taskId}.csv`
      link.click()
      URL.revokeObjectURL(url)

      toast.success('聚类结果已导出为CSV文件！')
    } catch (error) {
      toast.error('导出失败：' + (error instanceof Error ? error.message : '未知错误'))
    }
  }

  // 跳转到矩阵生成页面
  const handleGenerateMatrix = async () => {
    // 直接使用 result.taskId
    let effectiveTaskId = result.taskId
    let projectId = result.projectId

    // 如果taskId缺失，强制从API刷新数据
    if (!effectiveTaskId) {
      try {
        // 从result.content解析聚类任务ID
        let clusteringTaskId: string | null = null

        if (result.content) {
          // 尝试从content中提取taskId
          const contentData =
            typeof result.content === 'string' ? JSON.parse(result.content) : result.content

          // 尝试从多个可能的字段获取taskId
          clusteringTaskId =
            contentData.taskId || result.id || result.taskId || (result as any).clusteringTaskId
        } else {
          // 如果没有content，直接使用result.id
          clusteringTaskId = result.id || result.taskId
        }

        if (clusteringTaskId) {
          // 强制从API获取最新数据
          const response = await fetch(`/api/ai-generation/result/${clusteringTaskId}`)
          const data = await response.json()

          if (data.success && data.data) {
            effectiveTaskId = data.data.taskId
            projectId = data.data.projectId
          }
        }
      } catch (error) {
        console.error('Failed to refresh data from API:', error)
      }
    }

    if (!effectiveTaskId) {
      toast.error('错误：无法获取任务ID，请刷新页面重试')
      return
    }

    // 如果有projectId，跳转到新的项目工作台页面
    if (projectId) {
      window.location.href = `/projects/${projectId}/matrix?clusteringTaskId=${effectiveTaskId}`
    } else {
      // 否则跳转到旧的独立页面
      window.location.href = `/ai-generation/matrix?taskId=${effectiveTaskId}`
    }
  }

  // 处理聚类更新（当用户添加缺失条款时）
  const handleUpdateClustering = (updatedCategories: Category[]) => {
    setCategories(updatedCategories)

    // 重新计算覆盖率摘要
    const newCoverageSummary = recalculateCoverage(updatedCategories, documents)
    setCoverageSummary(newCoverageSummary)
  }

  // 重新计算覆盖率
  function recalculateCoverage(
    cats: Category[],
    docs: StandardDocument[]
  ): ClusteringResult['coverage_summary'] {
    const byDocument: Record<string, any> = {}

    docs.forEach((doc) => {
      // 从聚类中提取该文档的所有条款
      const docClauses = cats
        .flatMap((cat) => cat.clusters || [])
        .flatMap((cluster) => cluster.clauses || [])
        .filter((clause: any) => clause.source_document_id === doc.id)

      const allClauseIds = extractClauseIdsFromContent(doc.content)

      // 统计唯一提取的条款（从聚类中）
      const uniqueClusteredIds = new Set<string>()
      docClauses.forEach((clause: any) => {
        uniqueClusteredIds.add(clause.clause_id)
      })

      const coverage = calculateCoverageFromClauseIds(allClauseIds, Array.from(uniqueClusteredIds))

      byDocument[doc.id] = {
        total_clauses: coverage.total_clauses,
        clustered_clauses: coverage.clustered_clauses,
        missing_clause_ids: coverage.missing_clause_ids,
        coverage_granularity: coverage.coverage_granularity,
      }
    })

    const totalClauses = Object.values(byDocument).reduce(
      (sum: number, doc: any) => sum + doc.total_clauses,
      0
    )
    const clusteredClauses = Object.values(byDocument).reduce(
      (sum: number, doc: any) => sum + doc.clustered_clauses,
      0
    )
    const coverageGranularities = Array.from(
      new Set(
        Object.values(byDocument)
          .map((coverage: any) => coverage.coverage_granularity as CoverageGranularity | undefined)
          .filter(Boolean)
      )
    )

    return {
      by_document: byDocument,
      overall: {
        total_clauses: totalClauses,
        clustered_clauses: clusteredClauses,
        coverage_rate: totalClauses > 0 ? clusteredClauses / totalClauses : 0,
        coverage_granularity:
          coverageGranularities.length === 1 ? coverageGranularities[0] : undefined,
      },
    }
  }

  const coverageRate = coverageSummary?.overall?.coverage_rate
    ? coverageSummary.overall.coverage_rate * 100
    : 0
  const coverageGranularityLabel = getCoverageGranularityLabel(
    coverageSummary?.overall?.coverage_granularity
  )
  const generationModeLabel = getGenerationModeLabel(clusteringResult.generation_mode)

  return (
    <div className="flex flex-col gap-6">
      {/* 任务ID显示（重要：用于下一步矩阵生成） */}
      <Alert className="border-[#BBF7D0] bg-[#F0FDF4]">
        <CheckCircle className="h-4 w-4 text-[#059669]" />
        <AlertTitle className="text-[#065F46]">聚类任务完成！下一步：生成成熟度矩阵</AlertTitle>
        <AlertDescription className="text-[#065F46]">
          <div className="flex flex-col gap-3 mt-3">
            <p className="text-sm">任务ID：</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-[#E5E7EB] px-3 py-2 rounded-sm font-mono text-sm select-all">
                {result.taskId}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyTaskId}
                className="border-[#E2E8F0] text-[#64748B]"
              >
                <Copy className="h-4 w-4 mr-2" />
                复制ID
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleGenerateMatrix}
                className="flex-1 bg-[#1E3A5F] hover:bg-[#0F2847] text-white"
              >
                生成成熟度矩阵
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <Button
                onClick={handleExportCSV}
                className="bg-[#059669] hover:bg-[#047857] text-white"
              >
                <Download className="h-4 w-4 mr-2" />
                导出CSV
              </Button>
            </div>
          </div>
        </AlertDescription>
      </Alert>

      {/* 基本信息 */}
      <Card className="border-[#E2E8F0]">
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            <div className="text-center">
              <FileText className="h-6 w-6 mx-auto mb-2 text-[#64748B]" />
              <p className="text-2xl font-semibold text-[#1E3A5F]">{categories.length}</p>
              <p className="text-sm text-[#64748B]">大类数量</p>
            </div>
            <div className="text-center">
              <Network className="h-6 w-6 mx-auto mb-2 text-[#64748B]" />
              <p className="text-2xl font-semibold text-[#1E3A5F]">{totalClusters}</p>
              <p className="text-sm text-[#64748B]">聚类数量</p>
            </div>
            <div className="text-center">
              <CheckCircle
                className={cn(
                  'h-6 w-6 mx-auto mb-2',
                  coverageRate >= 95 ? 'text-[#059669]' : 'text-[#F59E0B]'
                )}
              />
              <p
                className={cn(
                  'text-2xl font-semibold',
                  coverageRate >= 95 ? 'text-[#059669]' : 'text-[#F59E0B]'
                )}
              >
                {coverageRate.toFixed(1)}%
              </p>
              <p className="text-sm text-[#64748B]">覆盖率</p>
            </div>
            <div className="text-center">
              <AlertTriangle className="h-6 w-6 mx-auto mb-2 text-[#DC2626]" />
              <p className="text-2xl font-semibold text-[#DC2626]">{highRiskClusters.length}</p>
              <p className="text-sm text-[#64748B]">高风险聚类</p>
            </div>
            <div className="text-center">
              <Bot className="h-6 w-6 mx-auto mb-2 text-[#64748B]" />
              <p className="text-2xl font-semibold text-[#1E3A5F]">
                {getDisplayModelName((result as any).selectedModel)}
              </p>
              <p className="text-sm text-[#64748B]">AI模型</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 质量分数 - 仅在存在时显示 */}
      {result.qualityScores && (
        <Card className="border-[#E2E8F0]">
          <CardHeader>
            <CardTitle className="text-lg">质量评分</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center">
                <p className="text-sm text-[#64748B] mb-2">结构一致性</p>
                <div className="relative inline-flex mt-2">
                  <svg className="h-20 w-20 transform -rotate-90">
                    <circle
                      cx="40"
                      cy="40"
                      r="36"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      className="text-[#E5E7EB]"
                    />
                    <circle
                      cx="40"
                      cy="40"
                      r="36"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray={`${result.qualityScores.structural * 100 * 2.26} 226`}
                      className="text-[#059669]"
                      style={{ strokeDashoffset: 0 }}
                    />
                  </svg>
                  <span className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-xs font-bold text-[#1E3A5F]">
                    {(result.qualityScores.structural * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm text-[#64748B] mb-2">语义一致性</p>
                <div className="relative inline-flex mt-2">
                  <svg className="h-20 w-20 transform -rotate-90">
                    <circle
                      cx="40"
                      cy="40"
                      r="36"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      className="text-[#E5E7EB]"
                    />
                    <circle
                      cx="40"
                      cy="40"
                      r="36"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray={`${result.qualityScores.semantic * 100 * 2.26} 226`}
                      className="text-[#1E3A5F]"
                      style={{ strokeDashoffset: 0 }}
                    />
                  </svg>
                  <span className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-xs font-bold text-[#1E3A5F]">
                    {(result.qualityScores.semantic * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm text-[#64748B] mb-2">细节一致性</p>
                <div className="relative inline-flex mt-2">
                  <svg className="h-20 w-20 transform -rotate-90">
                    <circle
                      cx="40"
                      cy="40"
                      r="36"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      className="text-[#E5E7EB]"
                    />
                    <circle
                      cx="40"
                      cy="40"
                      r="36"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray={`${result.qualityScores.detail * 100 * 2.26} 226`}
                      className="text-[#8B5CF6]"
                      style={{ strokeDashoffset: 0 }}
                    />
                  </svg>
                  <span className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-xs font-bold text-[#1E3A5F]">
                    {(result.qualityScores.detail * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 覆盖率统计 */}
      <Card className="border-[#E2E8F0]">
        <CardHeader>
          <CardTitle className="text-lg">覆盖率统计</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-col gap-4">
            {/* 总体覆盖率 */}
            <div>
              <p className="text-sm font-semibold text-[#1E3A5F] mb-2">总体覆盖率</p>
              <Progress
                value={coverageRate}
                className={cn('h-2.5', coverageRate >= 95 ? 'bg-[#059669]' : 'bg-[#1E3A5F]')}
              />
              <p className="text-xs text-[#64748B] mt-1">
                {coverageRate.toFixed(1)}% ({coverageSummary?.overall?.clustered_clauses || 0}/
                {coverageSummary?.overall?.total_clauses || 0})
              </p>
              {coverageGranularityLabel && (
                <p className="text-xs text-[#64748B] mt-1">覆盖粒度：{coverageGranularityLabel}</p>
              )}
              {generationModeLabel && (
                <p className="text-xs text-[#64748B] mt-1">生成方式：{generationModeLabel}</p>
              )}
            </div>

            {/* 按文档覆盖率 */}
            <div>
              <p className="text-sm font-semibold text-[#1E3A5F] mb-2">各文档覆盖率</p>
              {coverageSummary?.by_document &&
                Object.entries(coverageSummary.by_document).map(([docId, stats]) => {
                  const doc = documents.find((d) => d.id === docId)
                  const docCoverageRate =
                    stats.total_clauses > 0
                      ? (stats.clustered_clauses / stats.total_clauses) * 100
                      : 0

                  return (
                    <div key={docId} className="mb-3">
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-sm font-medium text-[#1E3A5F]">{doc?.name || docId}</p>
                        <p className="text-xs text-[#64748B]">
                          {stats.clustered_clauses}/{stats.total_clauses}
                        </p>
                      </div>
                      <Progress
                        value={docCoverageRate}
                        className={cn(
                          'h-1.5',
                          docCoverageRate >= 95 ? 'bg-[#059669]' : 'bg-[#1E3A5F]'
                        )}
                      />
                      {stats.missing_clause_ids?.length > 0 && (
                        <p className="text-xs text-[#DC2626] mt-1">
                          遗漏条款: {stats.missing_clause_ids.join(', ')}
                        </p>
                      )}
                    </div>
                  )
                })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 聚类逻辑说明 */}
      <Card className="border-[#E2E8F0]">
        <CardHeader>
          <CardTitle className="text-lg">聚类逻辑</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-sm whitespace-pre-wrap text-[#64748B]">{clustering_logic}</p>
        </CardContent>
      </Card>

      {/* 聚类详情（三层结构展示）*/}
      <Card className="border-[#E2E8F0]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>聚类详情（三层结构）</span>
            <Badge className="bg-[#8B5CF6] text-white">{categories.length}个大类</Badge>
            <Badge className="bg-[#1E3A5F] text-white">{totalClusters}个聚类</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <Accordion type="multiple" defaultValue={[Object.keys(categories)[0]]}>
            {categories.map((category, categoryIndex) => (
              <AccordionItem key={category.id} value={category.id}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3 w-full pr-4">
                    <Badge className="bg-[#8B5CF6] text-white">{categoryIndex + 1}</Badge>
                    <span className="font-semibold text-[#1E3A5F]">{category.name}</span>
                    <Badge className="bg-[#8B5CF6] text-white">大类</Badge>
                    <div className="flex-1" />
                    <Badge className="bg-[#1E3A5F] text-white">
                      {category.clusters.length}个聚类
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="flex flex-col gap-4">
                    {/* 大类描述 */}
                    <Alert className="border-[#BFDBFE] bg-[#EFF6FF]">
                      <AlertDescription className="text-[#1E3A5F]">
                        <p className="font-semibold text-sm">大类描述</p>
                        <p className="text-sm">{category.description}</p>
                      </AlertDescription>
                    </Alert>

                    {/* 该大类下的所有聚类 */}
                    {category.clusters.map((cluster, clusterIndex) => (
                      <Accordion key={cluster.id} type="single">
                        <AccordionItem value={cluster.id}>
                          <AccordionTrigger>
                            <div className="flex items-center gap-3 w-full pr-4">
                              <Badge className="bg-[#059669] text-white">{clusterIndex + 1}</Badge>
                              <span className="font-semibold text-[#1E3A5F]">{cluster.name}</span>
                              <Badge className={getImportanceColor(cluster.importance)}>
                                {cluster.importance}
                              </Badge>
                              <Badge className={getRiskColor(cluster.risk_level)}>
                                {cluster.risk_level === 'HIGH' && (
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                )}
                                {`风险: ${cluster.risk_level}`}
                              </Badge>
                              <div className="flex-1" />
                              <Badge className="bg-[#E2E8F0] text-[#64748B]">
                                {cluster.clauses.length}个条款
                              </Badge>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="flex flex-col gap-4">
                              {/* 聚类描述 */}
                              <Alert className="border-[#D1FAE5] bg-[#FEFDFB]">
                                <AlertDescription className="text-[#065F46]">
                                  <p className="font-semibold text-sm">聚类描述</p>
                                  <p className="text-sm">{cluster.description}</p>
                                </AlertDescription>
                              </Alert>

                              {/* 条款列表 */}
                              <div>
                                <p className="text-sm font-semibold text-[#1E3A5F] mb-3">
                                  包含条款：
                                </p>
                                <div className="space-y-3">
                                  {cluster.clauses.map((clause) => (
                                    <Card
                                      key={`${clause.source_document_id}-${clause.clause_id}`}
                                      className={cn(
                                        'border',
                                        cluster.risk_level === 'HIGH'
                                          ? 'border-[#DC2626] bg-[#FEF2F2]'
                                          : cluster.risk_level === 'MEDIUM'
                                            ? 'border-[#F59E0B] bg-[#FFFBEB]'
                                            : 'border-[#E2E8F0] bg-white'
                                      )}
                                    >
                                      <CardContent className="p-4">
                                        <div className="space-y-3">
                                          {/* 条款头部 */}
                                          <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-2">
                                              <Badge className="bg-[#1E3A5F] text-white">
                                                {clause.source_document_name}
                                              </Badge>
                                              <span className="font-mono font-bold text-sm">
                                                {clause.clause_id}
                                              </span>
                                            </div>
                                            {cluster.risk_level === 'HIGH' && (
                                              <Badge className="bg-[#DC2626] text-white">
                                                <AlertTriangle className="h-3 w-3 mr-1" />
                                                高风险
                                              </Badge>
                                            )}
                                          </div>

                                          {/* 条款内容 */}
                                          <p className="text-sm text-[#64748B]">
                                            {clause.clause_text}
                                          </p>

                                          {/* 归类理由 */}
                                          <div className="bg-[#F3F4F6] p-3 rounded-sm">
                                            <p className="text-xs text-[#64748B]">
                                              <strong>归类理由：</strong>
                                              {clause.rationale}
                                            </p>
                                          </div>
                                        </div>
                                      </CardContent>
                                    </Card>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      {/* 高风险提醒 */}
      {highRiskClusters.length > 0 && (
        <Alert className="border-[#FEF3C7] bg-[#FFFBEB]">
          <AlertTriangle className="h-4 w-4 text-[#F59E0B]" />
          <AlertTitle className="text-[#92400E]">高风险提醒</AlertTitle>
          <AlertDescription className="text-[#78716C]">
            检测到 {highRiskClusters.length} 个高风险聚类，建议优先审查：
            {highRiskClusters.map((c) => c.name).join('、')}
          </AlertDescription>
        </Alert>
      )}

      {/* 缺失条款处理 */}
      {documents && documents.length > 0 && coverageSummary?.by_document && (
        <MissingClausesHandler
          taskId={result.taskId}
          coverageByDocument={coverageSummary.by_document}
          documents={documents}
          categories={categories}
          onUpdateClustering={handleUpdateClustering}
        />
      )}
    </div>
  )
}
