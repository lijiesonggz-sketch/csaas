'use client'

/**
 * 差距分析报告组件
 * 专用于打印/PDF导出，包含完整的报告内容
 */

import React from 'react'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Chip from '@mui/material/Chip'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import Divider from '@mui/material/Divider'
import LinearProgress from '@mui/material/LinearProgress'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import DescriptionIcon from '@mui/icons-material/Description'
import BarChartIcon from '@mui/icons-material/BarChart'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import LightbulbIcon from '@mui/icons-material/Lightbulb'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import MaturityRadarChart, { MaturityRadarData } from './MaturityRadarChart'

/**
 * 聚类成熟度数据接口
 */
interface ClusterMaturity {
  cluster_id: string
  cluster_name: string
  dimension: string
  maturityLevel: number
  totalScore: number
  maxScore: number
  questionsCount: number
  calculation: string
  grade: string
  isShortcoming: boolean
}

/**
 * 短板/优势项接口
 */
interface RankedItem {
  rank: number
  cluster_id: string
  cluster_name: string
  maturityLevel: number
  gap?: number
  advantage?: number
}

/**
 * 改进建议接口
 */
interface ImprovementSuggestion {
  dimension: string
  currentLevel: number
  targetLevel: number
  gap: number
  suggestions: string[]
}

/**
 * 报告数据接口
 */
export interface GapAnalysisReportData {
  projectName: string
  reportDate: string
  overall: {
    maturityLevel: number
    grade: string
    description: string
    calculation: {
      totalScore: number
      maxScore: number
      formula: string
    }
  }
  dimensionMaturity: Array<{
    dimension: string
    clusterCount: number
    maturityLevel: number
    grade: string
  }>
  clusterMaturity: ClusterMaturity[]
  topShortcomings: RankedItem[]
  topStrengths: RankedItem[]
  targetMaturity?: number
  improvementSuggestions?: ImprovementSuggestion[]
}

/**
 * 组件属性接口
 */
export interface GapAnalysisReportProps {
  /** 报告数据 */
  data: GapAnalysisReportData
  /** 是否显示封面 */
  showCover?: boolean
  /** 额外的CSS类名 */
  className?: string
}

/**
 * 获取等级颜色
 */
const getGradeColor = (grade: string): 'secondary' | 'primary' | 'success' | 'warning' | 'error' => {
  if (grade.includes('卓越级')) return 'secondary'
  if (grade.includes('系统优化级')) return 'primary'
  if (grade.includes('充分规范级')) return 'success'
  if (grade.includes('初步规范级')) return 'warning'
  return 'error'
}

/**
 * 获取成熟度进度百分比
 */
const getMaturityProgress = (level: number): number => {
  return (level / 5) * 100
}

/**
 * 将维度成熟度映射为雷达图数据
 */
const mapToRadarData = (
  dimensionMaturity: Array<{
    dimension: string
    clusterCount: number
    maturityLevel: number
    grade: string
  }>
): MaturityRadarData[] => {
  const dimensionMap = new Map<string, number[]>()

  dimensionMaturity.forEach((d) => {
    const values = dimensionMap.get(d.dimension) || []
    values.push(d.maturityLevel)
    dimensionMap.set(d.dimension, values)
  })

  const dimensions = ['战略与治理', '技术架构', '流程与管理', '人员能力', '安全与合规', '创新与文化']

  return dimensions.map((name) => {
    const values = dimensionMap.get(name) || [3]
    const avgValue = values.length > 0
      ? values.reduce((a, b) => a + b, 0) / values.length
      : 3
    return {
      name,
      value: Number(avgValue.toFixed(2)),
      fullMark: 5,
    }
  })
}

/**
 * 生成默认改进建议
 */
const generateDefaultSuggestions = (shortcomings: RankedItem[]): ImprovementSuggestion[] => {
  return shortcomings.slice(0, 3).map((item) => ({
    dimension: item.cluster_name,
    currentLevel: item.maturityLevel,
    targetLevel: Math.min(item.maturityLevel + 1.5, 5),
    gap: item.gap || 1.5,
    suggestions: [
      `针对${item.cluster_name}制定专项改进计划`,
      '加强相关流程标准化建设',
      '定期开展培训和技能提升',
    ],
  }))
}

