/**
 * 落地措施导出工具
 * 支持导出为Excel格式
 */

import * as XLSX from 'xlsx'

interface ActionPlanMeasure {
  id: string
  clusterName: string
  currentLevel: number
  targetLevel: number
  gap: number
  priority: 'high' | 'medium' | 'low'
  title: string
  description: string
  implementationSteps: Array<{
    stepNumber: number
    title: string
    description: string
    duration: string
  }>
  timeline: string
  responsibleDepartment: string
  expectedImprovement: number
  resourcesNeeded: {
    budget?: string
    personnel?: string[]
    technology?: string[]
    training?: string
  }
  dependencies: {
    prerequisiteMeasures?: string[]
    externalDependencies?: string[]
  }
  risks: Array<{
    risk: string
    mitigation: string
  }>
  kpiMetrics: Array<{
    metric: string
    target: string
    measurementMethod: string
  }>
  sortOrder: number
}

/**
 * 导出落地措施为Excel文件
 */
export function exportActionPlanToExcel(
  measures: ActionPlanMeasure[],
  targetMaturity: number,
  fileName: string = '成熟度改进措施计划',
) {
  const workbook = XLSX.utils.book_new()

  // Sheet 1: 概览统计
  const overviewData = generateOverviewSheet(measures, targetMaturity)
  const overviewSheet = XLSX.utils.aoa_to_sheet(overviewData)

  // 设置列宽
  overviewSheet['!cols'] = [
    { wch: 20 },
    { wch: 15 },
    { wch: 50 },
  ]

  XLSX.utils.book_append_sheet(workbook, overviewSheet, '概览统计')

  // Sheet 2: 措施汇总
  const summaryData = generateSummarySheet(measures)
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)

  // 设置列宽
  summarySheet['!cols'] = [
    { wch: 8 },  // 序号
    { wch: 25 }, // 聚类
    { wch: 12 }, // 优先级
    { wch: 30 }, // 措施标题
    { wch: 50 }, // 描述
    { wch: 15 }, // 时间线
    { wch: 20 }, // 负责部门
    { wch: 12 }, // 预期提升
  ]

  XLSX.utils.book_append_sheet(workbook, summarySheet, '措施汇总')

  // Sheet 3: 详细措施（按聚类分组）
  const groupedMeasures = groupByCluster(measures)

  Object.entries(groupedMeasures).forEach(([clusterName, clusterMeasures], index) => {
    const detailData = generateDetailSheet(clusterName, clusterMeasures)
    const detailSheet = XLSX.utils.aoa_to_sheet(detailData)

    // 设置列宽
    detailSheet['!cols'] = [
      { wch: 20 }, // 字段名
      { wch: 80 }, // 内容
    ]

    // Sheet名称限制31个字符
    const sheetName = `${index + 1}.${clusterName.substring(0, 26)}`
    XLSX.utils.book_append_sheet(workbook, detailSheet, sheetName)
  })

  // Sheet 4: 实施步骤详情
  const stepsData = generateStepsSheet(measures)
  const stepsSheet = XLSX.utils.aoa_to_sheet(stepsData)

  stepsSheet['!cols'] = [
    { wch: 8 },  // 措施序号
    { wch: 30 }, // 措施标题
    { wch: 8 },  // 步骤序号
    { wch: 25 }, // 步骤标题
    { wch: 60 }, // 步骤描述
    { wch: 12 }, // 耗时
  ]

  XLSX.utils.book_append_sheet(workbook, stepsSheet, '实施步骤')

  // Sheet 5: 资源与KPI
  const resourcesData = generateResourcesSheet(measures)
  const resourcesSheet = XLSX.utils.aoa_to_sheet(resourcesData)

  resourcesSheet['!cols'] = [
    { wch: 8 },  // 序号
    { wch: 30 }, // 措施标题
    { wch: 15 }, // 预算
    { wch: 30 }, // 人员
    { wch: 30 }, // 技术
    { wch: 30 }, // KPI指标
    { wch: 15 }, // KPI目标
  ]

  XLSX.utils.book_append_sheet(workbook, resourcesSheet, '资源与KPI')

  // 生成并下载文件
  const timestamp = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(workbook, `${fileName}_${timestamp}.xlsx`)
}

/**
 * 生成概览统计Sheet
 */
