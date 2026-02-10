'use client'

/**
 * 调研问卷生成页面
 * 基于成熟度矩阵生成50-100题调研问卷
 */

import { useState, useEffect } from 'react'
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
import TextField from '@mui/material/TextField'
import AssignmentIcon from '@mui/icons-material/Assignment'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import FlashOnIcon from '@mui/icons-material/FlashOn'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import TaskProgressBar from '@/components/features/TaskProgressBar'
import QuestionnaireResultDisplay from '@/components/features/QuestionnaireResultDisplay'
import { AIGenerationAPI } from '@/lib/api/ai-generation'
import type { GenerationResult } from '@/lib/types/ai-generation'
import { v4 as uuidv4 } from 'uuid'

const steps = [
  {
    label: '输入矩阵结果',
    description: '提供矩阵任务ID',
    icon: CloudUploadIcon,
  },
  {
    label: '生成问卷',
    description: '三模型并行生成',
    icon: FlashOnIcon,
  },
  {
    label: '查看结果',
    description: '50-100题调研问卷',
    icon: CheckCircleIcon,
  },
]

export default function QuestionnaireGenerationPage() {
  const [currentStep, setCurrentStep] = useState(0)
  const [matrixTaskId, setMatrixTaskId] = useState('')
  const [taskId, setTaskId] = useState<string | null>(null)
  const [result, setResult] = useState<GenerationResult | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

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
      // 验证矩阵任务ID是否有效（检查是否存在）
      const matrixCheck = await AIGenerationAPI.getFinalResult(matrixTaskId)

      if (!matrixCheck || !matrixCheck.data) {
        throw new Error('无法获取矩阵结果，请检查任务ID是否正确')
      }

      // 启动问卷生成（只传递矩阵任务ID，由后端从数据库获取，避免HTTP请求体过大）
      const response = await AIGenerationAPI.generateQuestionnaire({
        taskId: newTaskId,
        matrixTaskId: matrixTaskId, // 只传ID，不传完整数据
        temperature: 0.7,
        maxTokens: 8000,
      })

      if (response.success) {
        toast.success('问卷生成任务已启动，请等待完成...')
      }
    } catch (error: any) {
      toast.error(error.message || '启动问卷生成失败')
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
        toast.success('调研问卷生成完成！')
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
    setMatrixTaskId('')
    setIsGenerating(false)
  }

  return (
    <Box sx={{ maxWidth: 'lg', mx: 'auto', px: 2, py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom fontWeight="bold" color="text.primary">
          调研问卷生成
        </Typography>
        <Typography variant="body1" color="text.secondary">
          基于成熟度矩阵生成50-100题调研问卷，包含单选题、多选题和评分题，全面评估组织成熟度
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

      {/* 步骤 1: 输入矩阵任务ID */}
      {currentStep === 0 && (
        <Card>
          <CardHeader title="步骤 1: 输入成熟度矩阵" />
          <CardContent>
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                矩阵任务ID
              </Typography>
              <TextField
                fullWidth
                value={matrixTaskId}
                onChange={(e) => setMatrixTaskId(e.target.value)}
                placeholder="输入矩阵生成的任务ID（例如：xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx）"
                disabled={isGenerating}
              />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                请先在"成熟度矩阵"页面完成矩阵生成，然后将任务ID复制到此处
              </Typography>
            </Box>

            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                size="large"
                onClick={handleStartGeneration}
                disabled={!matrixTaskId.trim() || isGenerating}
                startIcon={<AssignmentIcon />}
              >
                生成调研问卷
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* 步骤 2: 生成中 */}
      {currentStep === 1 && (
        <Card>
          <CardHeader title="步骤 2: 正在生成调研问卷" />
          <CardContent>
            <TaskProgressBar
              taskId={taskId}
              onCompleted={handleGenerationCompleted}
              onFailed={handleGenerationFailed}
            />

            <Box sx={{ mt: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                系统正在使用GPT-4、Claude和通义千问三个模型并行生成调研问卷，这可能需要3-5分钟...
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
              title="步骤 3: 查看调研问卷"
              action={
                <Button variant="outlined" onClick={handleRestart}>
                  重新生成
                </Button>
              }
            />
            <CardContent>
              <QuestionnaireResultDisplay result={result} />
            </CardContent>
          </Card>
        </Box>
      )}
    </Box>
  )
}
