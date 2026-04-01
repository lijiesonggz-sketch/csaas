'use client'

/**
 * 综述结果展示组件
 * 展示AI生成的综述内容和审核功能
 */

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { CheckCircle, XCircle, Info, Download } from 'lucide-react'
import type { GenerationResult, SummaryResult } from '@/lib/types/ai-generation'

interface SummaryResultDisplayProps {
  result: GenerationResult
  onReviewComplete?: () => void
}

export default function SummaryResultDisplay({ result, onReviewComplete }: SummaryResultDisplayProps) {
  const summaryResult: SummaryResult = typeof result.selectedResult === 'string'
    ? JSON.parse(result.selectedResult)
    : result.selectedResult as SummaryResult

  const handleApprove = async () => {
    try {
      toast.success('综述已通过审核')
      onReviewComplete?.()
    } catch (error) {
      toast.error('审核操作失败')
    }
  }

  const handleReject = async () => {
    try {
      toast.info('综述已驳回，请重新生成')
      onReviewComplete?.()
    } catch (error) {
      toast.error('审核操作失败')
    }
  }

  const handleExportWord = () => {
    try {
      let htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>${summaryResult.title}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; line-height: 1.6; }
            h1 { color: #1976d2; }
            h2 { color: #262626; margin-top: 30px; border-bottom: 2px solid #1976d2; padding-bottom: 10px; }
            h3 { color: #595959; margin-top: 20px; }
            .key-area { background-color: #f5f5f5; padding: 15px; margin: 10px 0; border-left: 4px solid #1976d2; }
            .meta-info { background-color: #fafafa; padding: 20px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <h1>${summaryResult.title}</h1>

          <div class="meta-info">
            <p><strong>生成时间：</strong>${new Date(result.createdAt).toLocaleString('zh-CN')}</p>
            <p><strong>合规级别：</strong>${summaryResult.compliance_level}</p>
          </div>

          <h2>概述</h2>
          <p>${summaryResult.overview}</p>

          <h2>关键领域</h2>
          ${summaryResult.key_areas.map(area => `
            <div class="key-area">
              <h4>${area.name} (${area.importance === 'HIGH' ? '高重要性' : area.importance === 'MEDIUM' ? '中重要性' : '低重要性'})</h4>
              <p>${area.description}</p>
            </div>
          `).join('')}

          <h2>适用范围</h2>
          <p>${summaryResult.scope}</p>

          <h2>关键要求</h2>
          <ul>
            ${summaryResult.key_requirements.map(req => `<li>${req}</li>`).join('')}
          </ul>
        </body>
        </html>
      `

      const blob = new Blob([htmlContent], { type: 'application/msword' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `summary_${result.taskId}.doc`
      link.click()
      URL.revokeObjectURL(url)

      toast.success('综述已导出为Word文件！')
    } catch (error) {
      toast.error('导出失败：' + (error instanceof Error ? error.message : '未知错误'))
    }
  }

  const getConfidenceColor = (level: string) => {
    switch (level) {
      case 'HIGH':
        return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200'
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200'
      case 'LOW':
        return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  const getModelName = (model: string) => {
    switch (model) {
      case 'gpt4':
        return 'GPT-4'
      case 'claude':
        return 'Claude'
      case 'domestic':
        return '通义千问'
      default:
        return model
    }
  }

  const getImportanceColor = (importance: string) => {
    switch (importance) {
      case 'HIGH':
        return 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700'
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700'
      case 'LOW':
        return 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300'
    }
  }

  return (
    <div className="space-y-6">
      {/* 导出按钮 */}
      <Card>
        <CardContent className="pt-6">
          <Button variant="outline" onClick={handleExportWord}>
            <Download className="w-4 h-4 mr-2" />
            导出Word
          </Button>
        </CardContent>
      </Card>

      {/* 头部信息卡片 */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">生成信息</h3>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <p className="text-sm"><strong>任务ID:</strong> {result.taskId}</p>
            <p className="text-sm"><strong>生成时间:</strong> {new Date(result.createdAt).toLocaleString('zh-CN')}</p>
            <p className="text-sm">
              <strong>选中模型:</strong>{' '}
              <Badge variant="outline">{getModelName(result.selectedModel)}</Badge>
            </p>
            <p className="text-sm">
              <strong>置信度:</strong>{' '}
              <Badge className={getConfidenceColor(result.confidenceLevel)} variant="outline">
                {result.confidenceLevel}
              </Badge>
            </p>
            <p className="text-sm">
              <strong>审核状态:</strong>
              {result.reviewStatus === 'PENDING' && <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200">待审核</Badge>}
              {result.reviewStatus === 'APPROVED' && <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200">已批准</Badge>}
              {result.reviewStatus === 'MODIFIED' && <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200">已修改</Badge>}
              {result.reviewStatus === 'REJECTED' && <Badge className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200">已拒绝</Badge>}
            </p>
            <p className="text-sm"><strong>版本:</strong> v{result.version}</p>
          </div>
        </CardContent>
      </Card>

      {/* 质量评分卡片 */}
      {result.qualityScores && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">质量评分</h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <p className="text-sm">结构一致性 (要求 ≥90%)</p>
                  <p className="text-sm font-semibold">{((result.qualityScores?.structural || 0) * 100).toFixed(1)}%</p>
                </div>
                <Progress
                  value={parseFloat(((result.qualityScores?.structural || 0) * 100).toFixed(1))}
                  className={(result.qualityScores?.structural || 0) >= 0.9 ? '[&>div]:bg-green-500' : '[&>div]:bg-red-500'}
                />
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <p className="text-sm">语义一致性 (要求 ≥80%)</p>
                  <p className="text-sm font-semibold">{((result.qualityScores?.semantic || 0) * 100).toFixed(1)}%</p>
                </div>
                <Progress
                  value={parseFloat(((result.qualityScores?.semantic || 0) * 100).toFixed(1))}
                  className={(result.qualityScores?.semantic || 0) >= 0.8 ? '[&>div]:bg-green-500' : '[&>div]:bg-red-500'}
                />
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <p className="text-sm">细节一致性 (要求 ≥60%)</p>
                  <p className="text-sm font-semibold">{((result.qualityScores?.detail || 0) * 100).toFixed(1)}%</p>
                </div>
                <Progress
                  value={parseFloat(((result.qualityScores?.detail || 0) * 100).toFixed(1))}
                  className={(result.qualityScores?.detail || 0) >= 0.6 ? '[&>div]:bg-green-500' : '[&>div]:bg-red-500'}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 综述内容卡片 */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <h3 className="text-xl font-semibold">{summaryResult.title}</h3>
            {result.reviewStatus === 'PENDING' && (
              <div className="flex gap-2">
                <Button size="sm" onClick={handleApprove}>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  批准
                </Button>
                <Button size="sm" variant="outline" onClick={handleReject}>
                  <XCircle className="w-4 h-4 mr-2" />
                  驳回
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* 概述 */}
            <div>
              <h4 className="text-lg font-semibold mb-2 text-blue-600 dark:text-blue-400">概述</h4>
              <p>{summaryResult.overview}</p>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700" />

            {/* 关键领域 */}
            <div>
              <h4 className="text-lg font-semibold mb-4 text-blue-600 dark:text-blue-400">关键领域</h4>
              <div className="space-y-4">
                {summaryResult.key_areas.map((area, index) => (
                  <Card key={index} className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="font-semibold">{area.name}</p>
                        <Badge className={getImportanceColor(area.importance)} variant="outline">
                          {area.importance === 'HIGH' ? '高' : area.importance === 'MEDIUM' ? '中' : '低'}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{area.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700" />

            {/* 适用范围 */}
            <div>
              <h4 className="text-lg font-semibold mb-2 text-blue-600 dark:text-blue-400">适用范围</h4>
              <p>{summaryResult.scope}</p>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700" />

            {/* 关键要求 */}
            <div>
              <h4 className="text-lg font-semibold mb-4 text-blue-600 dark:text-blue-400">关键要求</h4>
              <ul className="space-y-2">
                {summaryResult.key_requirements.map((req, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>{req}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700" />

            {/* 合规级别 */}
            <div>
              <h4 className="text-lg font-semibold mb-2 text-blue-600 dark:text-blue-400">合规级别说明</h4>
              <p>{summaryResult.compliance_level}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
