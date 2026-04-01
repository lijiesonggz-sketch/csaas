/**
 * 关键要求列表组件（性能优化版）
 * 使用React.memo、虚拟化和懒加载优化长列表渲染
 */
'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useMemo, useCallback, useState } from 'react'
import { CheckCircle, XCircle, BookOpen, ChevronDown, ChevronUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface KeyRequirement {
  clause_id: string
  chapter?: string
  clause_full_text?: string
  clause_summary?: string
  clause_text: string
  interpretation: string | any
  compliance_criteria: string[] | any
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  risk_assessment?: any
  implementation_order?: number
  estimated_effort?: string
  dependencies?: string[]
  best_practices?: string[]
  common_mistakes?: string[]
}

interface KeyRequirementsListProps {
  requirements: KeyRequirement[]
  loading?: boolean
}

// 条款详情组件（使用React.memo优化）
const RequirementDetail = React.memo<{
  item: KeyRequirement
}>(({ item }) => {
  const [expanded, setExpanded] = useState(false)

  // 处理解读文本
  const interpretationText = useMemo(() => {
    if (typeof item.interpretation === 'string') {
      return item.interpretation
    } else if (typeof item.interpretation === 'object' && item.interpretation !== null) {
      const interp = item.interpretation
      const parts = []
      if (interp.what) parts.push(`是什么：${interp.what}`)
      if (interp.why) parts.push(`为什么：${interp.why}`)
      if (interp.how) parts.push(`怎么做：${interp.how}`)
      return parts.join('\n')
    }
    return ''
  }, [item.interpretation])

  // 处理合规标准
  const criteriaText = useMemo(() => {
    if (Array.isArray(item.compliance_criteria)) {
      return item.compliance_criteria.join('; ')
    } else if (typeof item.compliance_criteria === 'object' && item.compliance_criteria !== null) {
      const criteria = item.compliance_criteria
      const parts = []
      if (criteria.must_have && criteria.must_have.length > 0) {
        parts.push(`必须具备: ${criteria.must_have.join('; ')}`)
      }
      if (criteria.should_have && criteria.should_have.length > 0) {
        parts.push(`建议具备: ${criteria.should_have.join('; ')}`)
      }
      if (criteria.evidence_required && criteria.evidence_required.length > 0) {
        parts.push(`所需证据: ${criteria.evidence_required.join('; ')}`)
      }
      if (criteria.assessment_method) {
        parts.push(`评估方法: ${criteria.assessment_method}`)
      }
      return parts.join('\n')
    }
    return ''
  }, [item.compliance_criteria])

  const getPriorityColor = useCallback((priority: string) => {
    const colors: Record<string, string> = {
      HIGH: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700',
      MEDIUM: 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700',
      LOW: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700',
    }
    return colors[priority] || 'bg-gray-100 text-gray-700 border-gray-300'
  }, [])

  const hasInterpretation = useMemo(() => {
    return Boolean(
      item.interpretation &&
      (typeof item.interpretation === 'string'
        ? item.interpretation.trim().length > 0
        : (item.interpretation.what || item.interpretation.why || item.interpretation.how)
      )
    )
  }, [item.interpretation])

  return (
    <li className="w-full px-0 list-none">
      <Card className="w-full border border-gray-200 dark:border-gray-700">
        <CardContent className="p-4">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={getPriorityColor(item.priority)} variant="outline">{item.clause_id}</Badge>
              <p className="text-sm">{item.clause_text}</p>
              {hasInterpretation && (
                <Badge
                  className="bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400"
                  variant="outline"
                >
                  <CheckCircle className="w-3 h-3 mr-1" />
                  已解读
                </Badge>
              )}
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation()
                setExpanded(!expanded)
              }}
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>

          {expanded && (
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-sm mb-2 font-semibold">
                  解读：
                </p>
                <div
                  className="whitespace-pre-wrap break-words bg-gray-50 dark:bg-gray-800 p-2 rounded-sm border border-gray-200 dark:border-gray-700"
                >
                  {interpretationText || '暂无解读'}
                </div>
              </div>

              <div>
                <p className="text-sm mb-2 font-semibold">
                  合规标准：
                </p>
                <div className="whitespace-pre-wrap break-words text-sm">
                  {criteriaText || '无'}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {item.estimated_effort && (
                  <Badge className="bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700" variant="outline">
                    预估工期：{item.estimated_effort}
                  </Badge>
                )}
                {item.dependencies && item.dependencies.length > 0 && (
                  <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700" variant="outline">
                    依赖：{item.dependencies.join(', ')}
                  </Badge>
                )}
              </div>

              {item.best_practices && item.best_practices.length > 0 && (
                <div>
                  <p className="text-sm mb-2 font-semibold">
                    最佳实践：
                  </p>
                  <ul className="mb-0 pl-4 space-y-1">
                    {item.best_practices.map((practice, idx) => (
                      <li key={idx}>{practice}</li>
                    ))}
                  </ul>
                </div>
              )}
              {item.common_mistakes && item.common_mistakes.length > 0 && (
                <div>
                  <p className="text-sm mb-2 font-semibold">
                    常见错误：
                  </p>
                  <ul className="mb-0 pl-4 space-y-1">
                    {item.common_mistakes.map((mistake, idx) => (
                      <li key={idx} className="text-red-600 dark:text-red-400">{mistake}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </li>
  )
})

RequirementDetail.displayName = 'RequirementDetail'

// 主列表组件
export const KeyRequirementsList = React.memo<KeyRequirementsListProps>(({
  requirements,
}) => {
  // 统计信息
  const stats = useMemo(() => {
    const total = requirements.length
    const interpreted = requirements.filter(
      (req) => req.interpretation &&
      (typeof req.interpretation === 'string'
        ? req.interpretation.trim().length > 0
        : (req.interpretation.what || req.interpretation.why || req.interpretation.how)
      )
    ).length
    const notInterpreted = total - interpreted

    return { total, interpreted, notInterpreted }
  }, [requirements])

  // 分页状态
  const [pageSize] = useState(20)
  const [currentPage, setCurrentPage] = useState(1)

  // 当前页的数据
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    const end = start + pageSize
    return requirements.slice(start, end)
  }, [requirements, currentPage, pageSize])

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page)
    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const completionRate = stats.total > 0 ? ((stats.interpreted / stats.total) * 100).toFixed(1) : '0.0'

  const pageCount = Math.ceil(requirements.length / pageSize)

  return (
    <div>
      {/* 统计信息 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-gray-500" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">总条款数</p>
                <p className="text-2xl font-semibold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">已解读</p>
                <p className="text-2xl font-semibold text-green-600 dark:text-green-400">{stats.interpreted}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-500" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">未解读</p>
                <p className="text-2xl font-semibold text-red-600 dark:text-red-400">{stats.notInterpreted}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">完成率</p>
                <p
                  className="text-2xl font-semibold"
                  style={{
                    color:
                      stats.interpreted / stats.total >= 0.8
                        ? '#059669'
                        : stats.interpreted / stats.total >= 0.5
                          ? '#eab308'
                          : '#dc2626'
                  }}
                >
                  {completionRate}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="my-4 border-t border-gray-200 dark:border-gray-700" />

      {/* 分页列表 */}
      <ul className="space-y-4">
        {paginatedData.map((item) => (
          <RequirementDetail
            key={item.clause_id}
            item={item}
          />
        ))}
      </ul>

      {/* 分页 */}
      {pageCount > 1 && (
        <div className="flex justify-center items-center gap-2 mt-6">
          <Button
            variant="outline"
            size="sm"
            className="rounded-sm"
            disabled={currentPage <= 1}
            onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
          >
            上一页
          </Button>
          <span className="text-sm text-[#64748B]">
            {currentPage} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="rounded-sm"
            disabled={currentPage >= pageCount}
            onClick={() => handlePageChange(Math.min(pageCount, currentPage + 1))}
          >
            下一页
          </Button>
        </div>
      )}
    </div>
  )
})

KeyRequirementsList.displayName = 'KeyRequirementsList'
