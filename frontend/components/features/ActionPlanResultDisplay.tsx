'use client'

/**
 * 改进措施结果展示组件
 * 展示完整的改进措施计划，支持导出功能
 */

import { useState, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Chip from '@mui/material/Chip'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import LinearProgress from '@mui/material/LinearProgress'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import ListItemIcon from '@mui/material/ListItemIcon'
import DownloadIcon from '@mui/icons-material/Download'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ClockIcon from '@mui/icons-material/AccessTime'
import TeamIcon from '@mui/icons-material/Group'
import DollarIcon from '@mui/icons-material/AttachMoney'
import RocketIcon from '@mui/icons-material/Rocket'
import SafetyIcon from '@mui/icons-material/Security'
import ThunderIcon from '@mui/icons-material/FlashOn'
import ChartIcon from '@mui/icons-material/BarChart'
import LightbulbIcon from '@mui/icons-material/Lightbulb'
import type { GenerationResult } from '@/lib/types/ai-generation'

interface Improvement {
  area: string
  actions: string[]
  priority: string
  timeline?: string
  resources?: string
  targetLevel?: string
  currentLevel?: string
  expectedOutcome?: string
  // 详细字段（如果存在）
  _detail?: {
    title: string
    description: string
    implementationSteps?: Array<{
      stepNumber: number
      title: string
      description: string
      duration: string
    }>
    responsibleDepartment?: string
    expectedImprovement?: number
    resourcesNeeded?: {
      budget?: string
      personnel?: string[]
      technology?: string[]
      training?: string
    }
    dependencies?: {
      prerequisiteMeasures?: string[]
      externalDependencies?: string[]
    }
    risks?: Array<{
      risk: string
      mitigation: string
    }>
    kpiMetrics?: Array<{
      metric: string
      target: string
      measurementMethod: string
    }>
  }
}

interface ActionPlanResultDisplayProps {
  result: GenerationResult
  detailedMeasures?: any[] // 详细措施列表（90条）
}

export default function ActionPlanResultDisplay({ result, detailedMeasures }: ActionPlanResultDisplayProps) {
  // 如果有详细的措施列表（90条），优先使用；否则使用简化的improvements
  const useDetailedMeasures = detailedMeasures && detailedMeasures.length > 0

  const improvements: Improvement[] = result.selectedResult?.improvements || []
  const summary = result.selectedResult?.summary || ''
  const metadata = result.selectedResult?.metadata || {}
  const totalMeasures = useDetailedMeasures ? detailedMeasures.length : (result.selectedResult?.totalMeasures || improvements.length)

  // 优先级配置
  const getPriorityConfig = (priority: string) => {
    const configs = {
      高: { color: 'error' as const, icon: '🔴', text: '高优先级' },
      中: { color: 'warning' as const, icon: '🟡', text: '中优先级' },
      低: { color: 'info' as const, icon: '🟢', text: '低优先级' },
    }
    return configs[priority as keyof typeof configs] || { color: 'default' as const, icon: '⚪', text: priority }
  }

  // ========================================
  // 两层导航状态管理
  // ========================================
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(new Set())
  const [expandedAllCategories, setExpandedAllCategories] = useState<Set<string>>(new Set())
  const [expandedAll, setExpandedAll] = useState(false)
  const [highlightedCluster, setHighlightedCluster] = useState<string | null>(null)

  // ========================================
  // 层级数据处理
  // ========================================
  const categoryHierarchy = useMemo(() => {
    if (!useDetailedMeasures || !detailedMeasures || detailedMeasures.length === 0) {
      return []
    }

    const hardcodedCategories = [
      {
        id: 'category_1',
        name: '安全治理与组织建设',
        description: '该类别涵盖了数据安全治理的顶层设计、组织架构建设、职责分工以及合规性要求。',
        clusters: [
          { id: 'cluster_1_1', name: '总则、合规原则与适用范围' },
          { id: 'cluster_1_2', name: '组织架构与职责分工' },
          { id: 'cluster_1_3', name: '制度建设与人员培训' }
        ]
      },
      {
        id: 'category_2',
        name: '数据全生命周期管理',
        description: '该类别详细规定了数据从产生到销毁全过程中的安全管理要求。',
        clusters: [
          { id: 'cluster_2_1', name: '数据分类分级管理' },
          { id: 'cluster_2_2', name: '数据收集与外部引入' },
          { id: 'cluster_2_3', name: '数据使用、加工与展示' },
          { id: 'cluster_2_4', name: '数据共享、提供与出境' },
          { id: 'cluster_2_5', name: '数据公开、销毁与个人信息保护' }
        ]
      },
      {
        id: 'category_3',
        name: '技术保护与系统安全',
        description: '该类别侧重于保障数据安全的技术措施和系统建设要求。',
        clusters: [
          { id: 'cluster_3_1', name: '访问控制与身份认证' },
          { id: 'cluster_3_2', name: '数据加密、存储与备份' },
          { id: 'cluster_3_3', name: '传输安全与接口管理' },
          { id: 'cluster_3_4', name: '系统开发、日志审计与基础设施' },
          { id: 'cluster_3_5', name: '人工智能与算法安全' }
        ]
      },
      {
        id: 'category_4',
        name: '风险监测、审计与应急响应',
        description: '该类别涉及对数据安全风险的持续监控、定期审计以及突发安全事件的应急处置。',
        clusters: [
          { id: 'cluster_4_1', name: '风险监测与评估' },
          { id: 'cluster_4_2', name: '应急响应与事件处置' },
          { id: 'cluster_4_3', name: '监督检查与法律责任' }
        ]
      }
    ]

    const existingClusterNames = new Set(detailedMeasures.map((m: any) => m.clusterName))

    return hardcodedCategories
      .map(cat => ({
        ...cat,
        clusters: cat.clusters.filter(cluster => existingClusterNames.has(cluster.name))
      }))
      .filter(cat => cat.clusters.length > 0)
  }, [detailedMeasures, useDetailedMeasures])

  // 计算每个分类和聚类的统计数据
  const categoryStats = useMemo(() => {
    if (!useDetailedMeasures || !detailedMeasures || detailedMeasures.length === 0) {
      return []
    }

    return categoryHierarchy.map((category: any) => {
      const clusterNames = category.clusters.map((c: any) => c.name)
      const categoryMeasures = detailedMeasures.filter((m: any) =>
        clusterNames.includes(m.clusterName)
      )

      const avgCurrent = categoryMeasures.length > 0
        ? categoryMeasures.reduce((sum: number, m: any) => sum + m.currentLevel, 0) / categoryMeasures.length
        : 0
      const avgTarget = categoryMeasures.length > 0
        ? categoryMeasures.reduce((sum: number, m: any) => sum + m.targetLevel, 0) / categoryMeasures.length
        : 0

      const clustersWithStats = category.clusters.map((cluster: any) => {
        const clusterMeasures = detailedMeasures.filter((m: any) => m.clusterName === cluster.name)
        const clusterAvgCurrent = clusterMeasures.length > 0
          ? clusterMeasures.reduce((sum: number, m: any) => sum + m.currentLevel, 0) / clusterMeasures.length
          : 0
        const clusterAvgTarget = clusterMeasures.length > 0
          ? clusterMeasures.reduce((sum: number, m: any) => sum + m.targetLevel, 0) / clusterMeasures.length
          : 0

        const highPriority = clusterMeasures.filter((m: any) => m.priority === 'high').length
        const mediumPriority = clusterMeasures.filter((m: any) => m.priority === 'medium').length
        const lowPriority = clusterMeasures.filter((m: any) => m.priority === 'low').length

        return {
          ...cluster,
          measureCount: clusterMeasures.length,
          avgCurrent: clusterAvgCurrent.toFixed(1),
          avgTarget: clusterAvgTarget.toFixed(1),
          avgGap: (clusterAvgTarget - clusterAvgCurrent).toFixed(1),
          highPriority,
          mediumPriority,
          lowPriority
        }
      })

      return {
        ...category,
        measureCount: categoryMeasures.length,
        avgCurrent: avgCurrent.toFixed(1),
        avgTarget: avgTarget.toFixed(1),
        avgGap: (avgTarget - avgCurrent).toFixed(1),
        clusters: clustersWithStats
      }
    })
  }, [categoryHierarchy, detailedMeasures, useDetailedMeasures])

  // ========================================
  // 交互处理函数
  // ========================================
  const handleCategoryExpand = (categoryName: string) => {
    if (expandedCategory === categoryName) {
      setExpandedCategory(null)
    } else {
      setExpandedCategory(categoryName)
    }
  }

  const handleExpandAllInCategory = (categoryName: string) => {
    const newExpanded = new Set(expandedAllCategories)
    if (newExpanded.has(categoryName)) {
      newExpanded.delete(categoryName)
    } else {
      newExpanded.add(categoryName)
    }
    setExpandedAllCategories(newExpanded)
  }

  const handleExpandAll = () => {
    if (expandedAll) {
      setExpandedAll(false)
      setExpandedAllCategories(new Set())
      setExpandedClusters(new Set())
    } else {
      setExpandedAll(true)
      const allCategories = new Set(categoryHierarchy.map((cat: any) => cat.name))
      setExpandedAllCategories(allCategories)
      const allClusters = new Set((detailedMeasures || []).map((m: any) => m.clusterName))
      setExpandedClusters(allClusters)
    }
  }

  const handleClusterExpand = (clusterName: string) => {
    const newExpanded = new Set(expandedClusters)
    if (newExpanded.has(clusterName)) {
      newExpanded.delete(clusterName)
    } else {
      newExpanded.add(clusterName)
    }
    setExpandedClusters(newExpanded)
    setHighlightedCluster(clusterName)

    setTimeout(() => {
      const element = document.getElementById(`cluster-measures-${clusterName}`)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 100)
  }

  const shouldShowClusterMeasures = (clusterName: string, categoryName?: string) => {
    if (expandedAll) return true
    if (categoryName && expandedAllCategories.has(categoryName)) return true
    if (expandedClusters.has(clusterName)) return true
    return false
  }

  // 导出为 CSV
  const handleExportCSV = () => {
    try {
      const csvRows: string[] = []

      if (useDetailedMeasures && detailedMeasures) {
        csvRows.push([
          '序号',
          '聚类',
          '优先级',
          '措施标题',
          '措施描述',
          '当前级别',
          '目标级别',
          '差距',
          '预期提升',
          '时间周期',
          '负责部门',
          '预算',
          '人员',
          '技术/工具',
          '外部依赖',
          '风险',
          '缓解措施'
        ].join(','))

        detailedMeasures.forEach((measure, index) => {
          const config = getPriorityConfig(measure.priority === 'high' ? '高' : measure.priority === 'medium' ? '中' : '低')

          const budget = measure.resourcesNeeded?.budget || '-'
          const personnel = measure.resourcesNeeded?.personnel?.join('; ') || '-'
          const technology = measure.resourcesNeeded?.technology?.join('; ') || '-'
          const externalDeps = measure.dependencies?.externalDependencies?.join('; ') || '-'
          const risks = measure.risks?.map((r: any) => r.risk).join('; ') || '-'
          const mitigations = measure.risks?.map((r: any) => r.mitigation).join('; ') || '-'

          const csvRow = [
            index + 1,
            `"${(measure.clusterName || '').replace(/"/g, '""')}"`,
            config.text,
            `"${(measure.title || '').replace(/"/g, '""')}"`,
            `"${(measure.description || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
            measure.currentLevel,
            measure.targetLevel,
            measure.gap,
            measure.expectedImprovement || '-',
            `"${(measure.timeline || '').replace(/"/g, '""')}"`,
            `"${(measure.responsibleDepartment || '').replace(/"/g, '""')}"`,
            `"${budget.replace(/"/g, '""')}"`,
            `"${personnel.replace(/"/g, '""')}"`,
            `"${technology.replace(/"/g, '""')}"`,
            `"${externalDeps.replace(/"/g, '""')}"`,
            `"${risks.replace(/"/g, '""')}"`,
            `"${mitigations.replace(/"/g, '""')}"`,
          ]
          csvRows.push(csvRow.join(','))
        })
      } else {
        csvRows.push('优先级,领域,当前级别,目标级别,时间周期,所需资源,预期成果,改进措施')

        improvements.forEach((improvement) => {
          const config = getPriorityConfig(improvement.priority)
          const actions = improvement.actions.join('; ')
          const csvRow = [
            config.text,
            improvement.area,
            improvement.currentLevel || '-',
            improvement.targetLevel || '-',
            improvement.timeline || '-',
            `"${(improvement.resources || '').replace(/"/g, '""')}"`,
            `"${(improvement.expectedOutcome || '').replace(/"/g, '""')}"`,
            `"${actions.replace(/"/g, '""')}"`,
          ]
          csvRows.push(csvRow.join(','))
        })
      }

      const csvContent = csvRows.join('\n')
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `action_plan_${result.taskId}.csv`
      link.click()
      URL.revokeObjectURL(url)

      toast.success('改进措施已导出为CSV文件！')
    } catch (error) {
      toast.error('导出失败：' + (error instanceof Error ? error.message : '未知错误'))
    }
  }

  // 导出为 Word
  const handleExportWord = () => {
    try {
      let htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>数据安全改进措施计划</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; }
            h1 { color: #1976d2; }
            h2 { color: #262626; margin-top: 30px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #d9d9d9; padding: 12px; text-align: left; }
            th { background-color: #fafafa; font-weight: bold; }
            .priority-high { background-color: #fff1f0; }
            .priority-medium { background-color: #fffbe6; }
            .priority-low { background-color: #e6f7ff; }
          </style>
        </head>
        <body>
          <h1>数据安全改进措施计划</h1>
          <p><strong>生成时间：</strong>${new Date().toLocaleString('zh-CN')}</p>
          <p><strong>概述：</strong>${summary}</p>
          <p><strong>总措施数：</strong>${totalMeasures}</p>
          <p><strong>时间周期：</strong>${metadata.timeline || '-'}</p>

          <h2>改进措施详情</h2>
          <table>
            <thead>
              <tr>
                <th>优先级</th>
                <th>领域</th>
                <th>当前级别</th>
                <th>目标级别</th>
                <th>改进措施</th>
                <th>时间周期</th>
                <th>所需资源</th>
                <th>预期成果</th>
              </tr>
            </thead>
            <tbody>
      `

      improvements.forEach((improvement) => {
        const config = getPriorityConfig(improvement.priority)
        htmlContent += `
              <tr class="priority-${improvement.priority}">
                <td>${config.text}</td>
                <td>${improvement.area}</td>
                <td>${improvement.currentLevel || '-'}</td>
                <td>${improvement.targetLevel || '-'}</td>
                <td>${improvement.actions.join('<br>')}</td>
                <td>${improvement.timeline || '-'}</td>
                <td>${improvement.resources || '-'}</td>
                <td>${improvement.expectedOutcome || '-'}</td>
              </tr>
        `
      })

      htmlContent += `
            </tbody>
          </table>
        </body>
        </html>
      `

      const blob = new Blob([htmlContent], { type: 'application/msword' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `action_plan_${result.taskId}.doc`
      link.click()
      URL.revokeObjectURL(url)

      toast.success('改进措施已导出为Word文件！')
    } catch (error) {
      toast.error('导出失败：' + (error instanceof Error ? error.message : '未知错误'))
    }
  }

  // 导出为 Excel
  const handleExportExcel = () => {
    try {
      if (!useDetailedMeasures || !detailedMeasures || detailedMeasures.length === 0) {
        toast.warning('请先生成详细改进措施后再导出 Excel')
        return
      }

      const workbook = XLSX.utils.book_new()
      const sheetNames: string[] = []
      const sheets: XLSX.WorkSheet[] = []

      // Sheet 1: 概览统计
      const overviewData = [
        ['成熟度改进措施计划'],
        ['生成时间', new Date().toLocaleString('zh-CN')],
        [''],
        ['📊 成熟度概览'],
        ['指标', '数值'],
        ['当前成熟度',
          (detailedMeasures.map(m => m.currentLevel).reduce((a, b) => a + b, 0) / detailedMeasures.length).toFixed(2) + '分'
        ],
        ['目标成熟度',
          (detailedMeasures.map(m => m.targetLevel).reduce((a, b) => a + b, 0) / detailedMeasures.length).toFixed(2) + '分'
        ],
        ['平均差距',
          (detailedMeasures.map(m => m.gap).reduce((a, b) => a + b, 0) / detailedMeasures.length).toFixed(2) + '分'
        ],
        ['预期总提升',
          (detailedMeasures.map(m => m.expectedImprovement || 0).reduce((a, b) => a + b, 0)).toFixed(2) + '分'
        ],
        [''],
        ['📈 措施统计'],
        ['总措施数', detailedMeasures.length + '条'],
        ['聚类数量', Array.from(new Set(detailedMeasures.map(m => m.clusterName))).length + '个'],
        ['高优先级', detailedMeasures.filter(m => m.priority === 'high').length + '条'],
        ['中优先级', detailedMeasures.filter(m => m.priority === 'medium').length + '条'],
        ['低优先级', detailedMeasures.filter(m => m.priority === 'low').length + '条'],
      ]
      const overviewSheet = XLSX.utils.aoa_to_sheet(overviewData)
      sheetNames.push('概览统计')
      sheets.push(overviewSheet)

      // Sheet 2: 措施汇总表
      const summaryData = [
        ['序号', '聚类', '优先级', '措施标题', '当前级别', '目标级别', '差距', '预期提升', '时间周期', '负责部门', '预算', '人员'],
        ...detailedMeasures.map((measure, index) => [
          index + 1,
          measure.clusterName || '',
          measure.priority === 'high' ? '高' : measure.priority === 'medium' ? '中' : '低',
          measure.title || '',
          measure.currentLevel,
          measure.targetLevel,
          measure.gap,
          measure.expectedImprovement || '-',
          measure.timeline || '-',
          measure.responsibleDepartment || '-',
          measure.resourcesNeeded?.budget || '-',
          measure.resourcesNeeded?.personnel?.join('; ') || '-',
        ])
      ]
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
      sheetNames.push('措施汇总')
      sheets.push(summarySheet)

      // Sheet 3-N: 按聚类分组的详细措施
      const uniqueClusters = Array.from(new Set(detailedMeasures.map(m => m.clusterName)))
      uniqueClusters.forEach((clusterName, clusterIndex) => {
        const clusterMeasures = detailedMeasures.filter(m => m.clusterName === clusterName)
        const avgCurrent = (clusterMeasures.reduce((sum, m) => sum + m.currentLevel, 0) / clusterMeasures.length).toFixed(2)
        const avgTarget = (clusterMeasures.reduce((sum, m) => sum + m.targetLevel, 0) / clusterMeasures.length).toFixed(2)
        const avgGap = (parseFloat(avgTarget) - parseFloat(avgCurrent)).toFixed(2)

        const clusterData = [
          [`${clusterIndex + 1}. ${clusterName}`],
          [''],
          ['📊 聚类成熟度'],
          ['当前成熟度', avgCurrent + '分'],
          ['目标成熟度', avgTarget + '分'],
          ['差距', avgGap + '分'],
          ['措施数量', clusterMeasures.length + '条'],
          [''],
          ['📋 详细措施列表'],
          [],
          ['序号', '优先级', '措施标题', '措施描述', '当前级别', '目标级别', '差距', '预期提升', '时间周期', '负责部门', '预算', '人员', '技术/工具', '外部依赖', '风险', '缓解措施'],
          ...clusterMeasures.map((measure, index) => {
            const risks = measure.risks || []
            const riskText = risks.map((r: any) => r.risk).join('; ')
            const mitigationText = risks.map((r: any) => r.mitigation).join('; ')

            return [
              index + 1,
              measure.priority === 'high' ? '高' : measure.priority === 'medium' ? '中' : '低',
              measure.title || '',
              (measure.description || '').replace(/\n/g, ' '),
              measure.currentLevel,
              measure.targetLevel,
              measure.gap,
              measure.expectedImprovement || '-',
              measure.timeline || '-',
              measure.responsibleDepartment || '-',
              measure.resourcesNeeded?.budget || '-',
              measure.resourcesNeeded?.personnel?.join('; ') || '-',
              measure.resourcesNeeded?.technology?.join('; ') || '-',
              measure.dependencies?.externalDependencies?.join('; ') || '-',
              riskText || '-',
              mitigationText || '-',
            ]
          })
        ]

        const clusterSheet = XLSX.utils.aoa_to_sheet(clusterData)
        sheetNames.push(clusterName.length > 31 ? clusterName.substring(0, 31) : clusterName)
        sheets.push(clusterSheet)
      })

      // Sheet N+1: 实施步骤汇总
      const implementationSteps: any[][] = []
      detailedMeasures.forEach((measure) => {
        if (measure.implementationSteps && measure.implementationSteps.length > 0) {
          measure.implementationSteps.forEach((step: any) => {
            implementationSteps.push([
              measure.clusterName || '-',
              measure.title || '-',
              step.stepNumber,
              step.title,
              step.description,
              step.duration,
            ])
          })
        }
      })

      const stepsData = [
        ['聚类', '措施', '步骤号', '步骤标题', '步骤描述', '预计耗时'],
        ...implementationSteps
      ]
      const stepsSheet = XLSX.utils.aoa_to_sheet(stepsData)
      sheetNames.push('实施步骤')
      sheets.push(stepsSheet)

      // Sheet N+2: 资源与KPI汇总
      const resourceData = [
        ['聚类', '措施', '优先级', '负责部门', '预算', '人员', '技术/工具', 'KPI指标', '目标值', '测量方法'],
        ...detailedMeasures.map((measure) => {
          const kpi = measure.kpiMetrics && measure.kpiMetrics.length > 0
            ? measure.kpiMetrics[0]
            : { metric: '-', target: '-', measurementMethod: '-' }

          return [
            measure.clusterName || '-',
            measure.title || '-',
            measure.priority === 'high' ? '高' : measure.priority === 'medium' ? '中' : '低',
            measure.responsibleDepartment || '-',
            measure.resourcesNeeded?.budget || '-',
            measure.resourcesNeeded?.personnel?.join('; ') || '-',
            measure.resourcesNeeded?.technology?.join('; ') || '-',
            kpi.metric,
            kpi.target,
            kpi.measurementMethod,
          ]
        })
      ]
      const resourceSheet = XLSX.utils.aoa_to_sheet(resourceData)
      sheetNames.push('资源与KPI')
      sheets.push(resourceSheet)

      sheets.forEach((sheet, index) => {
        XLSX.utils.book_append_sheet(workbook, sheet, sheetNames[index])
      })

      const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '')
      XLSX.writeFile(workbook, `成熟度改进措施计划_${dateStr}.xlsx`)

      toast.success('改进措施已导出为 Excel 文件（多 Sheet 格式）！')
    } catch (error) {
      console.error('Excel 导出错误:', error)
      toast.error('导出失败：' + (error instanceof Error ? error.message : '未知错误'))
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* 概述信息 */}
      {summary && (
        <Alert severity="info" icon={<RocketIcon />}>
          <Typography variant="subtitle1" fontWeight="bold">改进措施概述</Typography>
          <Typography variant="body2">{summary}</Typography>
        </Alert>
      )}

      {/* 成熟度概览统计 */}
      {useDetailedMeasures && detailedMeasures.length > 0 && (
        <Card>
          <CardHeader title="📊 成熟度概览" />
          <CardContent>
            <Grid container spacing={2}>
              <Grid size={{ xs: 6, md: 3 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary">当前成熟度</Typography>
                  <Typography variant="h4" fontWeight="bold" color="error.main">
                    {(() => {
                      const scores = detailedMeasures.map(m => m.currentLevel)
                      return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)
                    })()}
                  </Typography>
                  <Typography variant="caption">分</Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary">目标成熟度</Typography>
                  <Typography variant="h4" fontWeight="bold" color="success.main">
                    {(() => {
                      const scores = detailedMeasures.map(m => m.targetLevel)
                      return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)
                    })()}
                  </Typography>
                  <Typography variant="caption">分</Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary">平均差距</Typography>
                  <Typography variant="h4" fontWeight="bold" color="warning.main">
                    {(() => {
                      const gaps = detailedMeasures.map(m => m.gap)
                      return (gaps.reduce((a, b) => a + b, 0) / gaps.length).toFixed(2)
                    })()}
                  </Typography>
                  <Typography variant="caption">分</Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary">预期总提升</Typography>
                  <Typography variant="h4" fontWeight="bold" color="info.main">
                    {(() => {
                      const improvements = detailedMeasures.map(m => m.expectedImprovement || 0)
                      return (improvements.reduce((a, b) => a + b, 0)).toFixed(2)
                    })()}
                  </Typography>
                  <Typography variant="caption">分</Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* 两层导航 */}
      {useDetailedMeasures && detailedMeasures.length > 0 && categoryStats.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Card>
            <CardHeader title="📁 一层分类导航" />
            <CardContent>
              <Stack spacing={2}>
                {categoryStats.map((category: any, catIndex: number) => {
                  const isExpanded = expandedCategory === category.name
                  const isExpandedAll = expandedAllCategories.has(category.name)
                  const categoryIcon = ['🛡️', '🔄', '🔐', '📊'][catIndex] || '📋'

                  return (
                    <Box key={category.id}>
                      <Card
                        variant="outlined"
                        sx={{
                          cursor: 'pointer',
                          borderColor: isExpanded ? 'primary.main' : 'divider',
                          bgcolor: isExpanded ? 'primary.50' : 'background.paper',
                          transition: 'all 0.3s',
                        }}
                        onClick={() => handleCategoryExpand(category.name)}
                      >
                        <CardContent>
                          <Stack spacing={1}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Typography variant="h6">{categoryIcon}</Typography>
                                <Typography variant="h6">{category.name}</Typography>
                              </Stack>
                              <Stack direction="row" spacing={1}>
                                <Button
                                  variant="text"
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleExpandAllInCategory(category.name)
                                  }}
                                >
                                  {isExpandedAll ? '收起' : '展开所有'}
                                </Button>
                                <Button
                                  variant="text"
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleCategoryExpand(category.name)
                                  }}
                                >
                                  {isExpanded ? '▲' : '▼'}
                                </Button>
                              </Stack>
                            </Box>

                            <Typography variant="body2" color="text.secondary">
                              {category.description}
                            </Typography>

                            <Card variant="outlined" sx={{ bgcolor: 'grey.50' }}>
                              <CardContent>
                                <Grid container spacing={2}>
                                  <Grid size={{ xs: 6, md: 3 }}>
                                    <Box sx={{ textAlign: 'center' }}>
                                      <Typography variant="caption" color="text.secondary">当前成熟度</Typography>
                                      <Typography variant="h6" fontWeight="bold" color="error.main">
                                        {category.avgCurrent}
                                      </Typography>
                                    </Box>
                                  </Grid>
                                  <Grid size={{ xs: 6, md: 3 }}>
                                    <Box sx={{ textAlign: 'center' }}>
                                      <Typography variant="caption" color="text.secondary">目标成熟度</Typography>
                                      <Typography variant="h6" fontWeight="bold" color="success.main">
                                        {category.avgTarget}
                                      </Typography>
                                    </Box>
                                  </Grid>
                                  <Grid size={{ xs: 6, md: 3 }}>
                                    <Box sx={{ textAlign: 'center' }}>
                                      <Typography variant="caption" color="text.secondary">平均差距</Typography>
                                      <Typography variant="h6" fontWeight="bold" color="warning.main">
                                        {category.avgGap}
                                      </Typography>
                                    </Box>
                                  </Grid>
                                  <Grid size={{ xs: 6, md: 3 }}>
                                    <Box sx={{ textAlign: 'center' }}>
                                      <Typography variant="caption" color="text.secondary">措施数量</Typography>
                                      <Typography variant="h6" fontWeight="bold" color="info.main">
                                        {category.measureCount}条
                                      </Typography>
                                    </Box>
                                  </Grid>
                                </Grid>
                              </CardContent>
                            </Card>

                            <Typography variant="caption" color="text.secondary" textAlign="center">
                              包含 {category.clusters.length} 个聚类
                              {isExpanded ? ' [点击收起]' : ' [点击展开]'}
                            </Typography>
                          </Stack>
                        </CardContent>
                      </Card>

                      {/* 二层聚类导航 */}
                      {isExpanded && (
                        <Card
                          variant="outlined"
                          sx={{
                            mt: 1,
                            ml: 2,
                            bgcolor: 'grey.50',
                            borderLeft: 3,
                            borderLeftColor: 'primary.main',
                          }}
                        >
                          <CardContent>
                            <Typography variant="subtitle2" color="primary.main" gutterBottom>
                              📂 {category.name} - 二层聚类导航
                            </Typography>
                            <Grid container spacing={2}>
                              {category.clusters.map((cluster: any, clusterIndex: number) => {
                                const isClusterExpanded = expandedClusters.has(cluster.name)

                                return (
                                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key={cluster.id}>
                                    <Card
                                      variant="outlined"
                                      sx={{
                                        cursor: 'pointer',
                                        borderColor: isClusterExpanded ? 'warning.main' : 'divider',
                                        bgcolor: isClusterExpanded ? 'warning.50' : 'background.paper',
                                        transition: 'all 0.3s',
                                      }}
                                      onClick={() => handleClusterExpand(cluster.name)}
                                    >
                                      <CardContent>
                                        <Stack spacing={1}>
                                          <Typography variant="subtitle2" fontWeight="medium">
                                            {clusterIndex + 1}. {cluster.name}
                                          </Typography>

                                          <Box sx={{
                                            p: 1,
                                            bgcolor: 'grey.100',
                                            borderRadius: 1,
                                            border: 1,
                                            borderColor: 'divider',
                                          }}>
                                            <Typography variant="caption" display="block">
                                              当前: {cluster.avgCurrent} → 目标: {cluster.avgTarget}
                                            </Typography>
                                            <Typography variant="caption" color="warning.main" fontWeight="bold">
                                              差距: {cluster.avgGap}
                                            </Typography>
                                          </Box>

                                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Chip label={`${cluster.measureCount} 条措施`} color="primary" size="small" />
                                            <Stack direction="row" spacing={0.5}>
                                              {cluster.highPriority > 0 && <Chip label={`高: ${cluster.highPriority}`} color="error" size="small" />}
                                              {cluster.mediumPriority > 0 && <Chip label={`中: ${cluster.mediumPriority}`} color="warning" size="small" />}
                                              {cluster.lowPriority > 0 && <Chip label={`低: ${cluster.lowPriority}`} color="info" size="small" />}
                                            </Stack>
                                          </Box>

                                          <Button variant="contained" size="small" fullWidth>
                                            {isClusterExpanded ? '收起措施' : '查看措施'}
                                          </Button>
                                        </Stack>
                                      </CardContent>
                                    </Card>
                                  </Grid>
                                )
                              })}
                            </Grid>
                          </CardContent>
                        </Card>
                      )}
                    </Box>
                  )
                })}
              </Stack>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* 统计概览 */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Box sx={{ textAlign: 'center' }}>
                <SafetyIcon color="success" sx={{ fontSize: 40 }} />
                <Typography variant="h4" fontWeight="bold" color="success.main">
                  {useDetailedMeasures
                    ? Array.from(new Set(detailedMeasures.map(m => m.clusterName))).length
                    : improvements.length
                  }
                </Typography>
                <Typography variant="body2" color="text.secondary">改进领域</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Box sx={{ textAlign: 'center' }}>
                <CheckCircleIcon color="primary" sx={{ fontSize: 40 }} />
                <Typography variant="h4" fontWeight="bold" color="primary.main">
                  {totalMeasures}
                </Typography>
                <Typography variant="body2" color="text.secondary">总措施数</Typography>
                {useDetailedMeasures && (
                  <Button
                    variant="text"
                    size="small"
                    onClick={handleExpandAll}
                    sx={{ mt: 1 }}
                  >
                    {expandedAll ? '收起所有' : '展开所有'}
                  </Button>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Box sx={{ textAlign: 'center' }}>
                <ThunderIcon color="error" sx={{ fontSize: 40 }} />
                <Typography variant="h4" fontWeight="bold" color="error.main">
                  {useDetailedMeasures
                    ? detailedMeasures.filter(m => m.priority === 'high').length
                    : improvements.filter(i => i.priority === '高').length
                  }
                </Typography>
                <Typography variant="body2" color="text.secondary">高优先级</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 元数据 */}
      {metadata.timeline && (
        <Card>
          <CardHeader title="实施计划" />
          <CardContent>
            <Grid container spacing={2}>
              <Grid size={{ xs: 6, md: 3 }}>
                <Typography variant="caption" color="text.secondary">时间周期</Typography>
                <Typography variant="body1">{metadata.timeline}</Typography>
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <Typography variant="caption" color="text.secondary">聚类数量</Typography>
                <Typography variant="body1">{metadata.clusterCount || '-'}</Typography>
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <Typography variant="caption" color="text.secondary">生成时间</Typography>
                <Typography variant="body1">
                  {metadata.generatedAt ? new Date(metadata.generatedAt).toLocaleString('zh-CN') : '-'}
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* 导出按钮 */}
      <Card>
        <CardContent>
          <Stack direction="row" spacing={2}>
            <Button variant="contained" startIcon={<DownloadIcon />} onClick={handleExportCSV}>
              导出CSV
            </Button>
            <Button variant="contained" startIcon={<DownloadIcon />} onClick={handleExportExcel} sx={{ bgcolor: '#217346', '&:hover': { bgcolor: '#1a5c38' } }}>
              导出Excel
            </Button>
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleExportWord}>
              导出Word
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* 改进措施列表 */}
      <Card>
        <CardHeader title="改进措施详情" />
        <CardContent>
          <Stack spacing={3}>
            {useDetailedMeasures ? (
              categoryStats.map((category: any) =>
                category.clusters.map((cluster: any, clusterIndex: number) => {
                  const clusterMeasures = detailedMeasures.filter((m: any) => m.clusterName === cluster.name)
                  const isHighlighted = highlightedCluster === cluster.name
                  const showMeasures = shouldShowClusterMeasures(cluster.name, category.name)

                  return (
                    <Box
                      key={cluster.name}
                      id={`cluster-measures-${cluster.name}`}
                      sx={{ scrollMarginTop: 100 }}
                    >
                      {/* 聚类标题 */}
                      <Card
                        variant="outlined"
                        sx={{
                          mb: 2,
                          bgcolor: isHighlighted ? 'warning.50' : 'primary.50',
                          borderColor: isHighlighted ? 'warning.main' : 'primary.main',
                          borderLeftWidth: 4,
                          cursor: 'pointer',
                        }}
                        onClick={() => handleClusterExpand(cluster.name)}
                      >
                        <CardContent>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="h6" fontWeight="bold">
                              {clusterIndex + 1}. {cluster.name}
                            </Typography>
                            <Chip label={`${clusterMeasures.length} 条措施`} color="primary" size="small" />
                            {isHighlighted && <Chip label="🔍 正在查看" color="warning" size="small" />}
                            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                              {showMeasures ? '▼ 收起措施' : '▶ 展开措施'}
                            </Typography>
                          </Stack>
                        </CardContent>
                      </Card>

                      {/* 该聚类下的所有措施 */}
                      {showMeasures && clusterMeasures.map((measure: any, measureIndex: number) => {
                        const config = getPriorityConfig(measure.priority === 'high' ? '高' : measure.priority === 'medium' ? '中' : '低')

                        return (
                          <Card
                            key={`${cluster.name}-${measureIndex}`}
                            variant="outlined"
                            sx={{
                              mb: 2,
                              borderLeftWidth: 4,
                              borderLeftStyle: 'solid',
                              borderLeftColor: config.color === 'error' ? 'error.main' : config.color === 'warning' ? 'warning.main' : 'info.main',
                              bgcolor: isHighlighted ? 'warning.50' : 'inherit',
                            }}
                          >
                            <CardHeader
                              title={
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <Typography>{config.icon}</Typography>
                                  <Typography>{measureIndex + 1}. {measure.title}</Typography>
                                  <Chip label={config.text} color={config.color} size="small" />
                                </Stack>
                              }
                            />
                            <CardContent>
                              <Stack spacing={2}>
                                {/* 措施描述 */}
                                {measure.description && (
                                  <Alert severity="info" icon={<LightbulbIcon />}>
                                    {measure.description}
                                  </Alert>
                                )}

                                {/* 级别对比 */}
                                <Box>
                                  <Typography variant="body2" color="text.secondary" gutterBottom>
                                    成熟度提升路径
                                  </Typography>
                                  <LinearProgress
                                    variant="determinate"
                                    value={75}
                                    sx={{
                                      height: 10,
                                      borderRadius: 1,
                                      bgcolor: 'grey.200',
                                      '& .MuiLinearProgress-bar': {
                                        background: 'linear-gradient(90deg, #1976d2, #4caf50)',
                                      }
                                    }}
                                  />
                                  <Box sx={{ mt: 0.5 }}>
                                    <Chip label={measure.currentLevel.toFixed(1)} color="primary" size="small" />
                                    <Typography component="span" sx={{ mx: 1 }}>→</Typography>
                                    <Chip label={measure.targetLevel.toFixed(1)} color="success" size="small" />
                                    <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                                      差距: {measure.gap.toFixed(1)}
                                    </Typography>
                                  </Box>
                                </Box>

                                {/* 实施步骤 */}
                                {measure.implementationSteps && measure.implementationSteps.length > 0 && (
                                  <Box>
                                    <Typography variant="body2" color="text.secondary" gutterBottom>
                                      <ChartIcon fontSize="small" sx={{ mr: 0.5, verticalAlign: 'middle' }} />
                                      实施步骤 ({measure.implementationSteps.length}项)
                                    </Typography>
                                    <List dense>
                                      {measure.implementationSteps.map((step: any, stepIndex: number) => (
                                        <ListItem key={stepIndex}>
                                          <ListItemIcon>
                                            <CheckCircleIcon color="primary" fontSize="small" />
                                          </ListItemIcon>
                                          <ListItemText
                                            primary={`${step.stepNumber}. ${step.title}`}
                                            secondary={
                                              <>
                                                <Typography variant="caption" display="block">{step.description}</Typography>
                                                <Chip label={`预计耗时: ${step.duration}`} color="info" size="small" sx={{ mt: 0.5 }} />
                                              </>
                                            }
                                          />
                                        </ListItem>
                                      ))}
                                    </List>
                                  </Box>
                                )}

                                {/* 详细信息折叠面板 */}
                                <Accordion>
                                  {measure.responsibleDepartment && (
                                    <Accordion>
                                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                        <Stack direction="row" spacing={1} alignItems="center">
                                          <TeamIcon />
                                          <Typography>负责部门</Typography>
                                        </Stack>
                                      </AccordionSummary>
                                      <AccordionDetails>
                                        <Typography>{measure.responsibleDepartment}</Typography>
                                      </AccordionDetails>
                                    </Accordion>
                                  )}

                                  {measure.timeline && (
                                    <Accordion>
                                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                        <Stack direction="row" spacing={1} alignItems="center">
                                          <ClockIcon />
                                          <Typography>时间周期</Typography>
                                        </Stack>
                                      </AccordionSummary>
                                      <AccordionDetails>
                                        <Typography>{measure.timeline}</Typography>
                                      </AccordionDetails>
                                    </Accordion>
                                  )}

                                  {measure.resourcesNeeded && (
                                    <Accordion>
                                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                        <Stack direction="row" spacing={1} alignItems="center">
                                          <DollarIcon />
                                          <Typography>资源需求</Typography>
                                        </Stack>
                                      </AccordionSummary>
                                      <AccordionDetails>
                                        <Stack spacing={1}>
                                          {measure.resourcesNeeded.budget && (
                                            <Typography variant="body2">
                                              <strong>预算:</strong> {measure.resourcesNeeded.budget}
                                            </Typography>
                                          )}
                                          {measure.resourcesNeeded.personnel && measure.resourcesNeeded.personnel.length > 0 && (
                                            <Typography variant="body2">
                                              <strong>人员:</strong> {measure.resourcesNeeded.personnel.join(', ')}
                                            </Typography>
                                          )}
                                          {measure.resourcesNeeded.technology && measure.resourcesNeeded.technology.length > 0 && (
                                            <Box>
                                              <Typography variant="body2" component="span"><strong>技术/工具:</strong> </Typography>
                                              {measure.resourcesNeeded.technology.map((tech: string, i: number) => (
                                                <Chip key={i} label={tech} color="primary" size="small" sx={{ mr: 0.5 }} />
                                              ))}
                                            </Box>
                                          )}
                                          {measure.resourcesNeeded.training && (
                                            <Typography variant="body2">
                                              <strong>培训需求:</strong> {measure.resourcesNeeded.training}
                                            </Typography>
                                          )}
                                        </Stack>
                                      </AccordionDetails>
                                    </Accordion>
                                  )}

                                  {measure.risks && measure.risks.length > 0 && (
                                    <Accordion>
                                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                        <Typography color="error">⚠️ 风险与缓解</Typography>
                                      </AccordionSummary>
                                      <AccordionDetails>
                                        <List dense>
                                          {measure.risks.map((risk: any, i: number) => (
                                            <ListItem key={i}>
                                              <ListItemText
                                                primary={<Typography color="error" fontWeight="bold">风险: {risk.risk}</Typography>}
                                                secondary={<Typography color="success.main">✓ 缓解措施: {risk.mitigation}</Typography>}
                                              />
                                            </ListItem>
                                          ))}
                                        </List>
                                      </AccordionDetails>
                                    </Accordion>
                                  )}

                                  {measure.kpiMetrics && measure.kpiMetrics.length > 0 && (
                                    <Accordion>
                                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                        <Typography>📊 KPI指标</Typography>
                                      </AccordionSummary>
                                      <AccordionDetails>
                                        <Stack spacing={1}>
                                          {measure.kpiMetrics.map((kpi: any, i: number) => (
                                            <Card key={i} variant="outlined" sx={{ bgcolor: 'primary.50' }}>
                                              <CardContent>
                                                <Typography variant="subtitle2" fontWeight="bold">{kpi.metric}</Typography>
                                                <Typography variant="body2">目标值: <Chip label={kpi.target} color="success" size="small" /></Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                  测量方法: {kpi.measurementMethod}
                                                </Typography>
                                              </CardContent>
                                            </Card>
                                          ))}
                                        </Stack>
                                      </AccordionDetails>
                                    </Accordion>
                                  )}

                                  {measure.dependencies && (
                                    <Accordion>
                                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                        <Typography>🔗 依赖关系</Typography>
                                      </AccordionSummary>
                                      <AccordionDetails>
                                        <Stack spacing={1}>
                                          {measure.dependencies.prerequisiteMeasures && measure.dependencies.prerequisiteMeasures.length > 0 && (
                                            <Box>
                                              <Typography variant="body2" fontWeight="bold">前置措施:</Typography>
                                              <Box component="ul" sx={{ pl: 2, m: 0 }}>
                                                {measure.dependencies.prerequisiteMeasures.map((dep: string, i: number) => (
                                                  <Typography component="li" variant="body2" key={i}>{dep}</Typography>
                                                ))}
                                              </Box>
                                            </Box>
                                          )}
                                          {measure.dependencies.externalDependencies && measure.dependencies.externalDependencies.length > 0 && (
                                            <Box>
                                              <Typography variant="body2" fontWeight="bold">外部依赖:</Typography>
                                              <Box component="ul" sx={{ pl: 2, m: 0 }}>
                                                {measure.dependencies.externalDependencies.map((dep: string, i: number) => (
                                                  <Typography component="li" variant="body2" key={i}>{dep}</Typography>
                                                ))}
                                              </Box>
                                            </Box>
                                          )}
                                        </Stack>
                                      </AccordionDetails>
                                    </Accordion>
                                  )}
                                </Accordion>
                              </Stack>
                            </CardContent>
                          </Card>
                        )
                      })}
                    </Box>
                  )
                })
              )
            ) : (
              improvements.map((improvement, index) => {
                const config = getPriorityConfig(improvement.priority)

                return (
                  <Card key={index} variant="outlined">
                    <CardHeader
                      title={
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography>{config.icon}</Typography>
                          <Typography>{index + 1}. {improvement.area}</Typography>
                          <Chip label={config.text} color={config.color} size="small" />
                        </Stack>
                      }
                    />
                    <CardContent>
                      <Stack spacing={2}>
                        {/* 改进措施 */}
                        <Box>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            <ChartIcon fontSize="small" sx={{ mr: 0.5, verticalAlign: 'middle' }} />
                            改进措施 ({improvement.actions.length}项)
                          </Typography>
                          <List dense>
                            {improvement.actions.map((action, actionIndex) => (
                              <ListItem key={actionIndex}>
                                <ListItemIcon>
                                  <CheckCircleIcon color="primary" fontSize="small" />
                                </ListItemIcon>
                                <ListItemText primary={action} />
                              </ListItem>
                            ))}
                          </List>
                        </Box>

                        {/* 详细信息 */}
                        <Grid container spacing={2}>
                          {improvement.timeline && (
                            <Grid size={{ xs: 12, md: 4 }}>
                              <Stack direction="row" spacing={1} alignItems="flex-start">
                                <ClockIcon color="primary" sx={{ mt: 0.5 }} />
                                <Box>
                                  <Typography variant="caption" color="text.secondary">时间周期</Typography>
                                  <Typography variant="body2" fontWeight="medium">{improvement.timeline}</Typography>
                                </Box>
                              </Stack>
                            </Grid>
                          )}
                          {improvement.resources && (
                            <Grid size={{ xs: 12, md: 4 }}>
                              <Stack direction="row" spacing={1} alignItems="flex-start">
                                <TeamIcon color="success" sx={{ mt: 0.5 }} />
                                <Box>
                                  <Typography variant="caption" color="text.secondary">所需资源</Typography>
                                  <Typography variant="body2" fontWeight="medium">{improvement.resources}</Typography>
                                </Box>
                              </Stack>
                            </Grid>
                          )}
                          {improvement.expectedOutcome && (
                            <Grid size={{ xs: 12, md: 4 }}>
                              <Stack direction="row" spacing={1} alignItems="flex-start">
                                <RocketIcon color="warning" sx={{ mt: 0.5 }} />
                                <Box>
                                  <Typography variant="caption" color="text.secondary">预期成果</Typography>
                                  <Typography variant="body2" fontWeight="medium">{improvement.expectedOutcome}</Typography>
                                </Box>
                              </Stack>
                            </Grid>
                          )}
                        </Grid>
                      </Stack>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  )
}