function generateOverviewSheet(measures: ActionPlanMeasure[], targetMaturity: number): any[][] {
  const totalMeasures = measures.length
  const clusters = new Set(measures.map(m => m.clusterName)).size
  const highPriority = measures.filter(m => m.priority === 'high').length
  const mediumPriority = measures.filter(m => m.priority === 'medium').length
  const lowPriority = measures.filter(m => m.priority === 'low').length
  const totalImprovement = measures.reduce((sum, m) => sum + m.expectedImprovement, 0)

  const avgCurrent = measures.reduce((sum, m) => sum + m.currentLevel, 0) / measures.length
  const avgGap = measures.reduce((sum, m) => sum + m.gap, 0) / measures.length

  return [
    ['成熟度改进措施计划 - 概览统计', '', ''],
    ['', '', ''],
    ['统计项', '数值', '说明'],
    ['目标成熟度', targetMaturity.toFixed(1), '用户设定的改进目标'],
    ['平均当前成熟度', avgCurrent.toFixed(2), '所有涉及聚类的平均成熟度'],
    ['平均差距', avgGap.toFixed(2), '目标与当前的平均差距'],
    ['', '', ''],
    ['措施数量统计', '', ''],
    ['总计措施数', totalMeasures, '生成的改进措施总数'],
    ['涉及聚类数', clusters, '需要改进的聚类数量'],
    ['高优先级措施', highPriority, '紧急且重要的措施'],
    ['中优先级措施', mediumPriority, '重要但不紧急的措施'],
    ['低优先级措施', lowPriority, '优化性质的措施'],
    ['', '', ''],
    ['预期效果', '', ''],
    ['预期总提升', totalImprovement.toFixed(1) + ' 分', '所有措施的预期提升总和'],
    ['平均单措施提升', (totalImprovement / totalMeasures).toFixed(2) + ' 分', '单个措施平均带来的提升'],
    ['', '', ''],
    ['生成时间', new Date().toLocaleString('zh-CN'), '报告生成时间'],
  ]
}

/**
 * 生成措施汇总Sheet
 */
function generateSummarySheet(measures: ActionPlanMeasure[]): any[][] {
  const headers = [
    '序号',
    '聚类名称',
    '优先级',
    '措施标题',
    '措施描述',
    '时间线',
    '负责部门',
    '预期提升(分)',
  ]

  const rows = measures.map((measure, index) => [
    index + 1,
    measure.clusterName,
    getPriorityText(measure.priority),
    measure.title,
    measure.description,
    measure.timeline,
    measure.responsibleDepartment,
    measure.expectedImprovement.toFixed(1),
  ])

  return [headers, ...rows]
}

/**
 * 生成单个聚类的详细Sheet
 */
function generateDetailSheet(clusterName: string, measures: ActionPlanMeasure[]): any[][] {
  const data: any[][] = []

  data.push([`聚类: ${clusterName}`, ''])
  data.push(['当前成熟度', measures[0].currentLevel.toFixed(2)])
  data.push(['目标成熟度', measures[0].targetLevel.toFixed(1)])
  data.push(['成熟度差距', measures[0].gap.toFixed(2)])
  data.push(['', ''])

  measures.forEach((measure, index) => {
    data.push([`措施 ${index + 1}`, ''])
    data.push(['优先级', getPriorityText(measure.priority)])
    data.push(['标题', measure.title])
    data.push(['描述', measure.description])
    data.push(['时间线', measure.timeline])
    data.push(['负责部门', measure.responsibleDepartment])
    data.push(['预期提升', measure.expectedImprovement.toFixed(1) + ' 分'])
    data.push(['', ''])

    data.push(['实施步骤', ''])
    measure.implementationSteps.forEach((step) => {
      data.push([
        `步骤${step.stepNumber}: ${step.title}`,
        `${step.description} (耗时: ${step.duration})`,
      ])
    })
    data.push(['', ''])

    if (measure.resourcesNeeded.budget) {
      data.push(['预算', measure.resourcesNeeded.budget])
    }
    if (measure.resourcesNeeded.personnel && measure.resourcesNeeded.personnel.length > 0) {
      data.push(['人员需求', measure.resourcesNeeded.personnel.join('; ')])
    }
    if (measure.resourcesNeeded.technology && measure.resourcesNeeded.technology.length > 0) {
      data.push(['技术/工具', measure.resourcesNeeded.technology.join('; ')])
    }
    if (measure.resourcesNeeded.training) {
      data.push(['培训需求', measure.resourcesNeeded.training])
    }
    data.push(['', ''])

    if (measure.risks && measure.risks.length > 0) {
      data.push(['风险与缓解', ''])
      measure.risks.forEach((risk, i) => {
        data.push([
          `风险${i + 1}: ${risk.risk}`,
          `缓解措施: ${risk.mitigation}`,
        ])
      })
      data.push(['', ''])
    }

    if (measure.kpiMetrics && measure.kpiMetrics.length > 0) {
      data.push(['KPI指标', ''])
      measure.kpiMetrics.forEach((kpi, i) => {
        data.push([
          `${i + 1}. ${kpi.metric}`,
          `目标: ${kpi.target} | 测量方法: ${kpi.measurementMethod}`,
        ])
      })
      data.push(['', ''])
    }

    if (measure.dependencies?.externalDependencies && measure.dependencies.externalDependencies.length > 0) {
      data.push(['外部依赖', measure.dependencies.externalDependencies.join('; ')])
      data.push(['', ''])
    }

    data.push(['=================', '================='])
    data.push(['', ''])
  })

  return data
}

