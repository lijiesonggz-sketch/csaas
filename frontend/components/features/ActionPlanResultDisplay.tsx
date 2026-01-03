'use client'

/**
 * 改进措施结果展示组件
 * 展示完整的改进措施计划，支持导出功能
 */

import { useState, useEffect, useMemo } from 'react'
import * as XLSX from 'xlsx'
import {
  Card,
  Button,
  Tag,
  Collapse,
  Timeline,
  Row,
  Col,
  Statistic,
  Progress,
  Space,
  Descriptions,
  Alert,
  message,
} from 'antd'
import {
  DownloadOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  TeamOutlined,
  DollarOutlined,
  RocketOutlined,
  SafetyOutlined,
  ThunderboltOutlined,
  LineChartOutlined,
  BulbOutlined,
} from '@ant-design/icons'
import type { GenerationResult } from '@/lib/types/ai-generation'

const { Panel } = Collapse

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
      高: { color: 'red', icon: '🔴', text: '高优先级' },
      中: { color: 'orange', icon: '🟡', text: '中优先级' },
      低: { color: 'blue', icon: '🟢', text: '低优先级' },
    }
    return configs[priority as keyof typeof configs] || { color: 'default', icon: '⚪', text: priority }
  }

  // ========================================
  // 两层导航状态管理
  // ========================================
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null) // 当前展开的一层分类
  const [highlightedCluster, setHighlightedCluster] = useState<string | null>(null) // 当前高亮的二层聚类

  // ========================================
  // 层级数据处理（暂时使用硬编码，后续从API获取）
  // ========================================
  const categoryHierarchy = useMemo(() => {
    if (!useDetailedMeasures || !detailedMeasures || detailedMeasures.length === 0) {
      return []
    }

    // 硬编码的层级结构（从之前的聚类分析中获取）
    // TODO: 后续从后端API或metadata中获取
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

    // 过滤出实际存在于措施中的聚类
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

      // 计算每个聚类的统计数据
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
  const handleCategoryClick = (categoryName: string) => {
    if (selectedCategory === categoryName) {
      setSelectedCategory(null) // 收起
    } else {
      setSelectedCategory(categoryName) // 展开
    }
    setHighlightedCluster(null) // 清除高亮
  }

  const handleClusterClick = (clusterName: string) => {
    setHighlightedCluster(clusterName)
    setSelectedCategory(null) // 收起导航

    // 平滑滚动到措施区域
    setTimeout(() => {
      const element = document.getElementById(`cluster-measures-${clusterName}`)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 300)
  }

  // 导出为 CSV
  const handleExportCSV = () => {
    try {
      const csvRows: string[] = []

      if (useDetailedMeasures && detailedMeasures) {
        // 使用详细措施（90条）
        // CSV Header - 增强版
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

        // 遍历详细措施
        detailedMeasures.forEach((measure, index) => {
          const config = getPriorityConfig(measure.priority === 'high' ? '高' : measure.priority === 'medium' ? '中' : '低')

          // 提取资源需求
          const budget = measure.resourcesNeeded?.budget || '-'
          const personnel = measure.resourcesNeeded?.personnel?.join('; ') || '-'
          const technology = measure.resourcesNeeded?.technology?.join('; ') || '-'

          // 提取外部依赖
          const externalDeps = measure.dependencies?.externalDependencies?.join('; ') || '-'

          // 提取风险和缓解措施（可能有多个）
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
        // 使用简化措施
        // CSV Header
        csvRows.push('优先级,领域,当前级别,目标级别,时间周期,所需资源,预期成果,改进措施')

        // 遍历改进措施
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

      // 创建下载
      const csvContent = csvRows.join('\n')
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `action_plan_${result.taskId}.csv`
      link.click()
      URL.revokeObjectURL(url)

      message.success('改进措施已导出为CSV文件！')
    } catch (error) {
      message.error('导出失败：' + (error instanceof Error ? error.message : '未知错误'))
    }
  }

  // 导出为 Word (简化版，实际导出HTML)
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
            h1 { color: #1890ff; }
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

      message.success('改进措施已导出为Word文件！')
    } catch (error) {
      message.error('导出失败：' + (error instanceof Error ? error.message : '未知错误'))
    }
  }

  // 导出为 Excel (多 Sheet 格式，参考 2025-12-31 Excel 文件结构)
  const handleExportExcel = () => {
    try {
      if (!useDetailedMeasures || !detailedMeasures || detailedMeasures.length === 0) {
        message.warning('请先生成详细改进措施后再导出 Excel')
        return
      }

      const workbook = XLSX.utils.book_new()
      const sheetNames: string[] = []
      const sheets: XLSX.WorkSheet[] = []

      // ========================================
      // Sheet 1: 概览统计
      // ========================================
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

      // ========================================
      // Sheet 2: 措施汇总表
      // ========================================
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

      // ========================================
      // Sheet 3-N: 按聚类分组的详细措施
      // ========================================
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
        sheetNames.push(clusterName.length > 31 ? clusterName.substring(0, 31) : clusterName) // Excel sheet name max 31 chars
        sheets.push(clusterSheet)
      })

      // ========================================
      // Sheet N+1: 实施步骤汇总
      // ========================================
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

      // ========================================
      // Sheet N+2: 资源与KPI汇总
      // ========================================
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

      // 将所有 sheet 添加到 workbook
      sheets.forEach((sheet, index) => {
        XLSX.utils.book_append_sheet(workbook, sheet, sheetNames[index])
      })

      // 生成文件并下载
      const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '')
      XLSX.writeFile(workbook, `成熟度改进措施计划_${dateStr}.xlsx`)

      message.success('改进措施已导出为 Excel 文件（多 Sheet 格式）！')
    } catch (error) {
      console.error('Excel 导出错误:', error)
      message.error('导出失败：' + (error instanceof Error ? error.message : '未知错误'))
    }
  }

  return (
    <div className="space-y-6">
      {/* 概述信息 */}
      {summary && (
        <Alert
          message="改进措施概述"
          description={summary}
          type="info"
          showIcon
          icon={<RocketOutlined />}
        />
      )}

      {/* 成熟度概览统计 */}
      {useDetailedMeasures && detailedMeasures.length > 0 && (
        <Card bordered={false} title="📊 成熟度概览">
          <Row gutter={16}>
            <Col span={6}>
              <Statistic
                title="当前成熟度"
                value={(() => {
                  const scores = detailedMeasures.map(m => m.currentLevel)
                  return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)
                })()}
                suffix="分"
                valueStyle={{ color: '#cf1322' }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="目标成熟度"
                value={(() => {
                  const scores = detailedMeasures.map(m => m.targetLevel)
                  return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)
                })()}
                suffix="分"
                valueStyle={{ color: '#3f8600' }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="平均差距"
                value={(() => {
                  const gaps = detailedMeasures.map(m => m.gap)
                  return (gaps.reduce((a, b) => a + b, 0) / gaps.length).toFixed(2)
                })()}
                suffix="分"
                valueStyle={{ color: '#faad14' }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="预期总提升"
                value={(() => {
                  const improvements = detailedMeasures.map(m => m.expectedImprovement || 0)
                  return (improvements.reduce((a, b) => a + b, 0)).toFixed(2)
                })()}
                suffix="分"
                valueStyle={{ color: '#1890ff' }}
              />
            </Col>
          </Row>
        </Card>
      )}

      {/* 两层导航 */}
      {useDetailedMeasures && detailedMeasures.length > 0 && categoryStats.length > 0 && (
        <div className="space-y-4">
          {/* 一层分类导航 */}
          <Card bordered={false} title="📁 一层分类导航">
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              {categoryStats.map((category, catIndex) => {
                const isExpanded = selectedCategory === category.name
                const categoryIcon = ['🛡️', '🔄', '🔐', '📊'][catIndex] || '📋'

                return (
                  <Card
                    key={category.id}
                    size="small"
                    style={{
                      borderColor: isExpanded ? '#1890ff' : '#d9d9d9',
                      backgroundColor: isExpanded ? '#f0f5ff' : '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.3s'
                    }}
                    hoverable
                    onClick={() => handleCategoryClick(category.name)}
                  >
                    <Space direction="vertical" style={{ width: '100%' }} size="small">
                      <div className="flex items-center justify-between">
                        <Space>
                          <span style={{ fontSize: '20px' }}>{categoryIcon}</span>
                          <span className="text-lg font-medium">{category.name}</span>
                        </Space>
                        <Button
                          type="text"
                          size="small"
                          icon={isExpanded ? <span>▲</span> : <span>▼</span>}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCategoryClick(category.name)
                          }}
                        />
                      </div>

                      <div className="text-sm text-gray-500">
                        {category.description}
                      </div>

                      <Card
                        size="small"
                        style={{ backgroundColor: '#fafafa', border: 'none' }}
                      >
                        <Row gutter={16}>
                          <Col span={6}>
                            <div className="text-center">
                              <div className="text-xs text-gray-500 mb-1">当前成熟度</div>
                              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#cf1322' }}>
                                {category.avgCurrent}
                              </div>
                            </div>
                          </Col>
                          <Col span={6}>
                            <div className="text-center">
                              <div className="text-xs text-gray-500 mb-1">目标成熟度</div>
                              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#3f8600' }}>
                                {category.avgTarget}
                              </div>
                            </div>
                          </Col>
                          <Col span={6}>
                            <div className="text-center">
                              <div className="text-xs text-gray-500 mb-1">平均差距</div>
                              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#faad14' }}>
                                {category.avgGap}
                              </div>
                            </div>
                          </Col>
                          <Col span={6}>
                            <div className="text-center">
                              <div className="text-xs text-gray-500 mb-1">措施数量</div>
                              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1890ff' }}>
                                {category.measureCount}条
                              </div>
                            </div>
                          </Col>
                        </Row>
                      </Card>

                      <div className="text-xs text-gray-400 text-center">
                        包含 {category.clusters.length} 个聚类
                        {isExpanded ? ' [点击收起]' : ' [点击展开]'}
                      </div>
                    </Space>
                  </Card>
                )
              })}
            </Space>
          </Card>

          {/* 二层聚类导航（点击展开后显示） */}
          {selectedCategory && (
            <Card
              bordered={false}
              title={
                <Space>
                  <span>📂 二层聚类导航</span>
                  <span style={{ color: '#1890ff' }}>{selectedCategory}</span>
                </Space>
              }
              extra={
                <Button
                  type="link"
                  size="small"
                  onClick={() => setSelectedCategory(null)}
                >
                  收起
                </Button>
              }
            >
              <Row gutter={[16, 16]}>
                {categoryStats
                  .filter(cat => cat.name === selectedCategory)
                  .map(cat =>
                    cat.clusters.map((cluster: any, clusterIndex: number) => {
                      const isHighlighted = highlightedCluster === cluster.name

                      return (
                        <Col xs={24} sm={12} md={8} key={cluster.id}>
                          <Card
                            size="small"
                            style={{
                              cursor: 'pointer',
                              borderColor: isHighlighted ? '#faad14' : '#d9d9d9',
                              backgroundColor: isHighlighted ? '#fffbe6' : '#fafafa',
                              transition: 'all 0.3s'
                            }}
                            hoverable
                            onClick={() => handleClusterClick(cluster.name)}
                          >
                            <Space direction="vertical" style={{ width: '100%' }} size="small">
                              <div className="font-medium text-sm">
                                {cat.clusters.findIndex((c: any) => c.id === cluster.id) + 1}. {cluster.name}
                              </div>

                              <div
                                style={{
                                  fontSize: '12px',
                                  color: '#666',
                                  backgroundColor: '#ffffff',
                                  padding: '8px',
                                  borderRadius: '4px',
                                  border: '1px solid #d9d9d9'
                                }}
                              >
                                <div>当前: {cluster.avgCurrent} → 目标: {cluster.avgTarget}</div>
                                <div style={{ color: '#faad14', fontWeight: 'bold' }}>
                                  差距: {cluster.avgGap}
                                </div>
                              </div>

                              <div className="flex items-center justify-between">
                                <Tag color="blue">{cluster.measureCount} 条措施</Tag>
                                <Space size="small">
                                  {cluster.highPriority > 0 && <Tag color="red">高: {cluster.highPriority}</Tag>}
                                  {cluster.mediumPriority > 0 && <Tag color="orange">中: {cluster.mediumPriority}</Tag>}
                                  {cluster.lowPriority > 0 && <Tag color="blue">低: {cluster.lowPriority}</Tag>}
                                </Space>
                              </div>

                              <div className="text-center">
                                <Button type="primary" size="small">
                                  查看措施 →
                                </Button>
                              </div>
                            </Space>
                          </Card>
                        </Col>
                      )
                    })
                  )}
              </Row>
            </Card>
          )}
        </div>
      )}

      {/* 统计概览 */}
      <Row gutter={16}>
        <Col span={8}>
          <Card bordered={false}>
            <Statistic
              title="改进领域"
              value={useDetailedMeasures
                ? Array.from(new Set(detailedMeasures.map(m => m.clusterName))).length
                : improvements.length
              }
              prefix={<SafetyOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card bordered={false}>
            <Statistic
              title="总措施数"
              value={totalMeasures}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card bordered={false}>
            <Statistic
              title="高优先级"
              value={useDetailedMeasures
                ? detailedMeasures.filter(m => m.priority === 'high').length
                : improvements.filter(i => i.priority === '高').length
              }
              prefix={<ThunderboltOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 元数据 */}
      {metadata.timeline && (
        <Card bordered={false} title="实施计划">
          <Descriptions column={2} size="small">
            <Descriptions.Item label="时间周期">{metadata.timeline}</Descriptions.Item>
            <Descriptions.Item label="聚类数量">{metadata.clusterCount || '-'}</Descriptions.Item>
            <Descriptions.Item label="生成时间">
              {metadata.generatedAt ? new Date(metadata.generatedAt).toLocaleString('zh-CN') : '-'}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      {/* 导出按钮 */}
      <Card bordered={false}>
        <Space>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleExportCSV}
          >
            导出CSV
          </Button>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleExportExcel}
            style={{ backgroundColor: '#217346' }}
          >
            导出Excel
          </Button>
          <Button
            icon={<DownloadOutlined />}
            onClick={handleExportWord}
          >
            导出Word
          </Button>
        </Space>
      </Card>

      {/* 改进措施列表 */}
      <Card bordered={false} title="改进措施详情">
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {useDetailedMeasures ? (
            // 使用详细措施列表（90条）- 按聚类分组展示
            Array.from(new Set(detailedMeasures.map((m: any) => m.clusterName))).map((clusterName, clusterIndex) => {
              const clusterMeasures = detailedMeasures.filter((m: any) => m.clusterName === clusterName)
              const isHighlighted = highlightedCluster === clusterName

              return (
                <div
                  key={clusterName}
                  id={`cluster-measures-${clusterName}`}
                  style={{
                    scrollMarginTop: 100, // 为固定头部留出空间
                    transition: 'all 0.3s'
                  }}
                >
                  {/* 聚类标题 */}
                  <Card
                    size="small"
                    style={{
                      marginBottom: 16,
                      backgroundColor: isHighlighted ? '#fffbe6' : '#f0f5ff',
                      borderColor: isHighlighted ? '#faad14' : '#1890ff',
                      borderLeftWidth: 4,
                      borderLeftStyle: 'solid'
                    }}
                    title={
                      <Space>
                        <span style={{ fontSize: '16px', fontWeight: 'bold' }}>
                          {clusterIndex + 1}. {clusterName}
                        </span>
                        <Tag color="blue">{clusterMeasures.length} 条措施</Tag>
                        {isHighlighted && <Tag color="orange">🔍 正在查看</Tag>}
                      </Space>
                    }
                  />

                  {/* 该聚类下的所有措施 */}
                  {clusterMeasures.map((measure: any, measureIndex: number) => {
                    const config = getPriorityConfig(measure.priority === 'high' ? '高' : measure.priority === 'medium' ? '中' : '低')

                    return (
                      <Card
                        key={`${clusterName}-${measureIndex}`}
                        type="inner"
                        style={{
                          marginBottom: 16,
                          borderLeftWidth: 4,
                          borderLeftStyle: 'solid',
                          borderLeftColor: config.color === 'red' ? '#ef4444' : config.color === 'orange' ? '#f59e0b' : '#3b82f6',
                          backgroundColor: isHighlighted ? '#fffbe6' : 'transparent',
                          transition: 'all 0.3s'
                        }}
                        title={
                          <Space>
                            <span>{config.icon}</span>
                            <span>{measureIndex + 1}. {measure.title}</span>
                            <Tag color={config.color}>{config.text}</Tag>
                          </Space>
                        }
                      >
                  <Space direction="vertical" style={{ width: '100%' }} size="middle">
                    {/* 措施描述 */}
                    {measure.description && (
                      <Alert
                        message={measure.description}
                        type="info"
                        showIcon
                        icon={<BulbOutlined />}
                      />
                    )}

                    {/* 级别对比 */}
                    <div>
                      <div className="text-sm text-gray-500 mb-2">成熟度提升路径</div>
                      <Progress
                        percent={75}
                        strokeColor={{
                          '0%': '#108ee9',
                          '100%': '#87d068',
                        }}
                        format={() => (
                          <span>
                            <Tag color="blue">{measure.currentLevel.toFixed(1)}</Tag>
                            <span className="mx-2">→</span>
                            <Tag color="green">{measure.targetLevel.toFixed(1)}</Tag>
                            <span className="ml-2 text-xs text-gray-500">差距: {measure.gap.toFixed(1)}</span>
                          </span>
                        )}
                      />
                    </div>

                    {/* 实施步骤 */}
                    {measure.implementationSteps && measure.implementationSteps.length > 0 && (
                      <div>
                        <div className="text-sm text-gray-500 mb-2">
                          <LineChartOutlined className="mr-1" />
                          实施步骤 ({measure.implementationSteps.length}项)
                        </div>
                        <Timeline
                          items={measure.implementationSteps.map((step: any, stepIndex: number) => ({
                            color: 'blue',
                            dot: <CheckCircleOutlined style={{ fontSize: '16px' }} />,
                            children: (
                              <div>
                                <div className="text-sm font-medium">
                                  {step.stepNumber}. {step.title}
                                </div>
                                <div className="text-xs text-gray-600 mt-1">{step.description}</div>
                                <Tag color="cyan" className="mt-1">预计耗时: {step.duration}</Tag>
                              </div>
                            ),
                          }))}
                        />
                      </div>
                    )}

                    {/* 详细信息折叠面板 */}
                    <Collapse ghost>
                      {measure.responsibleDepartment && (
                        <Panel header="👥 负责部门" key="responsible">
                          <Space><TeamOutlined /> {measure.responsibleDepartment}</Space>
                        </Panel>
                      )}

                      {measure.timeline && (
                        <Panel header="⏱️ 时间周期" key="timeline">
                          <Space><ClockCircleOutlined /> {measure.timeline}</Space>
                        </Panel>
                      )}

                      {measure.resourcesNeeded && (
                        <Panel header="💰 资源需求" key="resources">
                          <Descriptions column={1} bordered size="small">
                            {measure.resourcesNeeded.budget && (
                              <Descriptions.Item label={<Space><DollarOutlined /> 预算</Space>}>
                                {measure.resourcesNeeded.budget}
                              </Descriptions.Item>
                            )}
                            {measure.resourcesNeeded.personnel && measure.resourcesNeeded.personnel.length > 0 && (
                              <Descriptions.Item label={<Space><TeamOutlined /> 人员</Space>}>
                                {measure.resourcesNeeded.personnel.join(', ')}
                              </Descriptions.Item>
                            )}
                            {measure.resourcesNeeded.technology && measure.resourcesNeeded.technology.length > 0 && (
                              <Descriptions.Item label="技术/工具">
                                {measure.resourcesNeeded.technology.map((tech: string, i: number) => (
                                  <Tag key={i} color="blue">{tech}</Tag>
                                ))}
                              </Descriptions.Item>
                            )}
                            {measure.resourcesNeeded.training && (
                              <Descriptions.Item label="培训需求">
                                {measure.resourcesNeeded.training}
                              </Descriptions.Item>
                            )}
                          </Descriptions>
                        </Panel>
                      )}

                      {measure.risks && measure.risks.length > 0 && (
                        <Panel header="⚠️ 风险与缓解" key="risks">
                          <Timeline
                            items={measure.risks.map((risk: any, i: number) => ({
                              color: 'red',
                              children: (
                                <div>
                                  <strong style={{ color: '#ff4d4f' }}>风险: {risk.risk}</strong>
                                  <br />
                                  <span style={{ color: '#52c41a' }}>✓ 缓解措施: {risk.mitigation}</span>
                                </div>
                              ),
                            }))}
                          />
                        </Panel>
                      )}

                      {measure.kpiMetrics && measure.kpiMetrics.length > 0 && (
                        <Panel header="📊 KPI指标" key="kpi">
                          <Space direction="vertical" style={{ width: '100%' }}>
                            {measure.kpiMetrics.map((kpi: any, i: number) => (
                              <Card key={i} size="small" style={{ background: '#f0f5ff' }}>
                                <Space direction="vertical" style={{ width: '100%' }}>
                                  <strong>{kpi.metric}</strong>
                                  <div>目标值: <Tag color="green">{kpi.target}</Tag></div>
                                  <div style={{ fontSize: 12, color: '#666' }}>
                                    测量方法: {kpi.measurementMethod}
                                  </div>
                                </Space>
                              </Card>
                            ))}
                          </Space>
                        </Panel>
                      )}

                      {measure.dependencies && (
                        <Panel header="🔗 依赖关系" key="dependencies">
                          <Space direction="vertical" style={{ width: '100%' }}>
                            {measure.dependencies.prerequisiteMeasures && measure.dependencies.prerequisiteMeasures.length > 0 && (
                              <div>
                                <strong>前置措施:</strong>
                                <ul>
                                  {measure.dependencies.prerequisiteMeasures.map((dep: string, i: number) => (
                                    <li key={i}>{dep}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {measure.dependencies.externalDependencies && measure.dependencies.externalDependencies.length > 0 && (
                              <div>
                                <strong>外部依赖:</strong>
                                <ul>
                                  {measure.dependencies.externalDependencies.map((dep: string, i: number) => (
                                    <li key={i}>{dep}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </Space>
                        </Panel>
                      )}
                    </Collapse>
                  </Space>
                </Card>
                      )
                    })}
                  </div>
                )
              })
            ) : (
            // 使用简化的improvements
            improvements.map((improvement, index) => {
              const config = getPriorityConfig(improvement.priority)

              return (
                <Card
                  key={index}
                  type="inner"
                  title={
                    <Space>
                      <span>{config.icon}</span>
                      <span>{index + 1}. {improvement.area}</span>
                      <Tag color={config.color}>{config.text}</Tag>
                    </Space>
                  }
                >
                  <Space direction="vertical" style={{ width: '100%' }} size="middle">
                    {/* 改进措施 */}
                    <div>
                      <div className="text-sm text-gray-500 mb-2">
                        <LineChartOutlined className="mr-1" />
                        改进措施 ({improvement.actions.length}项)
                      </div>
                      <Timeline
                        items={improvement.actions.map((action, actionIndex) => ({
                          color: 'blue',
                          dot: <CheckCircleOutlined style={{ fontSize: '16px' }} />,
                          children: (
                            <div>
                              <div className="text-sm font-medium">{action}</div>
                            </div>
                          ),
                        }))}
                      />
                    </div>

                    {/* 详细信息 */}
                    <Row gutter={16}>
                      {improvement.timeline && (
                        <Col span={8}>
                          <div className="flex items-start">
                            <ClockCircleOutlined className="mt-1 mr-2" style={{ color: '#1890ff' }} />
                            <div>
                              <div className="text-xs text-gray-500">时间周期</div>
                              <div className="text-sm font-medium">{improvement.timeline}</div>
                            </div>
                          </div>
                        </Col>
                      )}
                      {improvement.resources && (
                        <Col span={8}>
                          <div className="flex items-start">
                            <TeamOutlined className="mt-1 mr-2" style={{ color: '#52c41a' }} />
                            <div>
                              <div className="text-xs text-gray-500">所需资源</div>
                              <div className="text-sm font-medium">{improvement.resources}</div>
                            </div>
                          </div>
                        </Col>
                      )}
                      {improvement.expectedOutcome && (
                        <Col span={8}>
                          <div className="flex items-start">
                            <RocketOutlined className="mt-1 mr-2" style={{ color: '#fa8c16' }} />
                            <div>
                              <div className="text-xs text-gray-500">预期成果</div>
                              <div className="text-sm font-medium">{improvement.expectedOutcome}</div>
                            </div>
                          </div>
                        </Col>
                      )}
                    </Row>
                  </Space>
                </Card>
              )
            })
          )}
        </Space>
      </Card>
    </div>
  )
}
