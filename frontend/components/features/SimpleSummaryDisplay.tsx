'use client'

/**
 * 简化版综述结果展示组件
 * 直接展示后端 AI Tasks 返回的综述结果
 */

import { FileText, CheckCircle2, AlertCircle, TrendingUp } from 'lucide-react'

interface KeyArea {
  name: string
  description: string
  importance: 'HIGH' | 'MEDIUM' | 'LOW'
}

interface SummaryResult {
  selectedResult: string
}

interface Props {
  result: SummaryResult
}

export default function SimpleSummaryDisplay({ result }: Props) {
  // 解析 selectedResult
  const summaryResult = typeof result.selectedResult === 'string'
    ? JSON.parse(result.selectedResult)
    : result.selectedResult

  const { title, overview, key_areas = [], key_requirements = [], compliance_level } = summaryResult

  const getImportanceColor = (importance: string) => {
    switch (importance) {
      case 'HIGH':
        return 'border-l-purple-500 bg-purple-50 dark:bg-purple-900/20'
      case 'MEDIUM':
        return 'border-l-blue-500 bg-blue-50 dark:bg-blue-900/20'
      case 'LOW':
        return 'border-l-gray-500 bg-gray-50 dark:bg-gray-900/20'
      default:
        return 'border-l-gray-500 bg-gray-50'
    }
  }

  return (
    <div className="space-y-6">
      {/* 标题和概述 */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">{title}</h2>
        <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{overview}</p>
      </div>

      {/* 合规等级 */}
      {compliance_level && (
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-green-600" />
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">当前合规等级</p>
            <p className="text-lg font-semibold text-green-700 dark:text-green-400">{compliance_level}</p>
          </div>
        </div>
      )}

      {/* 关键领域 */}
      {key_areas && key_areas.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            关键领域
          </h3>
          <div className="grid grid-cols-1 gap-4">
            {key_areas.map((area: KeyArea, index: number) => (
              <div
                key={index}
                className={`border-l-4 rounded-lg p-4 ${getImportanceColor(area.importance)}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold text-gray-900 dark:text-white">{area.name}</h4>
                  <span className={`text-xs px-2 py-1 rounded ${
                    area.importance === 'HIGH'
                      ? 'bg-purple-200 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                      : area.importance === 'MEDIUM'
                      ? 'bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                      : 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    {area.importance === 'HIGH' ? '高' : area.importance === 'MEDIUM' ? '中' : '低'}
                  </span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300">{area.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 关键要求 */}
      {key_requirements && key_requirements.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            关键要求
          </h3>
          <ul className="space-y-2">
            {key_requirements.map((req: string, index: number) => (
              <li key={index} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                <span className="text-blue-600 mt-1">•</span>
                <span>{req}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
