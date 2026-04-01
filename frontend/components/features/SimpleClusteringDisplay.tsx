'use client'

/**
 * 简化版聚类结果展示组件
 * 直接展示后端 AI Tasks 返回的聚类结果
 */

import { useState } from 'react'
import { CheckCircle, AlertTriangle, FileText, TrendingUp } from 'lucide-react'

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
  importance: 'HIGH' | 'MEDIUM' | 'LOW'
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW'
  clauses: ClusterClause[]
}

interface Category {
  id: string
  name: string
  description: string
  clusters: Cluster[]
}

interface CoverageSummary {
  overall: {
    total_clauses: number
    clustered_clauses: number
    coverage_rate: number
  }
}

interface ClusteringResult {
  categories: Category[]
  clustering_logic: string
  coverage_summary: CoverageSummary
  metadata?: {
    total_clusters?: number
    total_categories?: number
  }
}

interface Props {
  result: ClusteringResult
}

export default function SimpleClusteringDisplay({ result }: Props) {
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(new Set())

  const toggleCluster = (clusterId: string) => {
    const newExpanded = new Set(expandedClusters)
    if (newExpanded.has(clusterId)) {
      newExpanded.delete(clusterId)
    } else {
      newExpanded.add(clusterId)
    }
    setExpandedClusters(newExpanded)
  }

  const getImportanceColor = (importance: string) => {
    switch (importance) {
      case 'HIGH':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
      case 'MEDIUM':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
      case 'LOW':
        return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'HIGH':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
      case 'MEDIUM':
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
      case 'LOW':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  const totalClusters = result.categories.reduce((sum, cat) => sum + cat.clusters.length, 0)
  const totalClauses = result.categories.flatMap(cat =>
    cat.clusters.flatMap(cluster => cluster.clauses)
  ).length
  const coverageRate = result.coverage_summary?.overall?.coverage_rate
    ? (result.coverage_summary.overall.coverage_rate * 100).toFixed(1)
    : '0'

  return (
    <div className="space-y-6">
      {/* 统计概览 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-sm p-4 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">分类数量</span>
          </div>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{result.categories.length}</p>
        </div>

        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-sm p-4 border border-purple-200 dark:border-purple-800">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">聚类数量</span>
          </div>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{totalClusters}</p>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 rounded-sm p-4 border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">条款总数</span>
          </div>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{totalClauses}</p>
        </div>

        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-sm p-4 border border-orange-200 dark:border-orange-800">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">覆盖率</span>
          </div>
          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{coverageRate}%</p>
        </div>
      </div>

      {/* 聚类逻辑说明 */}
      {result.clustering_logic && (
        <div className="bg-gray-50 dark:bg-gray-900 rounded-sm p-4 mb-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            聚类方法
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {result.clustering_logic}
          </p>
        </div>
      )}

      {/* 分类和聚类 */}
      <div className="space-y-6">
        {result.categories.map((category) => (
          <div key={category.id} className="border border-gray-200 dark:border-gray-700 rounded-sm overflow-hidden">
            {/* 分类标题 */}
            <div className="bg-gray-50 dark:bg-gray-900 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold mb-1">
                {category.name}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{category.description}</p>
              <div className="mt-2 flex gap-2">
                <span className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-sm">
                  {category.clusters.length} 个聚类
                </span>
                <span className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-sm">
                  {category.clusters.reduce((sum, c) => sum + c.clauses.length, 0)} 个条款
                </span>
              </div>
            </div>

            {/* 聚类列表 */}
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {category.clusters.map((cluster) => (
                <div key={cluster.id} className="p-6">
                  <div
                    className="flex items-start justify-between cursor-pointer"
                    onClick={() => toggleCluster(cluster.id)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="text-base font-semibold">
                          {cluster.name}
                        </h4>
                        <span className={`text-xs px-2 py-1 rounded-sm ${getImportanceColor(cluster.importance)}`}>
                          {cluster.importance === 'HIGH' ? '高重要性' : cluster.importance === 'MEDIUM' ? '中重要性' : '低重要性'}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-sm ${getRiskColor(cluster.risk_level)}`}>
                          {cluster.risk_level === 'HIGH' ? '高风险' : cluster.risk_level === 'MEDIUM' ? '中风险' : '低风险'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{cluster.description}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        {cluster.clauses.length} 个条款
                      </p>
                    </div>
                    <button className="ml-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                      {expandedClusters.has(cluster.id) ? '▼' : '▶'}
                    </button>
                  </div>

                  {/* 展开的条款 */}
                  {expandedClusters.has(cluster.id) && (
                    <div className="mt-4 space-y-3">
                      {cluster.clauses.map((clause, idx) => (
                        <div
                          key={`${clause.clause_id}-${idx}`}
                          className="bg-gray-50 dark:bg-gray-900 rounded-sm p-4 border border-gray-200 dark:border-gray-700"
                        >
                          <div className="flex items-start gap-3 mb-2">
                            <span className="flex-shrink-0 text-xs font-mono text-gray-500 bg-gray-200 dark:bg-gray-800 px-2 py-1 rounded-sm">
                              {clause.clause_id}
                            </span>
                            <div className="flex-1">
                              <p className="text-sm font-medium mb-1">
                                {clause.clause_text.substring(0, 100)}
                                {clause.clause_text.length > 100 ? '...' : ''}
                              </p>
                              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                                <span className="font-semibold">来源：</span>
                                {clause.source_document_name}
                              </p>
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                <span className="font-semibold">理由：</span>
                                {clause.rationale}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
