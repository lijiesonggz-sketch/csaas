'use client'

/**
 * 调研问卷生成页面
 * 基于成熟度矩阵生成50-100题调研问卷
 */

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FileText, Upload, Zap, CheckCircle, Loader2 } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'

export default function QuestionnaireGenerationPage() {
  const [currentStep, setCurrentStep] = useState(0)
  const [matrixTaskId, setMatrixTaskId] = useState('')
  const [taskId, setTaskId] = useState<string | null>(null)
  const [result, setResult] = useState<any>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  const steps = [
    {
      label: '输入矩阵结果',
      description: '提供矩阵任务ID',
      icon: Upload,
    },
    {
      label: '生成问卷',
      description: '三模型并行生成',
      icon: Zap,
    },
    {
      label: '查看结果',
      description: '50-100题调研问卷',
      icon: CheckCircle,
    },
  ]

  // 从URL参数获取taskId
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const urlTaskId = urlParams.get('taskId')
      if (urlTaskId) {
        setMatrixTaskId(urlTaskId)
      }
    }
  }, [])

  // 开始生成问卷
  const handleStartGeneration = async () => {
    if (!matrixTaskId.trim()) {
      toast.error('请输入矩阵任务ID')
      return
    }

    const newTaskId = uuidv4()
    setTaskId(newTaskId)
    setIsGenerating(true)
    setCurrentStep(1)

    try {
      // 这里应该调用实际的 API
      // const matrixCheck = await AIGenerationAPI.getFinalResult(matrixTaskId)
      // const response = await AIGenerationAPI.generateQuestionnaire({...})

      // 模拟成功
      toast.success('问卷生成任务已启动，请等待完成...')
    } catch (error: any) {
      toast.error(error.message || '启动问卷生成失败')
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
    setMatrixTaskId('')
    setIsGenerating(false)
  }

  return (
    <div className="max-w-5xl mx-auto p-6 bg-[#FEFDFB] min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#1E3A5F] font-[var(--font-plus-jakarta)]">
          调研问卷生成
        </h1>
        <p className="text-[#94A3B8] mt-2">
          基于成熟度矩阵生成50-100题调研问卷，包含单选题、多选题和评分题，全面评估组织成熟度
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
                      currentStep >= index ? 'bg-[#1E3A5F] text-white' : 'bg-[#94A3B8] text-white'
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

      {/* 步骤 1: 输入矩阵任务ID */}
      {currentStep === 0 && (
        <Card className="border-[#E2E8F0] rounded-sm shadow-sm">
          <CardHeader>
            <h2 className="text-xl font-semibold text-[#1E3A5F] font-[var(--font-plus-jakarta)]">
              步骤 1: 输入成熟度矩阵
            </h2>
          </CardHeader>
          <CardContent>
            <div className="mb-6">
              <Label htmlFor="matrix-task-id" className="text-[#1E3A5F]">
                矩阵任务ID
              </Label>
              <Input
                id="matrix-task-id"
                value={matrixTaskId}
                onChange={(e) => setMatrixTaskId(e.target.value)}
                placeholder="输入矩阵生成的任务ID（例如：xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx）"
                disabled={isGenerating}
                className="mt-2 rounded-sm"
              />
              <p className="text-sm text-[#94A3B8] mt-2">
                请先在“成熟度矩阵”页面完成矩阵生成，然后将任务ID复制到此处
              </p>
            </div>

            <div className="flex justify-end">
              <Button
                className="bg-[#1E3A5F] hover:bg-[#162e4d] text-white rounded-sm"
                onClick={handleStartGeneration}
                disabled={!matrixTaskId.trim() || isGenerating}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    处理中...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 mr-2" />
                    生成调研问卷
                  </>
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
              步骤 2: 正在生成调研问卷
            </h2>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="w-12 h-12 animate-spin text-[#1E3A5F]" />
              <p className="text-[#94A3B8]">
                系统正在使用DeepSeek、Claude和通义千问三个模型并行生成调研问卷，这可能需要3-5分钟...
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
                步骤 3: 查看调研问卷
              </h2>
              <Button variant="outline" onClick={handleRestart} className="rounded-sm">
                重新生成
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-[#94A3B8]">问卷结果将显示在这里</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
