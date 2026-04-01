'use client'

/**
 * 差距分析报告组件
 * 专用于打印/PDF导出，包含完整的报告内容
 */

import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  FileText,
  BarChart3,
  TrendingDown,
  TrendingUp,
  Award,
  Lightbulb,
  Calendar,
  CheckCircle,
} from 'lucide-react'
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
const getGradeColor = (grade: string): string => {
  if (grade.includes('卓越级')) return 'bg-[#8B5CF6] text-white'
  if (grade.includes('系统优化级')) return 'bg-[#1E3A5F] text-white'
  if (grade.includes('充分规范级')) return 'bg-[#059669] text-white'
  if (grade.includes('初步规范级')) return 'bg-[#F59E0B] text-white'
  return 'bg-[#DC2626] text-white'
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
        <div className="report-cover print-page-break bg-gradient-to-br from-[#1E3A5F] to-[#059669] text-white p-16 min-h-screen flex items-center justify-center">
          <div className="report-cover-content text-center">
            <div className="report-cover-icon flex justify-center mb-8">
              <FileText className="h-16 w-16" />
            </div>
            <h1 className="report-cover-title text-5xl font-bold mb-6">差距分析报告</h1>
            <div className="report-cover-project text-2xl font-medium mb-4">{projectName}</div>
            <div className="report-cover-date flex items-center justify-center text-lg opacity-90 mb-8">
              <Calendar className="h-5 w-5 mr-2" /> {reportDate}
            </div>
            <div className="report-cover-divider w-32 h-1 bg-white/30 mx-auto mb-6" />
            <div className="report-cover-subtitle text-lg opacity-80">
              基于 CMMI 成熟度模型的全面评估
            </div>
          </div>
        </div>
      )}

      {/* 报告内容 */}
      <div className="report-content bg-[#FEFDFB] p-8">
        {/* 成熟度概览 */}
        <section className="report-section mb-8">
          <h2 className="report-section-title text-2xl font-bold text-[#1E3A5F] mb-4 flex items-center">
            <BarChart3 className="mr-3" /> 成熟度概览
          </h2>
          <Card className="report-card border-[#E2E8F0]">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="text-center">
                  <p className="text-sm text-[#64748B] mb-2">总体成熟度等级</p>
                  <p className="text-4xl font-bold text-[#1E3A5F]">
                    {overall.maturityLevel.toFixed(2)}
                  </p>
                  <p className="text-sm text-[#64748B]">/ 5.0</p>
                  <div className="mt-3">
                    <Badge className={getGradeColor(overall.grade)}>
                      {overall.grade}
                    </Badge>
                  </div>
                  <p className="text-sm text-[#64748B] mt-3">
                    {overall.description}
                  </p>
                </div>
                <div className="md:col-span-3">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-[#1E3A5F]">计算公式</span>
                      <code className="report-code bg-[#F1F5F9] px-2 py-1 rounded text-sm">{overall.calculation.formula}</code>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-[#1E3A5F]">总得分</span>
                      <span className="text-xl font-bold text-[#1E3A5F]">{overall.calculation.totalScore}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-[#1E3A5F]">满分</span>
                      <span className="text-xl font-bold text-[#1E3A5F]">{overall.calculation.maxScore}</span>
                    </div>
                    <div className="mt-4">
                      <div className="flex justify-between mb-1">
                        <span className="text-sm text-[#64748B]">成熟度进度</span>
                        <span className="text-sm text-[#64748B]">{overall.maturityLevel.toFixed(2)} / 5.0</span>
                      </div>
                      <Progress value={getMaturityProgress(overall.maturityLevel)} className="h-2.5" />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* 雷达图 */}
        <section className="report-section mb-8">
          <h2 className="report-section-title text-2xl font-bold text-[#1E3A5F] mb-4 flex items-center">
            <BarChart3 className="mr-3" /> 维度成熟度分布
          </h2>
          <Card className="report-card border-[#E2E8F0]">
            <CardContent className="p-6">
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
        <section className="report-section mb-8">
          <h2 className="report-section-title text-2xl font-bold text-[#1E3A5F] mb-4 flex items-center">
            <Award className="mr-3" /> 各维度成熟度详情
          </h2>
          <Card className="report-card border-[#E2E8F0]">
            <CardContent className="p-6">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#F8FAFC]">
                    <TableHead className="text-[#1E3A5F]">维度</TableHead>
                    <TableHead className="text-[#1E3A5F]">聚类数</TableHead>
                    <TableHead className="text-[#1E3A5F]">成熟度等级</TableHead>
                    <TableHead className="text-[#1E3A5F]">等级评定</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dimensionMaturity.map((d, index) => (
                    <TableRow key={index}>
                      <TableCell>{d.dimension}</TableCell>
                      <TableCell>{d.clusterCount}</TableCell>
                      <TableCell>{d.maturityLevel.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge className={getGradeColor(d.grade)} variant="secondary">
                          {d.grade}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>

        {/* TOP 3 短板 */}
        <section className="report-section mb-8">
          <h2 className="report-section-title text-2xl font-bold text-[#1E3A5F] mb-4 flex items-center">
            <TrendingDown className="mr-3 text-[#DC2626]" /> TOP 3 短板维度
          </h2>
          <Card className="report-card border-[#E2E8F0]">
            <CardContent className="p-6">
              {topShortcomings.slice(0, 3).map((item) => (
                <div key={item.rank} className="report-ranked-item mb-4 p-4 bg-[#FEF2F2] border border-[#FECACA] rounded-sm">
                  <div className="report-ranked-item-header flex items-center gap-2 mb-2">
                    <Badge className="bg-[#DC2626] text-white">{item.rank}</Badge>
                    <span className="report-item-name font-semibold text-[#1E3A5F]">{item.cluster_name}</span>
                  </div>
                  <div className="report-item-details flex items-center gap-4 text-sm text-[#64748B]">
                    <span>成熟度: {item.maturityLevel.toFixed(2)}</span>
                    <div className="w-px h-4 bg-[#E2E8F0]" />
                    <span>差距: {item.gap?.toFixed(2) || 'N/A'}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        {/* TOP 3 优势 */}
        <section className="report-section mb-8">
          <h2 className="report-section-title text-2xl font-bold text-[#1E3A5F] mb-4 flex items-center">
            <TrendingUp className="mr-3 text-[#059669]" /> TOP 3 优势维度
          </h2>
          <Card className="report-card border-[#E2E8F0]">
            <CardContent className="p-6">
              {topStrengths.slice(0, 3).map((item) => (
                <div key={item.rank} className="report-ranked-item mb-4 p-4 bg-[#F0FDF4] border border-[#BBF7D0] rounded-sm">
                  <div className="report-ranked-item-header flex items-center gap-2 mb-2">
                    <Badge className="bg-[#059669] text-white">{item.rank}</Badge>
                    <span className="report-item-name font-semibold text-[#1E3A5F]">{item.cluster_name}</span>
                  </div>
                  <div className="report-item-details flex items-center gap-4 text-sm text-[#64748B]">
                    <span>成熟度: {item.maturityLevel.toFixed(2)}</span>
                    <div className="w-px h-4 bg-[#E2E8F0]" />
                    <span>优势: {item.advantage?.toFixed(2) || 'N/A'}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        {/* 改进建议 */}
        <section className="report-section mb-8">
          <h2 className="report-section-title text-2xl font-bold text-[#1E3A5F] mb-4 flex items-center">
            <Lightbulb className="mr-3 text-[#F59E0B]" /> 改进建议
          </h2>
          <Card className="report-card border-[#E2E8F0]">
            <CardContent className="p-6">
              {suggestions.map((suggestion, index) => (
                <div key={index} className="report-suggestion-item mb-6">
                  <div className="report-suggestion-header flex items-center gap-2 mb-3">
                    <CheckCircle className="h-5 w-5 text-[#059669]" />
                    <strong className="text-[#1E3A5F]">{suggestion.dimension}</strong>
                    <Badge className="bg-[#1E3A5F] text-white ml-2">
                      Level {suggestion.currentLevel.toFixed(1)} → {suggestion.targetLevel.toFixed(1)}
                    </Badge>
                  </div>
                  <ul className="report-suggestion-list list-disc pl-6 space-y-2 text-sm text-[#64748B]">
                    {suggestion.suggestions.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                  {index < suggestions.length - 1 && <div className="h-px bg-[#E2E8F0] my-4" />}
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        {/* 聚类详情 */}
        <section className="report-section mb-8">
          <h2 className="report-section-title text-2xl font-bold text-[#1E3A5F] mb-4 flex items-center">
            <Award className="mr-3" /> 各聚类详细成熟度
          </h2>
          <Card className="report-card border-[#E2E8F0]">
            <CardContent className="p-6">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#F8FAFC]">
                    <TableHead className="text-[#1E3A5F]">聚类名称</TableHead>
                    <TableHead className="text-[#1E3A5F]">所属维度</TableHead>
                    <TableHead className="text-[#1E3A5F]">成熟度</TableHead>
                    <TableHead className="text-[#1E3A5F]">等级</TableHead>
                    <TableHead className="text-[#1E3A5F]">问题数</TableHead>
                    <TableHead className="text-[#1E3A5F]">状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clusterMaturity.map((c) => (
                    <TableRow key={c.cluster_id}>
                      <TableCell>{c.cluster_name}</TableCell>
                      <TableCell>{c.dimension}</TableCell>
                      <TableCell>{c.maturityLevel.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge className={getGradeColor(c.grade)} variant="secondary">
                          {c.grade}
                        </Badge>
                      </TableCell>
                      <TableCell>{c.questionsCount}</TableCell>
                      <TableCell>
                        {c.isShortcoming && <Badge className="bg-[#DC2626] text-white">短板</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>

        {/* 报告页脚 */}
        <footer className="report-footer mt-8">
          <div className="h-px bg-[#E2E8F0]" />
          <p className="report-footer-text text-sm text-[#64748B] text-center mt-4">
            本报告由 CSAAS 平台自动生成 | 生成时间: {new Date().toLocaleString('zh-CN')}
          </p>
        </footer>
      </div>
    </div>
  )
}

export default GapAnalysisReport