/**
 * 生成实施步骤Sheet
 */
function generateStepsSheet(measures: ActionPlanMeasure[]): any[][] {
  const headers = [
    '措施序号',
    '措施标题',
    '步骤序号',
    '步骤标题',
    '步骤描述',
    '预计耗时',
  ]

  const rows: any[][] = []

  measures.forEach((measure, mIndex) => {
    measure.implementationSteps.forEach((step) => {
      rows.push([
        mIndex + 1,
        measure.title,
        step.stepNumber,
        step.title,
        step.description,
        step.duration,
      ])
    })
  })

  return [headers, ...rows]
}

/**
 * 生成资源与KPI Sheet
 */
function generateResourcesSheet(measures: ActionPlanMeasure[]): any[][] {
  const headers = [
    '序号',
    '措施标题',
    '预算',
    '人员需求',
    '技术/工具',
    'KPI指标',
    'KPI目标',
  ]

  const rows: any[][] = []

  measures.forEach((measure, index) => {
    const kpis = measure.kpiMetrics || []

    if (kpis.length === 0) {
      // 没有KPI，输出一行
      rows.push([
        index + 1,
        measure.title,
        measure.resourcesNeeded.budget || '-',
        (measure.resourcesNeeded.personnel || []).join('; ') || '-',
        (measure.resourcesNeeded.technology || []).join('; ') || '-',
        '-',
        '-',
      ])
    } else {
      // 有KPI，每个KPI一行
      kpis.forEach((kpi, kpiIndex) => {
        rows.push([
          kpiIndex === 0 ? index + 1 : '',
          kpiIndex === 0 ? measure.title : '',
          kpiIndex === 0 ? measure.resourcesNeeded.budget || '-' : '',
          kpiIndex === 0 ? (measure.resourcesNeeded.personnel || []).join('; ') || '-' : '',
          kpiIndex === 0 ? (measure.resourcesNeeded.technology || []).join('; ') || '-' : '',
          kpi.metric,
          `${kpi.target} (${kpi.measurementMethod})`,
        ])
      })
    }
  })

  return [headers, ...rows]
}

/**
 * 按聚类分组
 */
function groupByCluster(measures: ActionPlanMeasure[]): Record<string, ActionPlanMeasure[]> {
  const grouped: Record<string, ActionPlanMeasure[]> = {}

  measures.forEach((measure) => {
    if (!grouped[measure.clusterName]) {
      grouped[measure.clusterName] = []
    }
    grouped[measure.clusterName].push(measure)
  })

  // 排序
  Object.keys(grouped).forEach((clusterName) => {
    grouped[clusterName].sort((a, b) => a.sortOrder - b.sortOrder)
  })

  return grouped
}

/**
 * 获取优先级文本
 */
function getPriorityText(priority: string): string {
  const map: Record<string, string> = {
    high: '高优先级',
    medium: '中优先级',
    low: '低优先级',
  }
  return map[priority] || priority
}
