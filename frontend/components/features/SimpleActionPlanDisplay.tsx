'use client'

/**
 * 简化版改进措施展示组件
 * 直接展示后端 AI Tasks 返回的改进措施
 */

import { ListTodo, TrendingUp, Clock, Users, Target } from 'lucide-react'

interface Improvement {
  priority: string
  area: string
  currentLevel?: string
  targetLevel?: string
  actions: string[]
  timeline?: string
  resources?: string
  expectedOutcome?: string
}

interface ActionPlanResult {
  summary: string
  improvements: Improvement[]
  totalMeasures?: number
  metadata?: {
    [key: string]: any
  }
}

interface Props {
  result: ActionPlanResult
}

export default function SimpleActionPlanDisplay({ result }: Props) {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case '高':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-300 dark:border-red-700'
      case '中':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-300 dark:border-yellow-700'
      case '低':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-300 dark:border-green-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case '高':
        return '🔴'
      case '中':
        return '🟡'
      case '低':
        return '🟢'
      default:
        return '⚪'
    }
  }

  return (
    <div className="space-y-6">
      {/* 概述 */}
      {result.summary && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-2">
            <ListTodo className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">改进措施概述</h2>
          </div>
          <p className="text-gray-700 dark:text-gray-300">{result.summary}</p>
        </div>
      )}

      {/* 统计概览 */}
      {result.totalMeasures && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-5 h-5 text-purple-600" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">改进领域</span>
            </div>
            <p className="text-2xl font-bold text-purple-600">{result.improvements.length}</p>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <ListTodo className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">总措施数</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">{result.totalMeasures}</p>
          </div>

          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">高优先级</span>
            </div>
            <p className="text-2xl font-bold text-green-600">
              {result.improvements.filter(i => i.priority === '高').length}
            </p>
          </div>
        </div>
      )}

      {/* 改进措施列表 */}
      <div className="space-y-6">
        {result.improvements.map((improvement, index) => (
          <div
            key={index}
            className="bg-white dark:bg-gray-900 rounded-lg border-2 border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            {/* 标题栏 */}
            <div className={`px-6 py-4 border-b border-gray-200 dark:border-gray-700 ${getPriorityColor(improvement.priority)}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{getPriorityIcon(improvement.priority)}</span>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{improvement.area}</h3>
                    <span className={`text-xs px-3 py-1 rounded-full border-2 ${getPriorityColor(improvement.priority)}`}>
                      {improvement.priority}优先级
                    </span>
                  </div>
                  {improvement.currentLevel && improvement.targetLevel && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-600 dark:text-gray-400">当前：</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{improvement.currentLevel}</span>
                      <span className="text-gray-400">→</span>
                      <span className="text-gray-600 dark:text-gray-400">目标：</span>
                      <span className="font-semibold text-blue-600">{improvement.targetLevel}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 详细内容 */}
            <div className="p-6 space-y-4">
              {/* 建议行动 */}
              <div>
                <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <ListTodo className="w-5 h-5 text-blue-600" />
                  建议行动
                </h4>
                <div className="grid grid-cols-1 gap-2">
                  {improvement.actions.map((action, actionIndex) => (
                    <div
                      key={actionIndex}
                      className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                    >
                      <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                        {actionIndex + 1}
                      </span>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{action}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 元信息 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                {improvement.timeline && (
                  <div className="flex items-start gap-2">
                    <Clock className="w-5 h-5 text-orange-600 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">时间周期</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{improvement.timeline}</p>
                    </div>
                  </div>
                )}

                {improvement.resources && (
                  <div className="flex items-start gap-2">
                    <Users className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">所需资源</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{improvement.resources}</p>
                    </div>
                  </div>
                )}

                {improvement.expectedOutcome && (
                  <div className="flex items-start gap-2">
                    <Target className="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">预期成果</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{improvement.expectedOutcome}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
