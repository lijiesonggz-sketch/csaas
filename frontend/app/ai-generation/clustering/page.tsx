'use client'

/**
 * 聚类生成页面
 * 支持多文档上传、跨标准聚类分析和可视化展示
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
import IconButton from '@mui/material/IconButton'
import DescriptionIcon from '@mui/icons-material/Description'
import FlashOnIcon from '@mui/icons-material/FlashOn'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import DeleteIcon from '@mui/icons-material/Delete'
import TaskProgressBar from '@/components/features/TaskProgressBar'
import ClusteringResultDisplay from '@/components/features/ClusteringResultDisplay'
import { AIGenerationAPI } from '@/lib/api/ai-generation'
import type { GenerationResult } from '@/lib/types/ai-generation'
import { v4 as uuidv4 } from 'uuid'
import { parseFile, SUPPORTED_FILE_EXTENSIONS } from '@/lib/utils/fileParser'

interface StandardDocument {
  id: string
  name: string
  content: string
}

const steps = [
  {
    label: '上传文档',
    description: '上传多个标准文档',
    icon: DescriptionIcon,
  },
  {
    label: '生成聚类',
    description: '三模型并行分析',
    icon: FlashOnIcon,
  },
  {
    label: '查看结果',
    description: '聚类结果和覆盖率',
    icon: CheckCircleIcon,
  },
]

export default function ClusteringGenerationPage() {
  const [currentStep, setCurrentStep] = useState(0)
  const [documents, setDocuments] = useState<StandardDocument[]>([])
  const [taskId, setTaskId] = useState<string | null>(null)
  const [result, setResult] = useState<GenerationResult | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  // 处理文件上传
  const handleFileUpload = async (file: File) => {
    try {
      // 使用通用文件解析器（支持TXT, MD, PDF, DOCX, DOC）
      const content = await parseFile(file)

      if (content.length < 100) {
        toast.error(`文件 ${file.name} 内容太短，至少需要100字符`)
        return false
      }

      const newDoc: StandardDocument = {
        id: `doc_${uuidv4()}`,
        name: file.name.replace(/\.(txt|md|pdf|docx|doc)$/i, ''),
        content,
      }

      setDocuments((prev) => [...prev, newDoc])
      toast.success(`文件 ${file.name} 已加载`)
      return false // 阻止自动上传
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '未知错误'
      toast.error(`读取文件 ${file.name} 失败: ${errorMsg}`)
      return false
    }
  }

  // 删除文档
  const handleRemoveDocument = (docId: string) => {
    setDocuments((prev) => prev.filter((doc) => doc.id !== docId))
  }

  // 开始生成聚类
  const handleStartGeneration = async () => {
    if (documents.length < 2) {
      toast.error('请至少上传2个标准文档')
      return
    }

    const newTaskId = uuidv4()
    setTaskId(newTaskId)
    setIsGenerating(true)
    setCurrentStep(1)

    try {
      const response = await AIGenerationAPI.generateClustering({
        taskId: newTaskId,
        documents,
        temperature: 0.7,
        maxTokens: 60000, // GLM-4.7支持长文本输出
      })

      if (response.success) {
        toast.success('聚类任务已启动，请等待完成...')
      }
    } catch (error: any) {
      toast.error(error.message || '启动聚类任务失败')
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
        toast.success('聚类生成完成！')
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
    setDocuments([])
    setIsGenerating(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    if (isGenerating) return

    const files = Array.from(e.dataTransfer.files)
    for (const file of files) {
      await handleFileUpload(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) {
      for (const file of Array.from(files)) {
        await handleFileUpload(file)
      }
    }
  }

  return (
    <Box sx={{ maxWidth: 'lg', mx: 'auto', px: 2, py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom fontWeight="bold" color="text.primary">
          AI 智能聚类分析
        </Typography>
        <Typography variant="body1" color="text.secondary">
          上传多个IT标准文档（如ISO 27001、等保2.0等），系统将自动识别相似要求并进行跨标准聚类合并
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
            <Box sx={{ mb: 3 }}>
              <Box
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                sx={{
                  border: '2px dashed',
                  borderColor: 'grey.300',
                  borderRadius: 2,
                  p: 3,
                  textAlign: 'center',
                  bgcolor: 'grey.50',
                  '&:hover': {
                    borderColor: 'primary.main',
                    bgcolor: 'primary.50',
                  },
                }}
              >
                <input
                  type="file"
                  accept={SUPPORTED_FILE_EXTENSIONS}
                  onChange={handleFileInputChange}
                  disabled={isGenerating}
                  style={{ display: 'none' }}
                  id="clustering-file-upload"
                  multiple
                />
                <label htmlFor="clustering-file-upload">
                  <Button
                    variant="outlined"
                    component="span"
                    startIcon={<CloudUploadIcon />}
                    disabled={isGenerating}
                  >
                    选择文件
                  </Button>
                </label>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                支持 .txt、.md、.pdf、.docx、.doc 文件，每个文件至少100字符。建议上传2-5个标准文档。
              </Typography>
            </Box>

            {/* 已上传文档列表 */}
            {documents.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  已上传文档 ({documents.length})
                </Typography>
                {documents.map((doc) => (
                  <Card key={doc.id} variant="outlined" sx={{ mb: 1, bgcolor: 'grey.50' }}>
                    <CardContent sx={{ py: 1, px: 2, '&:last-child': { pb: 1 } }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="subtitle2">{doc.name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            文档ID: {doc.id} | 长度: {doc.content.length} 字符
                          </Typography>
                        </Box>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleRemoveDocument(doc.id)}
                          disabled={isGenerating}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            )}

            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                {documents.length > 0 && (
                  <span>
                    已上传 <strong>{documents.length}</strong> 个文档
                  </span>
                )}
              </Typography>
              <Button
                variant="contained"
                size="large"
                onClick={handleStartGeneration}
                disabled={documents.length < 2 || isGenerating}
              >
                开始聚类分析
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* 步骤 2: 生成中 */}
      {currentStep === 1 && (
        <Card>
          <CardHeader title="步骤 2: 正在生成聚类" />
          <CardContent>
            <TaskProgressBar
              taskId={taskId}
              onCompleted={handleGenerationCompleted}
              onFailed={handleGenerationFailed}
            />

            <Box sx={{ mt: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                系统正在使用GPT-4、Claude和通义千问三个模型并行分析
                {documents.length}个文档，这可能需要3-5分钟...
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
              title="步骤 3: 查看聚类结果"
              action={
                <Button variant="outlined" onClick={handleRestart}>
                  重新分析
                </Button>
              }
            />
            <CardContent>
              <ClusteringResultDisplay result={result} documents={documents} />
            </CardContent>
          </Card>
        </Box>
      )}
    </Box>
  )
}