/**
 * 差距分析报告组件
 *
 * @example
 * ```tsx
 * <GapAnalysisReport
 *   data={reportData}
 *   showCover={true}
 * />
 * ```
 */
export const GapAnalysisReport: React.FC<GapAnalysisReportProps> = ({
  data,
  showCover = true,
  className = '',
}) => {
  const {
    projectName,
    reportDate,
    overall,
    dimensionMaturity,
    clusterMaturity,
    topShortcomings,
    topStrengths,
    targetMaturity,
    improvementSuggestions,
  } = data

  const radarData = mapToRadarData(dimensionMaturity)
  const suggestions = improvementSuggestions || generateDefaultSuggestions(topShortcomings)

  // 目标雷达图数据（如果有目标成熟度）
  const targetRadarData = targetMaturity
    ? radarData.map((item) => ({
        ...item,
        value: Math.min(item.value + 1, 5),
      }))
    : undefined

  return (
    <div className={`gap-analysis-report ${className}`} data-project-name={projectName}>
      {/* 封面页 */}
      {showCover && (
        <div className="report-cover print-page-break">
          <div className="report-cover-content">
            <div className="report-cover-icon">
              <DescriptionIcon sx={{ fontSize: 48 }} />
            </div>
            <h1 className="report-cover-title">差距分析报告</h1>
            <div className="report-cover-project">{projectName}</div>
            <div className="report-cover-date">
              <CalendarTodayIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} /> {reportDate}
            </div>
            <div className="report-cover-divider" />
            <div className="report-cover-subtitle">
              基于 CMMI 成熟度模型的全面评估
            </div>
          </div>
        </div>
      )}

      {/* 报告内容 */}
      <div className="report-content">
        {/* 成熟度概览 */}
        <section className="report-section">
          <h2 className="report-section-title">
            <BarChartIcon sx={{ verticalAlign: 'middle', mr: 1 }} /> 成熟度概览
          </h2>
          <Card className="report-card">
            <CardContent>
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">总体成熟度等级</Typography>
                    <Typography variant="h3" sx={{ color: 'primary.main', fontWeight: 'bold' }}>
                      {overall.maturityLevel.toFixed(2)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">/ 5.0</Typography>
                    <Box sx={{ mt: 2 }}>
                      <Chip label={overall.grade} color={getGradeColor(overall.grade)} />
                    </Box>
                    <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
                      {overall.description}
                    </Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 12, md: 8 }}>
                  <TableContainer>
                    <Table size="small">
                      <TableBody>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold' }}>计算公式</TableCell>
                          <TableCell><code className="report-code">{overall.calculation.formula}</code></TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold' }}>总得分</TableCell>
                          <TableCell><strong style={{ fontSize: 18 }}>{overall.calculation.totalScore}</strong></TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold' }}>满分</TableCell>
                          <TableCell><strong style={{ fontSize: 18 }}>{overall.calculation.maxScore}</strong></TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <Box sx={{ mt: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2">成熟度进度</Typography>
                      <Typography variant="body2">{overall.maturityLevel.toFixed(2)} / 5.0</Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={getMaturityProgress(overall.maturityLevel)}
                      sx={{ height: 10, borderRadius: 5 }}
                    />
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </section>

        {/* 雷达图 */}
        <section className="report-section">
          <h2 className="report-section-title">
            <BarChartIcon sx={{ verticalAlign: 'middle', mr: 1 }} /> 维度成熟度分布
          </h2>
          <Card className="report-card">
            <CardContent>
              <MaturityRadarChart
                data={radarData}
                comparisonData={targetRadarData}
                title=""
                height={400}
                showLegend={true}
                currentName="当前成熟度"
                comparisonName="目标成熟度"
              />
            </CardContent>
          </Card>
        </section>

        {/* 维度详情表格 */}
        <section className="report-section">
          <h2 className="report-section-title">
            <EmojiEventsIcon sx={{ verticalAlign: 'middle', mr: 1 }} /> 各维度成熟度详情
          </h2>
          <Card className="report-card">
            <CardContent>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>维度</TableCell>
                      <TableCell>聚类数</TableCell>
                      <TableCell>成熟度等级</TableCell>
                      <TableCell>等级评定</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {dimensionMaturity.map((d, index) => (
                      <TableRow key={index}>
                        <TableCell>{d.dimension}</TableCell>
                        <TableCell>{d.clusterCount}</TableCell>
                        <TableCell>{d.maturityLevel.toFixed(2)}</TableCell>
                        <TableCell><Chip label={d.grade} color={getGradeColor(d.grade)} size="small" /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </section>

        {/* TOP 3 短板 */}
        <section className="report-section">
          <h2 className="report-section-title">
            <TrendingDownIcon sx={{ verticalAlign: 'middle', mr: 1, color: '#ff4d4f' }} /> TOP 3 短板维度
          </h2>
          <Card className="report-card">
            <CardContent>
              {topShortcomings.slice(0, 3).map((item) => (
                <div key={item.rank} className="report-ranked-item">
                  <div className="report-ranked-item-header">
                    <Chip label={String(item.rank)} color="error" size="small" sx={{ mr: 1 }} />
                    <span className="report-item-name">{item.cluster_name}</span>
                  </div>
                  <div className="report-item-details">
                    <span>成熟度: {item.maturityLevel.toFixed(2)}</span>
                    <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
                    <span>差距: {item.gap?.toFixed(2) || 'N/A'}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        {/* TOP 3 优势 */}
        <section className="report-section">
          <h2 className="report-section-title">
            <TrendingUpIcon sx={{ verticalAlign: 'middle', mr: 1, color: '#52c41a' }} /> TOP 3 优势维度
          </h2>
          <Card className="report-card">
            <CardContent>
              {topStrengths.slice(0, 3).map((item) => (
                <div key={item.rank} className="report-ranked-item">
                  <div className="report-ranked-item-header">
                    <Chip label={String(item.rank)} color="success" size="small" sx={{ mr: 1 }} />
                    <span className="report-item-name">{item.cluster_name}</span>
                  </div>
                  <div className="report-item-details">
                    <span>成熟度: {item.maturityLevel.toFixed(2)}</span>
                    <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
                    <span>优势: {item.advantage?.toFixed(2) || 'N/A'}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        {/* 改进建议 */}
        <section className="report-section">
          <h2 className="report-section-title">
            <LightbulbIcon sx={{ verticalAlign: 'middle', mr: 1, color: '#faad14' }} /> 改进建议
          </h2>
          <Card className="report-card">
            <CardContent>
              {suggestions.map((suggestion, index) => (
                <div key={index} className="report-suggestion-item">
                  <div className="report-suggestion-header">
                    <CheckCircleIcon sx={{ color: 'success.main', mr: 1, fontSize: 20 }} />
                    <strong>{suggestion.dimension}</strong>
                    <Chip
                      label={`Level ${suggestion.currentLevel.toFixed(1)} → ${suggestion.targetLevel.toFixed(1)}`}
                      color="primary"
                      size="small"
                      sx={{ ml: 1 }}
                    />
                  </div>
                  <ul className="report-suggestion-list">
                    {suggestion.suggestions.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                  {index < suggestions.length - 1 && <Divider sx={{ my: 2 }} />}
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        {/* 聚类详情 */}
        <section className="report-section">
          <h2 className="report-section-title">
            <EmojiEventsIcon sx={{ verticalAlign: 'middle', mr: 1 }} /> 各聚类详细成熟度
          </h2>
          <Card className="report-card">
            <CardContent>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>聚类名称</TableCell>
                      <TableCell>所属维度</TableCell>
                      <TableCell>成熟度</TableCell>
                      <TableCell>等级</TableCell>
                      <TableCell>问题数</TableCell>
                      <TableCell>状态</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {clusterMaturity.map((c) => (
                      <TableRow key={c.cluster_id}>
                        <TableCell>{c.cluster_name}</TableCell>
                        <TableCell>{c.dimension}</TableCell>
                        <TableCell>{c.maturityLevel.toFixed(2)}</TableCell>
                        <TableCell><Chip label={c.grade} color={getGradeColor(c.grade)} size="small" /></TableCell>
                        <TableCell>{c.questionsCount}</TableCell>
                        <TableCell>{c.isShortcoming ? <Chip label="短板" color="error" size="small" /> : null}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </section>

        {/* 报告页脚 */}
        <footer className="report-footer">
          <Divider />
          <p className="report-footer-text">
            本报告由 CSAAS 平台自动生成 | 生成时间: {new Date().toLocaleString('zh-CN')}
          </p>
        </footer>
      </div>
    </div>
  )
}

export default GapAnalysisReport
