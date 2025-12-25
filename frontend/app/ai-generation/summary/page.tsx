'use client'

/**
 * 综述生成页面
 * 集成文档上传、实时进度跟踪和结果展示
 */

import { useState } from 'react'
import { Card, Button, message, Steps } from 'antd'
import { FileTextOutlined, ThunderboltOutlined, CheckOutlined } from '@ant-design/icons'
import DocumentUploader from '@/components/features/DocumentUploader'
import TaskProgressBar from '@/components/features/TaskProgressBar'
import SummaryResultDisplay from '@/components/features/SummaryResultDisplay'
import { AIGenerationAPI } from '@/lib/api/ai-generation'
import type { GenerationResult } from '@/lib/types/ai-generation'
import { v4 as uuidv4 } from 'uuid'

export default function SummaryGenerationPage() {
  const [currentStep, setCurrentStep] = useState(0)
  const [documentContent, setDocumentContent] = useState('')
  const [taskId, setTaskId] = useState<string | null>(null)
  const [result, setResult] = useState<GenerationResult | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  // 开始生成
  const handleStartGeneration = async () => {
    if (!documentContent || documentContent.length < 100) {
      message.error('请输入至少100字的标准文档内容')
      return
    }

    const newTaskId = uuidv4()
    setTaskId(newTaskId)
    setIsGenerating(true)
    setCurrentStep(1)

    try {
      const response = await AIGenerationAPI.generateSummary({
        taskId: newTaskId,
        standardDocument: documentContent,
        temperature: 0.7,
        maxTokens: 4000,
      })

      if (response.success) {
        message.success('生成任务已启动，请等待完成...')
      }
    } catch (error: any) {
      message.error(error.message || '启动生成任务失败')
      setIsGenerating(false)
      setCurrentStep(0)
      setTaskId(null)
    }
  }

  // 生成完成回调
  const handleGenerationCompleted = async () => {
    if (!taskId) return

    try {
      const response = await AIGenerationAPI.getResult(taskId)
      if (response.success) {
        setResult(response.data)
        setCurrentStep(2)
        setIsGenerating(false)
        message.success('综述生成完成！')
      }
    } catch (error: any) {
      message.error(error.message || '获取生成结果失败')
    }
  }

  // 生成失败回调
  const handleGenerationFailed = (error: string) => {
    message.error(`生成失败：${error}`)
    setIsGenerating(false)
    setCurrentStep(0)
    setTaskId(null)
  }

  // 重新生成
  const handleRestart = () => {
    setCurrentStep(0)
    setTaskId(null)
    setResult(null)
    setDocumentContent('')
    setIsGenerating(false)
  }

  // 审核完成回调
  const handleReviewComplete = () => {
    message.success('审核操作已完成')
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">AI 综述生成</h1>
        <p className="text-gray-600">
          上传或粘贴IT标准文档，系统将使用三个AI模型（GPT-4、Claude、通义千问）并行生成高质量综述
        </p>
      </div>

      {/* 步骤指示器 */}
      <Card className="mb-6">
        <Steps
          current={currentStep}
          items={[
            {
              title: '上传文档',
              icon: <FileTextOutlined />,
              description: '粘贴或上传标准文档',
            },
            {
              title: '生成中',
              icon: <ThunderboltOutlined />,
              description: '三模型并行生成',
            },
            {
              title: '查看结果',
              icon: <CheckOutlined />,
              description: '质量验证和审核',
            },
          ]}
        />
      </Card>

      {/* 步骤 1: 文档上传 */}
      {currentStep === 0 && (
        <Card title="步骤 1: 上传标准文档" className="mb-6">
          <DocumentUploader onDocumentChange={setDocumentContent} disabled={isGenerating} />

          <div className="mt-6 flex justify-between items-center">
            <div className="text-sm text-gray-500">
              {documentContent.length > 0 && (
                <span>
                  当前文档长度：<strong>{documentContent.length}</strong> 字符
                </span>
              )}
            </div>
            <Button
              type="primary"
              size="large"
              onClick={handleStartGeneration}
              disabled={!documentContent || documentContent.length < 100 || isGenerating}
            >
              开始生成综述
            </Button>
          </div>
        </Card>
      )}

      {/* 步骤 2: 生成中 */}
      {currentStep === 1 && (
        <Card title="步骤 2: 正在生成综述" className="mb-6">
          <TaskProgressBar
            taskId={taskId}
            onCompleted={handleGenerationCompleted}
            onFailed={handleGenerationFailed}
          />

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500 mb-4">
              系统正在使用GPT-4、Claude和通义千问三个模型并行生成综述，这可能需要1-3分钟...
            </p>
            <Button onClick={handleRestart} disabled={isGenerating}>
              取消并返回
            </Button>
          </div>
        </Card>
      )}

      {/* 步骤 3: 查看结果 */}
      {currentStep === 2 && result && (
        <div className="space-y-6">
          <Card
            title="步骤 3: 查看生成结果"
            extra={
              <Button type="default" onClick={handleRestart}>
                重新生成
              </Button>
            }
          >
            <SummaryResultDisplay result={result} onReviewComplete={handleReviewComplete} />
          </Card>

          {/* 导出选项 */}
          <Card title="导出选项" size="small">
            <div className="flex gap-4 justify-center">
              <Button
                type="primary"
                onClick={() => {
                  const dataStr = JSON.stringify(result.selectedResult, null, 2)
                  const dataBlob = new Blob([dataStr], { type: 'application/json' })
                  const url = URL.createObjectURL(dataBlob)
                  const link = document.createElement('a')
                  link.href = url
                  link.download = `summary-${result.taskId}.json`
                  link.click()
                  URL.revokeObjectURL(url)
                  message.success('JSON文件已导出')
                }}
              >
                导出为 JSON
              </Button>
              <Button
                onClick={() => {
                  const summaryResult = result.selectedResult as any
                  let markdown = `# ${summaryResult.title}\n\n`
                  markdown += `## 概述\n\n${summaryResult.overview}\n\n`
                  markdown += `## 关键领域\n\n`
                  summaryResult.key_areas.forEach((area: any) => {
                    markdown += `### ${area.name} (重要性: ${area.importance})\n\n${area.description}\n\n`
                  })
                  markdown += `## 适用范围\n\n${summaryResult.scope}\n\n`
                  markdown += `## 关键要求\n\n`
                  summaryResult.key_requirements.forEach((req: string) => {
                    markdown += `- ${req}\n`
                  })
                  markdown += `\n## 合规级别说明\n\n${summaryResult.compliance_level}\n`

                  const dataBlob = new Blob([markdown], { type: 'text/markdown' })
                  const url = URL.createObjectURL(dataBlob)
                  const link = document.createElement('a')
                  link.href = url
                  link.download = `summary-${result.taskId}.md`
                  link.click()
                  URL.revokeObjectURL(url)
                  message.success('Markdown文件已导出')
                }}
              >
                导出为 Markdown
              </Button>
              <Button
                onClick={() => {
                  const summaryResult = result.selectedResult as any
                  let text = `${summaryResult.title}\n\n`
                  text += `概述：\n${summaryResult.overview}\n\n`
                  text += `关键领域：\n`
                  summaryResult.key_areas.forEach((area: any, index: number) => {
                    text += `${index + 1}. ${area.name} (${area.importance})\n   ${area.description}\n\n`
                  })
                  text += `适用范围：\n${summaryResult.scope}\n\n`
                  text += `关键要求：\n`
                  summaryResult.key_requirements.forEach((req: string, index: number) => {
                    text += `${index + 1}. ${req}\n`
                  })
                  text += `\n合规级别说明：\n${summaryResult.compliance_level}\n`

                  const dataBlob = new Blob([text], { type: 'text/plain' })
                  const url = URL.createObjectURL(dataBlob)
                  const link = document.createElement('a')
                  link.href = url
                  link.download = `summary-${result.taskId}.txt`
                  link.click()
                  URL.revokeObjectURL(url)
                  message.success('TXT文件已导出')
                }}
              >
                导出为 TXT
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
