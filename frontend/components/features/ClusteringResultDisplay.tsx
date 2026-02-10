'use client'

/**
 * 聚类结果展示组件
 * 显示聚类树形结构、覆盖率统计和高风险条款
 */

import React, { useState } from 'react'
import { toast } from 'sonner'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Chip from '@mui/material/Chip'
import LinearProgress from '@mui/material/LinearProgress'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import Grid from '@mui/material/Grid'
import Button from '@mui/material/Button'
import Badge from '@mui/material/Badge'
import Stack from '@mui/material/Stack'
import WarningIcon from '@mui/icons-material/Warning'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ClusterIcon from '@mui/icons-material/AccountTree'
import FileTextIcon from '@mui/icons-material/Description'
import RobotIcon from '@mui/icons-material/SmartToy'
import CircularProgress from '@mui/material/CircularProgress'
import type { GenerationResult } from '@/lib/types/ai-generation'
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
  coverage_summary: {
    by_document: Record<
      string,
      {
        total_clauses: number
        clustered_clauses: number
        missing_clause_ids: string[]
      }
    >
    overall: {
      total_clauses: number
      clustered_clauses: number
      coverage_rate: number
    }
  }
}

interface Props {
  result: GenerationResult
  documents?: StandardDocument[] // 添加可选标记
}

