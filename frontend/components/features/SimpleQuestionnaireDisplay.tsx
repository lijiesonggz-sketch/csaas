'use client'

/**
 * 简化版问卷结果展示组件
 * 直接展示后端 AI Tasks 返回的问卷结果
 */

import AssignmentIcon from '@mui/icons-material/Assignment'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import WarningIcon from '@mui/icons-material/Warning'
import { useState } from 'react'

interface Question {
  id: string
  text: string
  type: string
  answer: string
  weight?: string
  recommendation?: string
}

interface Section {
  id: string
  title: string
  questions: Question[]
}

interface QuestionnaireResult {
  sections: Section[]
  totalQuestions: number
  answeredQuestions: number
  completionRate?: number
}

interface Props {
  result: QuestionnaireResult
}

export default function SimpleQuestionnaireDisplay({ result }: Props) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(result.sections.map(s => s.id)))

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId)
    } else {
      newExpanded.add(sectionId)
    }
    setExpandedSections(newExpanded)
  }

  const getAnswerIcon = (answer: string) => {
    if (answer === 'yes') {
      return <CheckCircleIcon sx={{ fontSize: 20 }} className="text-green-600" />
    } else if (answer === 'no') {
      return <CancelIcon sx={{ fontSize: 20 }} className="text-red-600" />
    } else {
      return <WarningIcon sx={{ fontSize: 20 }} className="text-yellow-600" />
    }
  }

  const getAnswerText = (answer: string) => {
    if (answer === 'yes') return '是'
    if (answer === 'no') return '否'
    if (answer === 'partial') return '部分符合'
    return answer
  }

  const getAnswerColor = (answer: string) => {
    if (answer === 'yes') {
      return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
    } else if (answer === 'no') {
      return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
    } else {
      return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
    }
  }

  const completionRate = result.completionRate || Math.round((result.answeredQuestions / result.totalQuestions) * 100)

  return (
    <div className="space-y-6">
      {/* 统计概览 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AssignmentIcon sx={{ fontSize: 20 }} className="text-blue-600" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">总问题数</span>
          </div>
          <p className="text-2xl font-bold text-blue-600">{result.totalQuestions}</p>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircleIcon sx={{ fontSize: 20 }} className="text-green-600" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">已回答</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{result.answeredQuestions}</p>
        </div>

        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircleIcon sx={{ fontSize: 20 }} className="text-purple-600" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">完成率</span>
          </div>
          <p className="text-2xl font-bold text-purple-600">{completionRate}%</p>
        </div>
      </div>

      {/* 问卷部分 */}
      <div className="space-y-4">
        {result.sections.map((section) => (
          <div
            key={section.id}
            className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
          >
            {/* 部分标题 */}
            <div
              className="bg-gray-50 dark:bg-gray-900 px-6 py-4 cursor-pointer flex items-center justify-between"
              onClick={() => toggleSection(section.id)}
            >
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {section.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {section.questions.length} 个问题
                </p>
              </div>
              <button className="ml-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                {expandedSections.has(section.id) ? '▼' : '▶'}
              </button>
            </div>

            {/* 问题列表 */}
            {expandedSections.has(section.id) && (
              <div className="p-6 space-y-4">
                {section.questions.map((question) => (
                  <div
                    key={question.id}
                    className={`border rounded-lg p-4 ${getAnswerColor(question.answer)}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                          {question.text}
                        </p>
                        {question.weight && (
                          <span className={`text-xs px-2 py-1 rounded ${
                            question.weight === 'high'
                              ? 'bg-purple-200 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                              : 'bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                          }`}>
                            {question.weight === 'high' ? '重要' : '中等'}
                          </span>
                        )}
                      </div>
                      <div className="ml-4 flex items-center gap-2">
                        {getAnswerIcon(question.answer)}
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                          {getAnswerText(question.answer)}
                        </span>
                      </div>
                    </div>

                    {/* 建议 */}
                    {question.recommendation && (
                      <div className="mt-3 pt-3 border-t border-gray-300 dark:border-gray-600">
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          <span className="font-semibold">建议：</span>
                          {question.recommendation}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
