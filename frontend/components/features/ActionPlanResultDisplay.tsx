'use client'

/**
 * 改进措施结果展示组件 (完整版)
 * 展示完整的改进措施计划，支持导出功能
 */

import { useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import {
  Download,
  CheckCircle,
  Clock,
  Users,
  Rocket,
  Shield,
  Zap,
  BarChart3,
  Building,
  TrendingUp,
  Wallet,
  Wrench,
  GraduationCap,
  Link,
  AlertTriangle,
  Target,
  ListOrdered,
  ChevronRight,
} from 'lucide-react'
import type { GenerationResult } from '@/lib/types/ai-generation'

// 实施步骤
interface ImplementationStep {
  stepNumber: number
  title: string
  description: string
  duration: string
}

// 资源需求
interface ResourcesNeeded {
  budget?: string
  personnel?: string[]
  technology?: string[]
  training?: string
}

// 依赖关系
interface Dependencies {
  prerequisiteMeasures?: string[]
  externalDependencies?: string[]
}

// 风险
interface Risk {
  risk: string
  mitigation: string
}

// KPI指标
interface KpiMetric {
  metric: string
  target: string
  measurementMethod: string
}

// 详细措施
interface DetailedMeasure {
  title: string
  description: string
  implementationSteps: ImplementationStep[]
  timeline: string
  responsibleDepartment: string
  expectedImprovement: number
  resourcesNeeded?: ResourcesNeeded
  dependencies?: Dependencies
  risks?: Risk[]
  kpiMetrics?: KpiMetric[]
  clusterName?: string
  priority?: string
}

interface Improvement {
  area: string
  actions: string[]
  priority: string
  timeline?: string
  resources?: string
  targetLevel?: string
  currentLevel?: string
  expectedOutcome?: string
}

interface ActionPlanResultDisplayProps {
  result: GenerationResult
  detailedMeasures?: DetailedMeasure[]
}

export default function ActionPlanResultDisplay({ result, detailedMeasures }: ActionPlanResultDisplayProps) {
  const useDetailedMeasures = detailedMeasures && detailedMeasures.length > 0
  const improvements: Improvement[] = result.selectedResult?.improvements || []
  const summary = result.selectedResult?.summary || ''
  const metadata = result.selectedResult?.metadata || {}
  const totalMeasures = useDetailedMeasures
    ? detailedMeasures.length
    : (result.selectedResult?.totalMeasures || improvements.length)

  const getPriorityConfig = (priority: string) => {
    const configs: Record<string, { variant: 'default' | 'destructive' | 'secondary' | 'outline', icon: string; text: string }> = {
      '高': { variant: 'destructive', icon: '🔴', text: '高优先级' },
      '中': { variant: 'secondary', icon: '🟡', text: '中优先级' },
      '低': { variant: 'outline', icon: '🟢', text: '低优先级' },
    }
    return configs[priority] || { variant: 'default', icon: '⚪', text: priority }
  }

  const getPriorityFromMeasure = (measure: DetailedMeasure) => {
    if (measure.priority === 'high') return '高'
    if (measure.priority === 'medium') return '中'
    if (measure.priority === 'low') return '低'
    return '中'
  }

  const handleExportCSV = () => {
    if (useDetailedMeasures && detailedMeasures) {
      // 导出详细措施数据
      const headers = [
        '序号',
        '改进领域',
        '措施标题',
        '详细描述',
        '优先级',
        '时间周期',
        '负责部门',
        '预期提升',
        '预算估算',
        '人员需求',
        '技术工具',
        '培训需求',
        '实施步骤',
        '前置措施',
        '外部依赖',
        '风险与缓解',
        'KPI指标',
      ]

      const rows = detailedMeasures.map((measure, index) => {
        const priority = getPriorityFromMeasure(measure)
        const steps = measure.implementationSteps
          ?.map(s => `步骤${s.stepNumber}: ${s.title} (${s.duration})`)
          .join('; ') || ''
        const risks = measure.risks
          ?.map(r => `风险: ${r.risk} | 缓解: ${r.mitigation}`)
          .join('; ') || ''
        const kpis = measure.kpiMetrics
          ?.map(k => `${k.metric}(目标: ${k.target})`)
          .join('; ') || ''

        return [
          index + 1,
          measure.clusterName || '',
          measure.title,
          measure.description,
          priority,
          measure.timeline,
          measure.responsibleDepartment,
          measure.expectedImprovement,
          measure.resourcesNeeded?.budget || '',
          (measure.resourcesNeeded?.personnel || []).join(', '),
          (measure.resourcesNeeded?.technology || []).join(', '),
          measure.resourcesNeeded?.training || '',
          steps,
          (measure.dependencies?.prerequisiteMeasures || []).join(', '),
          (measure.dependencies?.externalDependencies || []).join(', '),
          risks,
          kpis,
        ].map(field => `"${String(field).replace(/"/g, '""')}"`)
      })

      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `改进措施详情_${new Date().toISOString().split('T')[0]}.csv`
      link.click()
      toast.success('CSV导出成功')
    } else {
      // 导出简化版数据
      const headers = ['序号', '改进领域', '优先级', '时间周期', '所需资源', '预期成果', '改进措施']
      const rows = improvements.map((improvement, index) => [
        index + 1,
        improvement.area,
        improvement.priority,
        improvement.timeline || '',
        improvement.resources || '',
        improvement.expectedOutcome || '',
        improvement.actions.join('; '),
      ].map(field => `"${String(field).replace(/"/g, '""')}"`))

      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `改进措施_${new Date().toISOString().split('T')[0]}.csv`
      link.click()
      toast.success('CSV导出成功')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 概述信息 */}
      {summary && (
        <Alert>
          <Rocket className="w-4 h-4" />
          <AlertTitle>改进措施概述</AlertTitle>
          <AlertDescription>{summary}</AlertDescription>
        </Alert>
      )}

      {/* 统计概览 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6 text-center">
            <Shield className="w-10 h-10 mx-auto mb-2 text-emerald-500" />
            <div className="text-3xl font-bold text-emerald-600">
              {useDetailedMeasures
                ? Array.from(new Set(detailedMeasures.map(m => m.clusterName))).length
                : improvements.length}
            </div>
            <p className="text-sm text-slate-500">改进领域</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-center">
            <CheckCircle className="w-10 h-10 mx-auto mb-2 text-indigo-500" />
            <div className="text-3xl font-bold text-indigo-600">{totalMeasures}</div>
            <p className="text-sm text-slate-500">总措施数</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-center">
            <Zap className="w-10 h-10 mx-auto mb-2 text-red-500" />
            <div className="text-3xl font-bold text-red-600">
              {useDetailedMeasures
                ? detailedMeasures.filter(m => m.priority === 'high').length
                : improvements.filter(i => i.priority === '高').length}
            </div>
            <p className="text-sm text-slate-500">高优先级</p>
          </CardContent>
        </Card>
      </div>

      {/* 导出按钮 */}
      <Card>
        <CardContent className="p-6">
          <Button onClick={handleExportCSV} className="gap-2">
            <Download className="w-4 h-4" />
            导出CSV
          </Button>
        </CardContent>
      </Card>

      {/* 改进措施列表 */}
      <Card>
        <CardHeader>
          <CardTitle>改进措施详情</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            {useDetailedMeasures && detailedMeasures ? (
              // 使用详细措施数据
              detailedMeasures.map((measure, index) => {
                const priority = getPriorityFromMeasure(measure)
                const config = getPriorityConfig(priority)
                return (
                  <DetailedMeasureCard
                    key={index}
                    measure={measure}
                    index={index}
                    config={config}
                  />
                )
              })
            ) : (
              // 使用简化版数据
              improvements.map((improvement, index) => {
                const config = getPriorityConfig(improvement.priority)
                return (
                  <SimpleMeasureCard
                    key={index}
                    improvement={improvement}
                    index={index}
                    config={config}
                  />
                )
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// 详细措施卡片组件
interface DetailedMeasureCardProps {
  measure: DetailedMeasure
  index: number
  config: { variant: 'default' | 'destructive' | 'secondary' | 'outline', icon: string; text: string }
}

function DetailedMeasureCard({ measure, index, config }: DetailedMeasureCardProps) {
  return (
    <Card className="border-l-4 border-l-indigo-500">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span>{config.icon}</span>
          <CardTitle className="text-lg">{index + 1}. {measure.title}</CardTitle>
          <Badge variant={config.variant}>{config.text}</Badge>
          {measure.clusterName && (
            <Badge variant="outline" className="ml-auto">
              {measure.clusterName}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* 详细描述 */}
          {measure.description && (
            <div className="bg-slate-50 p-3 rounded-lg">
              <p className="text-sm text-slate-700">{measure.description}</p>
            </div>
          )}

          {/* 详细信息网格 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {measure.timeline && (
              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-slate-500">时间周期</p>
                  <p className="text-sm font-medium">{measure.timeline}</p>
                </div>
              </div>
            )}
            {measure.responsibleDepartment && (
              <div className="flex items-start gap-2">
                <Building className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-slate-500">负责部门</p>
                  <p className="text-sm font-medium">{measure.responsibleDepartment}</p>
                </div>
              </div>
            )}
            {measure.expectedImprovement !== undefined && (
              <div className="flex items-start gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-slate-500">预期提升</p>
                  <p className="text-sm font-medium">+{measure.expectedImprovement.toFixed(2)} 分</p>
                </div>
              </div>
            )}
            {measure.resourcesNeeded?.budget && (
              <div className="flex items-start gap-2">
                <Wallet className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-slate-500">预算估算</p>
                  <p className="text-sm font-medium">{measure.resourcesNeeded.budget}</p>
                </div>
              </div>
            )}
          </div>

          {/* 资源需求 */}
          {measure.resourcesNeeded && (
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="resources">
                <AccordionTrigger className="text-sm py-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-500" />
                    <span>资源需求</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                    {measure.resourcesNeeded.personnel && measure.resourcesNeeded.personnel.length > 0 && (
                      <div>
                        <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          人员需求
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {measure.resourcesNeeded.personnel.map((person, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {person}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {measure.resourcesNeeded.technology && measure.resourcesNeeded.technology.length > 0 && (
                      <div>
                        <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                          <Wrench className="w-3 h-3" />
                          技术工具
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {measure.resourcesNeeded.technology.map((tech, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {tech}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {measure.resourcesNeeded.training && (
                      <div>
                        <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                          <GraduationCap className="w-3 h-3" />
                          培训需求
                        </p>
                        <p className="text-sm text-slate-700">{measure.resourcesNeeded.training}</p>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}

          {/* 实施步骤 */}
          {measure.implementationSteps && measure.implementationSteps.length > 0 && (
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="steps">
                <AccordionTrigger className="text-sm py-2">
                  <div className="flex items-center gap-2">
                    <ListOrdered className="w-4 h-4 text-indigo-500" />
                    <span>实施步骤 ({measure.implementationSteps.length}个)</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 pt-2">
                    {measure.implementationSteps.map((step, idx) => (
                      <div key={idx} className="flex gap-3 p-3 bg-slate-50 rounded-lg">
                        <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-sm font-bold">
                          {step.stepNumber}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium">{step.title}</p>
                            {step.duration && (
                              <Badge variant="outline" className="text-xs">
                                <Clock className="w-3 h-3 mr-1" />
                                {step.duration}
                              </Badge>
                            )}
                          </div>
                          {step.description && (
                            <p className="text-xs text-slate-500 mt-1">{step.description}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}

          {/* 依赖关系 */}
          {measure.dependencies && (
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="dependencies">
                <AccordionTrigger className="text-sm py-2">
                  <div className="flex items-center gap-2">
                    <Link className="w-4 h-4 text-indigo-500" />
                    <span>依赖关系</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    {measure.dependencies.prerequisiteMeasures && measure.dependencies.prerequisiteMeasures.length > 0 && (
                      <div>
                        <p className="text-xs text-slate-500 mb-2">前置措施</p>
                        <div className="flex flex-wrap gap-1">
                          {measure.dependencies.prerequisiteMeasures.map((dep, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              <ChevronRight className="w-3 h-3 mr-1" />
                              {dep}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {measure.dependencies.externalDependencies && measure.dependencies.externalDependencies.length > 0 && (
                      <div>
                        <p className="text-xs text-slate-500 mb-2">外部依赖</p>
                        <div className="flex flex-wrap gap-1">
                          {measure.dependencies.externalDependencies.map((dep, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {dep}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}

          {/* 风险与缓解 */}
          {measure.risks && measure.risks.length > 0 && (
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="risks">
                <AccordionTrigger className="text-sm py-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <span>风险与缓解 ({measure.risks.length}项)</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 pt-2">
                    {measure.risks.map((risk, idx) => (
                      <div key={idx} className="space-y-2">
                        <Alert variant="destructive" className="py-2">
                          <AlertTriangle className="w-4 h-4" />
                          <AlertTitle className="text-sm">风险</AlertTitle>
                          <AlertDescription className="text-sm">{risk.risk}</AlertDescription>
                        </Alert>
                        <div className="flex gap-2 items-start pl-4">
                          <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs text-slate-500">缓解措施</p>
                            <p className="text-sm text-slate-700">{risk.mitigation}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}

          {/* KPI指标 */}
          {measure.kpiMetrics && measure.kpiMetrics.length > 0 && (
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="kpis">
                <AccordionTrigger className="text-sm py-2">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-indigo-500" />
                    <span>KPI指标 ({measure.kpiMetrics.length}项)</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 pt-2">
                    {measure.kpiMetrics.map((kpi, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <Target className="w-4 h-4 text-indigo-500" />
                          <p className="text-sm font-medium">{kpi.metric}</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-6">
                          <div>
                            <p className="text-xs text-slate-500">目标值</p>
                            <p className="text-sm text-emerald-600 font-medium">{kpi.target}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">测量方法</p>
                            <p className="text-sm text-slate-700">{kpi.measurementMethod}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// 简化版措施卡片组件
interface SimpleMeasureCardProps {
  improvement: Improvement
  index: number
  config: { variant: 'default' | 'destructive' | 'secondary' | 'outline', icon: string; text: string }
}

function SimpleMeasureCard({ improvement, index, config }: SimpleMeasureCardProps) {
  return (
    <Card className="border-l-4 border-l-indigo-500">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <span>{config.icon}</span>
          <CardTitle className="text-lg">{index + 1}. {improvement.area}</CardTitle>
          <Badge variant={config.variant}>{config.text}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* 改进措施 */}
          <div>
            <p className="text-sm text-slate-500 mb-2 flex items-center gap-1">
              <BarChart3 className="w-4 h-4" />
              改进措施 ({improvement.actions.length}项)
            </p>
            <ul className="space-y-1">
              {improvement.actions.map((action, actionIndex) => (
                <li key={actionIndex} className="flex items-start gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 详细信息 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {improvement.timeline && (
              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-indigo-500 mt-0.5" />
                <div>
                  <p className="text-xs text-slate-500">时间周期</p>
                  <p className="text-sm font-medium">{improvement.timeline}</p>
                </div>
              </div>
            )}
            {improvement.resources && (
              <div className="flex items-start gap-2">
                <Users className="w-4 h-4 text-emerald-500 mt-0.5" />
                <div>
                  <p className="text-xs text-slate-500">所需资源</p>
                  <p className="text-sm font-medium">{improvement.resources}</p>
                </div>
              </div>
            )}
            {improvement.expectedOutcome && (
              <div className="flex items-start gap-2">
                <Rocket className="w-4 h-4 text-amber-500 mt-0.5" />
                <div>
                  <p className="text-xs text-slate-500">预期成果</p>
                  <p className="text-sm font-medium">{improvement.expectedOutcome}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