export default function ClusteringResultDisplay({ result, documents = [] }: Props) {
  // 解析聚类结果 - 支持新旧两种数据格式
  let clusteringResult: ClusteringResult

  try {
    // 新格式：result.content 包含 JSON 字符串
    if (result.content) {
      if (typeof result.content === 'string') {
        clusteringResult = JSON.parse(result.content) as ClusteringResult
      } else {
        clusteringResult = result.content as ClusteringResult
      }
    }
    // 旧格式：result.selectedResult
    else if (result.selectedResult) {
      if (typeof result.selectedResult === 'string') {
        clusteringResult = JSON.parse(result.selectedResult) as ClusteringResult
      } else {
        clusteringResult = result.selectedResult as ClusteringResult
      }
    }
    // 直接就是聚类结果
    else {
      clusteringResult = result as unknown as ClusteringResult
    }
  } catch (parseError) {
    console.error('Failed to parse clustering result:', parseError)
    return (
      <Alert severity="error">
        <Typography variant="subtitle1" fontWeight="bold">数据解析失败</Typography>
        <Typography variant="body2">无法解析聚类结果数据</Typography>
        <Typography variant="body2">错误: {(parseError as Error).message}</Typography>
        <details>
          <summary>查看原始数据</summary>
          <pre style={{ maxHeight: '300px', overflow: 'auto' }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </details>
      </Alert>
    )
  }

  // 检查数据有效性
  if (!clusteringResult) {
    return (
      <Alert severity="error">
        <Typography variant="subtitle1" fontWeight="bold">数据为空</Typography>
        <Typography variant="body2">聚类结果数据为空</Typography>
      </Alert>
    )
  }

  if (!clusteringResult.categories) {
    console.warn('Missing categories in clustering result')
    return (
      <Alert severity="error">
        <Typography variant="subtitle1" fontWeight="bold">数据格式错误</Typography>
        <Typography variant="body2">聚类结果数据格式不正确，缺少 categories 字段</Typography>
        <Typography variant="body2">可用字段: {Object.keys(clusteringResult).join(', ')}</Typography>
        <details>
          <summary>查看完整数据</summary>
          <pre style={{ maxHeight: '400px', overflow: 'auto' }}>
            {JSON.stringify(clusteringResult, null, 2)}
          </pre>
        </details>
      </Alert>
    )
  }

  const { clustering_logic, coverage_summary: initialCoverage } = clusteringResult
  const [categories, setCategories] = useState<Category[]>(clusteringResult.categories)
  const [coverageSummary, setCoverageSummary] = useState(initialCoverage)

  // 风险级别颜色映射
  const riskColorMap = {
    HIGH: 'error' as const,
    MEDIUM: 'warning' as const,
    LOW: 'success' as const,
  }

  // 重要性颜色映射
  const importanceColorMap = {
    HIGH: 'secondary' as const,
    MEDIUM: 'primary' as const,
    LOW: 'default' as const,
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
      csvRows.push('Category ID,Category Name,Cluster ID,Cluster Name,Importance,Risk Level,Clause ID,Source Document,Clause Text,Rationale')

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
          const contentData = typeof result.content === 'string'
            ? JSON.parse(result.content)
            : result.content

          // 尝试从多个可能的字段获取taskId
          clusteringTaskId = contentData.taskId || result.id || result.taskId || (result as any).clusteringTaskId
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
  const recalculateCoverage = (
    cats: Category[],
    docs: StandardDocument[],
  ): ClusteringResult['coverage_summary'] => {
    const byDocument: Record<string, any> = {}

    docs.forEach((doc) => {
      // 从聚类中提取该文档的所有条款
      const docClauses = cats
        .flatMap((cat) => cat.clusters || [])
        .flatMap((cluster) => cluster.clauses || [])
        .filter((clause: any) => clause.source_document_id === doc.id)

      // 统计文档实际条款数（去重）
      const allClauseMatches = doc.content.match(/第[一二三四五六七八九十百千]+条/g) || []
      const allClauseIds = Array.from(new Set(allClauseMatches)) // 去重
      const actualClauseCount = allClauseIds.length

      // 统计唯一提取的条款（从聚类中）
      const uniqueClusteredIds = new Set<string>()
      docClauses.forEach((clause: any) => {
        uniqueClusteredIds.add(clause.clause_id)
      })

      // 过滤掉AI生成的、文档中不存在的条款
      const validClusteredIds = Array.from(uniqueClusteredIds).filter(id =>
        allClauseIds.includes(id)
      )
      const finalClusteredCount = validClusteredIds.length

      // 找出缺失的条款
      const missingClauseIds = allClauseIds.filter((id) => !uniqueClusteredIds.has(id))

      byDocument[doc.id] = {
        total_clauses: actualClauseCount,
        clustered_clauses: finalClusteredCount,
        missing_clause_ids: missingClauseIds,
      }
    })

    const totalClauses = Object.values(byDocument).reduce((sum: number, doc: any) => sum + doc.total_clauses, 0)
    const clusteredClauses = Object.values(byDocument).reduce((sum: number, doc: any) => sum + doc.clustered_clauses, 0)

    return {
      by_document: byDocument,
      overall: {
        total_clauses: totalClauses,
        clustered_clauses: clusteredClauses,
        coverage_rate: totalClauses > 0 ? clusteredClauses / totalClauses : 0,
      },
    }
  }

  const coverageRate = coverageSummary?.overall?.coverage_rate ? (coverageSummary.overall.coverage_rate * 100) : 0

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* 任务ID显示（重要：用于下一步矩阵生成） */}
      <Alert severity="success" icon={<CheckCircleIcon />}>
        <Typography variant="subtitle1" fontWeight="bold">
          聚类任务完成！下一步：生成成熟度矩阵
        </Typography>
        <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">任务ID：</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              component="code"
              sx={{
                bgcolor: 'grey.100',
                px: 2,
                py: 1,
                borderRadius: 1,
                fontFamily: 'monospace',
                flex: 1,
                userSelect: 'all',
              }}
            >
              {result.taskId}
            </Box>
            <Button variant="outlined" size="small" onClick={handleCopyTaskId}>
              复制ID
            </Button>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="contained" fullWidth onClick={handleGenerateMatrix}>
              生成成熟度矩阵
            </Button>
            <Button variant="contained" color="success" onClick={handleExportCSV}>
              导出CSV
            </Button>
          </Box>
        </Box>
      </Alert>

      {/* 基本信息 */}
      <Card>
        <CardContent>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, md: 2 }}>
              <Box sx={{ textAlign: 'center' }}>
                <FileTextIcon color="action" />
                <Typography variant="h6">{categories.length}</Typography>
                <Typography variant="caption" color="text.secondary">大类数量</Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <Box sx={{ textAlign: 'center' }}>
                <ClusterIcon color="action" />
                <Typography variant="h6">{totalClusters}</Typography>
                <Typography variant="caption" color="text.secondary">聚类数量</Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <Box sx={{ textAlign: 'center' }}>
                <CheckCircleIcon color={coverageRate >= 95 ? 'success' : 'warning'} />
                <Typography variant="h6" color={coverageRate >= 95 ? 'success.main' : 'warning.main'}>
                  {coverageRate.toFixed(1)}%
                </Typography>
                <Typography variant="caption" color="text.secondary">覆盖率</Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <Box sx={{ textAlign: 'center' }}>
                <WarningIcon color="error" />
                <Typography variant="h6" color="error.main">{highRiskClusters.length}</Typography>
                <Typography variant="caption" color="text.secondary">高风险聚类</Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <Box sx={{ textAlign: 'center' }}>
                <RobotIcon color="action" />
                <Typography variant="h6">{(result as any).selectedModel || 'GPT4'}</Typography>
                <Typography variant="caption" color="text.secondary">AI模型</Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* 质量分数 - 仅在存在时显示 */}
      {result.qualityScores && (
        <Card>
          <CardHeader title="质量评分" />
          <CardContent>
            <Grid container spacing={2}>
              <Grid size={{ xs: 4 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary">结构一致性</Typography>
                  <Box sx={{ position: 'relative', display: 'inline-flex', mt: 1 }}>
                    <CircularProgress
                      variant="determinate"
                      value={result.qualityScores.structural * 100}
                      size={80}
                      color="success"
                    />
                    <Box sx={{
                      top: 0, left: 0, bottom: 0, right: 0,
                      position: 'absolute', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <Typography variant="caption" fontWeight="bold">
                        {(result.qualityScores.structural * 100).toFixed(1)}%
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Grid>
              <Grid size={{ xs: 4 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary">语义一致性</Typography>
                  <Box sx={{ position: 'relative', display: 'inline-flex', mt: 1 }}>
                    <CircularProgress
                      variant="determinate"
                      value={result.qualityScores.semantic * 100}
                      size={80}
                      color="info"
                    />
                    <Box sx={{
                      top: 0, left: 0, bottom: 0, right: 0,
                      position: 'absolute', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <Typography variant="caption" fontWeight="bold">
                        {(result.qualityScores.semantic * 100).toFixed(1)}%
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Grid>
              <Grid size={{ xs: 4 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary">细节一致性</Typography>
                  <Box sx={{ position: 'relative', display: 'inline-flex', mt: 1 }}>
                    <CircularProgress
                      variant="determinate"
                      value={result.qualityScores.detail * 100}
                      size={80}
                      color="secondary"
                    />
                    <Box sx={{
                      top: 0, left: 0, bottom: 0, right: 0,
                      position: 'absolute', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <Typography variant="caption" fontWeight="bold">
                        {(result.qualityScores.detail * 100).toFixed(1)}%
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* 覆盖率统计 */}
      <Card>
        <CardHeader title="覆盖率统计" />
        <CardContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* 总体覆盖率 */}
            <Box>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>总体覆盖率</Typography>
              <LinearProgress
                variant="determinate"
                value={coverageRate}
                color={coverageRate >= 95 ? 'success' : 'primary'}
                sx={{ height: 10, borderRadius: 1 }}
              />
              <Typography variant="caption" color="text.secondary">
                {coverageRate.toFixed(1)}% ({coverageSummary?.overall?.clustered_clauses || 0}/{coverageSummary?.overall?.total_clauses || 0})
              </Typography>
            </Box>

            {/* 按文档覆盖率 */}
            <Box>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>各文档覆盖率</Typography>
              {coverageSummary?.by_document && Object.entries(coverageSummary.by_document).map(([docId, stats]) => {
                const doc = documents.find((d) => d.id === docId)
                const coverageRate = stats.total_clauses > 0
                  ? (stats.clustered_clauses / stats.total_clauses) * 100
                  : 0

                return (
                  <Box key={docId} sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                      <Typography variant="body2" fontWeight="medium">
                        {doc?.name || docId}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {stats.clustered_clauses}/{stats.total_clauses}
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={coverageRate}
                      color={coverageRate >= 95 ? 'success' : 'primary'}
                      sx={{ height: 6, borderRadius: 1 }}
                    />
                    {stats.missing_clause_ids?.length > 0 && (
                      <Typography variant="caption" color="error">
                        遗漏条款: {stats.missing_clause_ids.join(', ')}
                      </Typography>
                    )}
                  </Box>
                )
              })}
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* 聚类逻辑说明 */}
      <Card>
        <CardHeader title="聚类逻辑" />
        <CardContent>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
            {clustering_logic}
          </Typography>
        </CardContent>
      </Card>

      {/* 聚类详情（三层结构展示）*/}
      <Card>
        <CardHeader
          title={
            <Stack direction="row" spacing={1} alignItems="center">
              <span>聚类详情（三层结构）</span>
              <Chip label={`${categories.length}个大类`} color="secondary" size="small" />
              <Chip label={`${totalClusters}个聚类`} color="primary" size="small" />
            </Stack>
          }
        />
        <CardContent>
          {categories.map((category, categoryIndex) => (
            <Accordion key={category.id} defaultExpanded={categoryIndex === 0}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%', pr: 2 }}>
                  <Badge badgeContent={categoryIndex + 1} color="secondary" />
                  <Typography variant="subtitle1" fontWeight="bold">{category.name}</Typography>
                  <Chip label="大类" color="secondary" size="small" />
                  <Box sx={{ flex: 1 }} />
                  <Chip label={`${category.clusters.length}个聚类`} color="primary" size="small" />
                </Stack>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {/* 大类描述 */}
                  <Alert severity="info">
                    <Typography variant="subtitle2" fontWeight="bold">大类描述</Typography>
                    <Typography variant="body2">{category.description}</Typography>
                  </Alert>

                  {/* 该大类下的所有聚类 */}
                  {category.clusters.map((cluster, clusterIndex) => (
                    <Accordion key={cluster.id}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%', pr: 2 }}>
                          <Badge badgeContent={clusterIndex + 1} color="success" />
                          <Typography variant="subtitle2" fontWeight="bold">{cluster.name}</Typography>
                          <Chip
                            label={cluster.importance}
                            color={importanceColorMap[cluster.importance]}
                            size="small"
                          />
                          <Chip
                            label={`风险: ${cluster.risk_level}`}
                            color={riskColorMap[cluster.risk_level]}
                            size="small"
                            icon={cluster.risk_level === 'HIGH' ? <WarningIcon /> : undefined}
                          />
                          <Box sx={{ flex: 1 }} />
                          <Chip label={`${cluster.clauses.length}个条款`} size="small" />
                        </Stack>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {/* 聚类描述 */}
                          <Alert severity="success">
                            <Typography variant="subtitle2" fontWeight="bold">聚类描述</Typography>
                            <Typography variant="body2">{cluster.description}</Typography>
                          </Alert>

                          {/* 条款列表 */}
                          <Box>
                            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>包含条款：</Typography>
                            <Stack spacing={2}>
                              {cluster.clauses.map((clause) => (
                                <Card
                                  key={`${clause.source_document_id}-${clause.clause_id}`}
                                  variant="outlined"
                                  sx={{
                                    borderColor: cluster.risk_level === 'HIGH'
                                      ? 'error.main'
                                      : cluster.risk_level === 'MEDIUM'
                                        ? 'warning.main'
                                        : 'grey.300',
                                    bgcolor: cluster.risk_level === 'HIGH'
                                      ? 'error.50'
                                      : cluster.risk_level === 'MEDIUM'
                                        ? 'warning.50'
                                        : 'inherit',
                                  }}
                                >
                                  <CardContent>
                                    <Stack spacing={1}>
                                      {/* 条款头部 */}
                                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <Stack direction="row" spacing={1} alignItems="center">
                                          <Chip label={clause.source_document_name} color="primary" size="small" />
                                          <Typography variant="body2" fontFamily="monospace" fontWeight="bold">
                                            {clause.clause_id}
                                          </Typography>
                                        </Stack>
                                        {cluster.risk_level === 'HIGH' && (
                                          <Chip label="高风险" color="error" size="small" icon={<WarningIcon />} />
                                        )}
                                      </Box>

                                      {/* 条款内容 */}
                                      <Typography variant="body2" color="text.secondary">
                                        {clause.clause_text}
                                      </Typography>

                                      {/* 归类理由 */}
                                      <Box sx={{ bgcolor: 'grey.100', p: 1, borderRadius: 1 }}>
                                        <Typography variant="caption">
                                          <strong>归类理由：</strong>{clause.rationale}
                                        </Typography>
                                      </Box>
                                    </Stack>
                                  </CardContent>
                                </Card>
                              ))}
                            </Stack>
                          </Box>
                        </Box>
                      </AccordionDetails>
                    </Accordion>
                  ))}
                </Box>
              </AccordionDetails>
            </Accordion>
          ))}
        </CardContent>
      </Card>

      {/* 高风险提醒 */}
      {highRiskClusters.length > 0 && (
        <Alert severity="warning" icon={<WarningIcon />}>
          <Typography variant="subtitle1" fontWeight="bold">高风险提醒</Typography>
          <Typography variant="body2">
            检测到 {highRiskClusters.length} 个高风险聚类，建议优先审查：
            {highRiskClusters.map((c) => c.name).join('、')}
          </Typography>
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
    </Box>
  )
}
