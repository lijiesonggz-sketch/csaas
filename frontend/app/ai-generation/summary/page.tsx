'use client'

/**
 * 综述生成页面
 * 集成文档上传、实时进度跟踪和结果展示
 */

import { useState } from 'react'
import { toast } from 'sonner'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Button from '@mui/material/Button'
import Stepper from '@mui/material/Stepper'
import Step from '@mui/material/Step'
import StepLabel from '@mui/material/StepLabel'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import DescriptionIcon from '@mui/icons-material/Description'
import FlashOnIcon from '@mui/icons-material/FlashOn'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import DocumentUploader from '@/components/features/DocumentUploader'
import TaskProgressBar from '@/components/features/TaskProgressBar'
import SummaryResultDisplay from '@/components/features/SummaryResultDisplay'
import { AIGenerationAPI } from '@/lib/api/ai-generation'
import type { GenerationResult } from '@/lib/types/ai-generation'
import { v4 as uuidv4 } from 'uuid'

const steps = [
  {
    label: '上传文档',
    description: '粘贴或上传标准文档',
    icon: DescriptionIcon,
  },
  {
    label: '生成中',
    description: '三模型并行生成',
    icon: FlashOnIcon,
  },
  {
    label: '查看结果',
    description: '质量验证和审核',
    icon: CheckCircleIcon,
  },
]

export default function SummaryGenerationPage() {
  const [currentStep, setCurrentStep] = useState(0)
  const [documentContent, setDocumentContent] = useState('')
  const [taskId, setTaskId] = useState<string | null>(null)
  const [result, setResult] = useState<GenerationResult | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  // 开始生成
  const handleStartGeneration = async () => {
    if (!documentContent || documentContent.length < 100) {
      toast.error('请输入至少100字的标准文档内容')
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
        toast.success('生成任务已启动，请等待完成...')
      }
    } catch (error: any) {
      toast.error(error.message || '启动生成任务失败')
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
        toast.success('综述生成完成！')
      }
    } catch (error: any) {
      toast.error(error.message || '获取生成结果失败')
    }
  }

  // 生成失败回调
  const handleGenerationFailed = (error: string) => {
    toast.error(`生成失败：${error}`)
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
    toast.success('审核操作已完成')
  }

  return (
    <Box sx={{ maxWidth: 'lg', mx: 'auto', px: 2, py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom fontWeight="bold" color="text.primary">
          AI 综述生成
        </Typography>
        <Typography variant="body1" color="text.secondary">
          上传或粘贴IT标准文档，系统将使用三个AI模型（GPT-4、Claude、通义千问）并行生成高质量综述
        </Typography>
      </Box>

      {/* 步骤指示器 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stepper activeStep={currentStep} alternativeLabel>
            {steps.map((step, index) => {
              const Icon = step.icon
              return (
                <Step key={index}>
                  <StepLabel
                    StepIconComponent={() => (
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: currentStep >= index ? 'primary.main' : 'grey.300',
                          color: currentStep >= index ? 'white' : 'grey.600',
                        }}
                      >
                        <Icon fontSize="small" />
                      </Box>
                    )}
                  >
                    <Typography variant="subtitle2">{step.label}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {step.description}
                    </Typography>
                  </StepLabel>
                </Step>
              )
            })}
          </Stepper>
        </CardContent>
      </Card>

      {/* 步骤 1: 文档上传 */}
      {currentStep === 0 && (
        <Card>
          <CardHeader title="步骤 1: 上传标准文档" />
          <CardContent>
            <DocumentUploader onDocumentChange={setDocumentContent} disabled={isGenerating} />

            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                {documentContent.length > 0 && (
                  <span>
                    当前文档长度：<strong>{documentContent.length}</strong> 字符
                  </span>
                )}
              </Typography>
              <Button
                variant="contained"
                size="large"
                onClick={handleStartGeneration}
                disabled={!documentContent || documentContent.length < 100 || isGenerating}
              >
                开始生成综述
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* 步骤 2: 生成中 */}
      {currentStep === 1 && (
        <Card>
          <CardHeader title="步骤 2: 正在生成综述" />
          <CardContent>
            <TaskProgressBar
              taskId={taskId}
              onCompleted={handleGenerationCompleted}
              onFailed={handleGenerationFailed}
            />

            <Box sx={{ mt: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                系统正在使用GPT-4、Claude和通义千问三个模型并行生成综述，这可能需要1-3分钟...
              </Typography>
              <Button variant="outlined" onClick={handleRestart} disabled={isGenerating}>
                取消并返回
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* 步骤 3: 查看结果 */}
      {currentStep === 2 && result && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Card>
            <CardHeader
              title="步骤 3: 查看生成结果"
              action={
                <Button variant="outlined" onClick={handleRestart}>
                  重新生成
                </Button>
              }
            />
            <CardContent>
              <SummaryResultDisplay result={result} onReviewComplete={handleReviewComplete} />
            </CardContent>
          </Card>

          {/* 导出选项 */}
          <Card>
            <CardHeader title="导出选项" />
            <CardContent>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                <Button
                  variant="contained"
                  onClick={() => {
                    const selectedResult =
                      typeof result.selectedResult === 'string'
                        ? JSON.parse(result.selectedResult)
                        : result.selectedResult
                    const dataStr = JSON.stringify(selectedResult, null, 2)
                    const dataBlob = new Blob([dataStr], { type: 'application/json' })
                    const url = URL.createObjectURL(dataBlob)
                    const link = document.createElement('a')
                    link.href = url
                    link.download = `summary-${result.taskId}.json`
                    link.click()
                    URL.revokeObjectURL(url)
                    toast.success('JSON文件已导出')
                  }}
                >
                  导出为 JSON
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => {
                    const summaryResult = (
                      typeof result.selectedResult === 'string'
                        ? JSON.parse(result.selectedResult)
                        : result.selectedResult
                    ) as any
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
                    toast.success('Markdown文件已导出')
                  }}
                >
                  导出为 Markdown
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => {
                    const summaryResult = (
                      typeof result.selectedResult === 'string'
                        ? JSON.parse(result.selectedResult)
                        : result.selectedResult
                    ) as any
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
                    toast.success('TXT文件已导出')
                  }}
                >
                  导出为 TXT
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}
    </Box>
  )
}
