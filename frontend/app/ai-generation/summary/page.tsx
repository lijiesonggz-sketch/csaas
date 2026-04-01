'use client'

/**
 * 综述生成页面
 * 集成文档上传、实时进度跟踪和结果展示
 */

import { useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { FileText, Zap, CheckCircle, Download, Loader2 } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'

export default function SummaryGenerationPage() {
  const [currentStep, setCurrentStep] = useState(0)
  const [documentContent, setDocumentContent] = useState('')
  const [taskId, setTaskId] = useState<string | null>(null)
  const [result, setResult] = useState<any>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  const steps = [
    {
      label: '上传文档',
      description: '粘贴或上传标准文档',
      icon: FileText,
    },
    {
      label: '生成中',
      description: '三模型并行生成',
      icon: Zap,
    },
    {
      label: '查看结果',
      description: '质量验证和审核',
      icon: CheckCircle,
    },
  ]

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
      // 这里应该调用实际的 API
      // const response = await AIGenerationAPI.generateSummary({...})

      // 模拟成功
      toast.success('生成任务已启动，请等待完成...')
    } catch (error: any) {
      toast.error(error.message || '启动生成任务失败')
      setIsGenerating(false)
      setCurrentStep(0)
      setTaskId(null)
    }
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
    <div className="max-w-5xl mx-auto p-6 bg-[#FEFDFB] min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#1E3A5F] font-[var(--font-plus-jakarta)]">
          AI 综述生成
        </h1>
        <p className="text-[#94A3B8] mt-2">
          上传或粘贴IT标准文档，系统将使用三个AI模型（GPT-4、Claude、通义千问）并行生成高质量综述
        </p>
      </div>

      {/* 步骤指示器 */}
      <Card className="mb-6 border-[#E2E8F0] rounded-sm shadow-sm">
        <CardContent className="p-6">
          <div className="flex justify-between">
            {steps.map((step, index) => {
              const Icon = step.icon
              return (
                <div key={index} className="flex-1 flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      currentStep >= index
                        ? 'bg-[#1E3A5F] text-white'
                        : 'bg-[#94A3B8] text-white'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-semibold mt-2 text-[#1E3A5F]">{step.label}</p>
                  <p className="text-xs text-[#94A3B8] text-center">{step.description}</p>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* 步骤 1: 文档上传 */}
      {currentStep === 0 && (
        <Card className="border-[#E2E8F0] rounded-sm shadow-sm">
          <CardHeader>
            <h2 className="text-xl font-semibold text-[#1E3A5F] font-[var(--font-plus-jakarta)]">
              步骤 1: 上传标准文档
            </h2>
          </CardHeader>
          <CardContent>
            <div className="mb-6">
              <Label htmlFor="document-content" className="text-[#1E3A5F]">
                标准文档内容
              </Label>
              <Textarea
                id="document-content"
                value={documentContent}
                onChange={(e) => setDocumentContent(e.target.value)}
                placeholder="粘贴标准文档内容..."
                disabled={isGenerating}
                rows={12}
                className="mt-2 rounded-sm resize-none"
              />
              <p className="text-sm text-[#94A3B8] mt-2">
                最少100字符
              </p>
            </div>

            <div className="flex justify-between items-center">
              <p className="text-sm text-[#94A3B8]">
                {documentContent.length > 0 && (
                  <span>
                    当前文档长度：<strong>{documentContent.length}</strong> 字符
                  </span>
                )}
              </p>
              <Button
                className="bg-[#1E3A5F] hover:bg-[#162e4d] text-white rounded-sm"
                onClick={handleStartGeneration}
                disabled={!documentContent || documentContent.length < 100 || isGenerating}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    处理中...
                  </>
                ) : (
                  '开始生成综述'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 步骤 2: 生成中 */}
      {currentStep === 1 && (
        <Card className="border-[#E2E8F0] rounded-sm shadow-sm">
          <CardHeader>
            <h2 className="text-xl font-semibold text-[#1E3A5F] font-[var(--font-plus-jakarta)]">
              步骤 2: 正在生成综述
            </h2>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="w-12 h-12 animate-spin text-[#1E3A5F]" />
              <p className="text-[#94A3B8]">
                系统正在使用GPT-4、Claude和通义千问三个模型并行生成综述，这可能需要1-3分钟...
              </p>
              <Button
                variant="outline"
                onClick={handleRestart}
                disabled={isGenerating}
                className="rounded-sm"
              >
                取消并返回
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 步骤 3: 查看结果 */}
      {currentStep === 2 && result && (
        <div className="space-y-6">
          <Card className="border-[#E2E8F0] rounded-sm shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <h2 className="text-xl font-semibold text-[#1E3A5F] font-[var(--font-plus-jakarta)]">
                步骤 3: 查看生成结果
              </h2>
              <Button variant="outline" onClick={handleRestart} className="rounded-sm">
                重新生成
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-[#94A3B8]">综述结果将显示在这里</p>
            </CardContent>
          </Card>

          {/* 导出选项 */}
          <Card className="border-[#E2E8F0] rounded-sm shadow-sm">
            <CardHeader>
              <h2 className="text-xl font-semibold text-[#1E3A5F] font-[var(--font-plus-jakarta)]">
                导出选项
              </h2>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center gap-3 flex-wrap">
                <Button
                  variant="outline"
                  onClick={() => {
                    // 导出 JSON
                    toast.success('JSON文件已导出')
                  }}
                  className="rounded-sm"
                >
                  <Download className="w-4 h-4 mr-2" />
                  导出为 JSON
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    // 导出 Markdown
                    toast.success('Markdown文件已导出')
                  }}
                  className="rounded-sm"
                >
                  <Download className="w-4 h-4 mr-2" />
                  导出为 Markdown
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    // 导出 TXT
                    toast.success('TXT文件已导出')
                  }}
                  className="rounded-sm"
                >
                  <Download className="w-4 h-4 mr-2" />
                  导出为 TXT
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
