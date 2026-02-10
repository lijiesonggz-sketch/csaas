'use client'

/**
 * 成熟度矩阵生成页面
 * 基于聚类结果生成5级成熟度矩阵
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
import TableChartIcon from '@mui/icons-material/TableChart'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import FlashOnIcon from '@mui/icons-material/FlashOn'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import TaskProgressBar from '@/components/features/TaskProgressBar'
import MatrixResultDisplay from '@/components/features/MatrixResultDisplay'
import { AIGenerationAPI } from '@/lib/api/ai-generation'
import type { GenerationResult } from '@/lib/types/ai-generation'
import { v4 as uuidv4 } from 'uuid'

const steps = [
  {
    label: '输入聚类结果',
    description: '提供聚类任务ID',
    icon: CloudUploadIcon,
  },
  {
    label: '生成矩阵',
    description: '三模型并行生成',
    icon: FlashOnIcon,
  },
  {
    label: '查看结果',
    description: 'N行 × 5列成熟度矩阵',
    icon: CheckCircleIcon,
  },
]

export default function MatrixGenerationPage() {
  const [currentStep, setCurrentStep] = useState(0)
  const [clusteringTaskId, setClusteringTaskId] = useState('')
  const [taskId, setTaskId] = useState<string | null>(null)
  const [result, setResult] = useState<GenerationResult | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  // 从URL参数获取taskId
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const urlTaskId = urlParams.get('taskId')
      if (urlTaskId) {
        setClusteringTaskId(urlTaskId)
      }
    }
  }, [])

  // 开始生成矩阵
  const handleStartGeneration = async () => {
    if (!clusteringTaskId.trim()) {
      toast.error('请输入聚类任务ID')
      return
    }

    const newTaskId = uuidv4()
    setTaskId(newTaskId)
    setIsGenerating(true)
    setCurrentStep(1)

    try {
      // 获取聚类结果
      const clusteringResult = await AIGenerationAPI.getFinalResult(clusteringTaskId)

      if (!clusteringResult || !clusteringResult.data) {
        throw new Error('无法获取聚类结果，请检查任务ID是否正确')
      }

      // 启动矩阵生成
      const response = await AIGenerationAPI.generateMatrix({
        taskId: newTaskId,
        clusteringResult: clusteringResult.data,
        temperature: 0.7,
        maxTokens: 8000,
      })

      if (response.success) {
        toast.success('矩阵生成任务已启动，请等待完成...')
      }
    } catch (error: any) {
      toast.error(error.message || '启动矩阵生成失败')
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
        toast.success('成熟度矩阵生成完成！')
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
    setClusteringTaskId('')
    setIsGenerating(false)
  }

  return (
    <Box sx={{ maxWidth: 'lg', mx: 'auto', px: 2, py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom fontWeight="bold" color="text.primary">
          成熟度矩阵生成
        </Typography>
        <Typography variant="body1" color="text.secondary">
          基于聚类结果生成CMMI 5级成熟度矩阵，为每个聚类定义从初始级到优化级的5个成熟度级别
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

      {/* 步骤 1: 输入聚类任务ID */}
      {currentStep === 0 && (
        <Card>
          <CardHeader title="步骤 1: 输入聚类结果" />
          <CardContent>
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                聚类任务ID
              </Typography>
              <TextField
                fullWidth
                value={clusteringTaskId}
                onChange={(e) => setClusteringTaskId(e.target.value)}
                placeholder="输入聚类生成的任务ID（例如：xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx）"
                disabled={isGenerating}
              />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                请先在"聚类分析"页面完成聚类任务，然后将任务ID复制到此处
              </Typography>
            </Box>

            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                size="large"
                onClick={handleStartGeneration}
                disabled={!clusteringTaskId.trim() || isGenerating}
                startIcon={<TableChartIcon />}
              >
                生成成熟度矩阵
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* 步骤 2: 生成中 */}
      {currentStep === 1 && (
        <Card>
          <CardHeader title="步骤 2: 正在生成成熟度矩阵" />
          <CardContent>
            <TaskProgressBar
              taskId={taskId}
              onCompleted={handleGenerationCompleted}
              onFailed={handleGenerationFailed}
            />

            <Box sx={{ mt: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                系统正在使用GPT-4、Claude和通义千问三个模型并行生成成熟度矩阵，这可能需要2-4分钟...
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
              title="步骤 3: 查看成熟度矩阵"
              action={
                <Button variant="outlined" onClick={handleRestart}>
                  重新生成
                </Button>
              }
            />
            <CardContent>
              <MatrixResultDisplay result={result} />
            </CardContent>
          </Card>
        </Box>
      )}
    </Box>
  )
}
