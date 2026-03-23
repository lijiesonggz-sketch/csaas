'use client'

/**
 * 简化版成熟度矩阵展示组件
 * 直接展示后端 AI Tasks 返回的矩阵结果
 */

import GridOnIcon from '@mui/icons-material/GridOn'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { useState } from 'react'

interface Dimension {
  id: string
  name: string
  currentLevel: number
  description: string
  levels: string[]
  scores: number[]
  gap?: number
}

interface MatrixResult {
  dimensions: Dimension[]
  overallMaturity: string
  averageScore: number
  targetLevel?: string
  recommendations?: string[]
  metadata?: {
    generatedAt?: string
    totalDimensions?: number
    assessmentDate?: string
  }
}

interface Props {
  result: MatrixResult
}

export default function SimpleMatrixDisplay({ result }: Props) {
  const [selectedDimension, setSelectedDimension] = useState<number | null>(null)

  const getLevelColor = (level: number, maxLevel: number) => {
    const percentage = (level / maxLevel) * 100
    if (percentage >= 80) return 'bg-green-500'
    if (percentage >= 60) return 'bg-blue-500'
    if (percentage >= 40) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const levelLabels = ['初始级', '可重复级', '已定义级', '可管理级', '优化级']

  return (
    <div className="space-y-6">
      {/* 总体概览 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 from-blue-900/30 to-blue-800/30 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-2">
            <GridOnIcon sx={{ fontSize: 20 }} className="text-blue-600" />
            <span className="text-sm font-medium text-gray-700 text-gray-300">评估维度</span>
          </div>
          <p className="text-3xl font-bold text-blue-600">{result.dimensions.length}</p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 from-purple-900/30 to-purple-800/30 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUpIcon sx={{ fontSize: 20 }} className="text-purple-600" />
            <span className="text-sm font-medium text-gray-700 text-gray-300">平均分数</span>
          </div>
          <p className="text-3xl font-bold text-purple-600">{result.averageScore.toFixed(1)}</p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 from-green-900/30 to-green-800/30 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircleIcon sx={{ fontSize: 20 }} className="text-green-600" />
            <span className="text-sm font-medium text-gray-700 text-gray-300">整体成熟度</span>
          </div>
          <p className="text-xl font-bold text-green-600">{result.overallMaturity}</p>
        </div>
      </div>

      {/* 各维度评估 */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 text-white">各维度成熟度评估</h3>

        {result.dimensions.map((dimension, index) => {
          const maxLevel = levelLabels.length - 1
          const isSelected = selectedDimension === index

          return (
            <div
              key={dimension.id}
              className={`bg-white bg-gray-900 rounded-lg p-5 border-2 transition-all cursor-pointer ${
                isSelected
                  ? 'border-blue-500 shadow-lg'
                  : 'border-gray-200 border-gray-700 hover:border-gray-300 hover:border-gray-600'
              }`}
              onClick={() => setSelectedDimension(isSelected ? null : index)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-gray-900 text-white">{dimension.name}</h4>
                    {dimension.gap && (
                      <span className={`text-xs px-2 py-1 rounded ${
                        dimension.gap >= 2
                          ? 'bg-red-100 text-red-700 bg-red-900/30 text-red-400'
                          : dimension.gap === 1
                          ? 'bg-yellow-100 text-yellow-700 bg-yellow-900/30 text-yellow-400'
                          : 'bg-green-100 text-green-700 bg-green-900/30 text-green-400'
                      }`}>
                        差距 {dimension.gap} 级
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 text-gray-400">{dimension.description}</p>
                </div>
                <div className="text-right ml-4">
                  <p className="text-2xl font-bold text-gray-900 text-white">
                    {dimension.currentLevel}
                  </p>
                  <p className="text-xs text-gray-500">/ {maxLevel}</p>
                </div>
              </div>

              {/* 成熟度条形图 */}
              <div className="mb-3">
                <div className="w-full h-3 bg-gray-200 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getLevelColor(dimension.currentLevel, maxLevel)} transition-all duration-300`}
                    style={{ width: `${(dimension.currentLevel / maxLevel) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1 text-xs text-gray-500">
                  {levelLabels.map((label, i) => (
                    <span key={i}>{label}</span>
                  ))}
                </div>
              </div>

              {/* 展开详细分数 */}
              {isSelected && (
                <div className="mt-4 pt-4 border-t border-gray-200 border-gray-700">
                  <p className="text-sm font-medium text-gray-700 text-gray-300 mb-2">详细分数分布：</p>
                  <div className="grid grid-cols-5 gap-2">
                    {dimension.scores.map((score, i) => (
                      <div
                        key={i}
                        className="text-center p-2 bg-gray-50 bg-gray-800 rounded"
                      >
                        <p className="text-xs text-gray-500">{levelLabels[i]}</p>
                        <p className="text-lg font-semibold text-gray-900 text-white">{score}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 改进建议 */}
      {result.recommendations && result.recommendations.length > 0 && (
        <div className="bg-blue-50 bg-blue-900/20 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 text-white mb-4">改进建议</h3>
          <ul className="space-y-2">
            {result.recommendations.map((rec, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-gray-700 text-gray-300">
                <span className="text-blue-600 mt-1">•</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 目标等级 */}
      {result.targetLevel && (
        <div className="bg-green-50 bg-green-900/20 rounded-lg p-4 flex items-center gap-3">
          <CheckCircleIcon sx={{ fontSize: 24 }} className="text-green-600" />
          <div>
            <p className="text-sm font-medium text-gray-700 text-gray-300">目标成熟度等级</p>
            <p className="text-lg font-semibold text-green-700 text-green-400">{result.targetLevel}</p>
          </div>
        </div>
      )}
    </div>
  )
}
