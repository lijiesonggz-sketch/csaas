'use client'

/**
 * 聚类生成页面
 * 支持多文档上传、跨标准聚类分析和可视化展示
 */

import { useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileText, Zap, CheckCircle, Upload, Trash2, Loader2 } from 'lucide-react'
import { parseFile, SUPPORTED_FILE_EXTENSIONS } from '@/lib/utils/fileParser'

interface StandardDocument {
  id: string
  name: string
  content: string
}

export default function ClusteringGenerationPage() {
  const [currentStep, setCurrentStep] = useState(0)
  const [documents, setDocuments] = useState<StandardDocument[]>([])
  const [taskId, setTaskId] = useState<string | null>(null)
  const [result, setResult] = useState<any>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  const steps = [
    {
      label: '上传文档',
      description: '上传多个标准文档',
      icon: FileText,
    },
    {
      label: '生成聚类',
      description: '三模型并行分析',
      icon: Zap,
    },
    {
      label: '查看结果',
      description: '聚类结果和覆盖率',
      icon: CheckCircle,
    },
  ]

  // 处理文件上传
  const handleFileUpload = async (file: File) => {
    try {
      const content = await parseFile(file)

      if (content.length < 100) {
        toast.error(`文件 ${file.name} 内容太短，至少需要100字符`)
        return false
      }

      const newDoc: StandardDocument = {
        id: `doc_${Date.now()}_${Math.random()}`,
        name: file.name.replace(/\.(txt|md|pdf|docx|doc)$/i, ''),
        content,
      }

      setDocuments((prev) => [...prev, newDoc])
      toast.success(`文件 ${file.name} 已加载`)
      return false
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

    const newTaskId = `task_${Date.now()}`
    setTaskId(newTaskId)
    setIsGenerating(true)
    setCurrentStep(1)

    try {
      // 这里应该调用实际的 API
      // const response = await AIGenerationAPI.generateClustering({...})

      // 模拟成功
      toast.success('聚类任务已启动，请等待完成...')
    } catch (error: any) {
      toast.error(error.message || '启动聚类任务失败')
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
    <div className="max-w-5xl mx-auto p-6 bg-[#FEFDFB] min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#1E3A5F] font-[var(--font-plus-jakarta)]">
          AI 智能聚类分析
        </h1>
        <p className="text-[#94A3B8] mt-2">
          上传多个IT标准文档（如ISO 27001、等保2.0等），系统将自动识别相似要求并进行跨标准聚类合并
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
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="border-2 border-dashed border-[#E2E8F0] rounded-sm p-8 text-center bg-[#F8FAFC] hover:border-[#1E3A5F] hover:bg-[#FEFDFB] transition-colors"
              >
                <input
                  type="file"
                  accept={SUPPORTED_FILE_EXTENSIONS}
                  onChange={handleFileInputChange}
                  disabled={isGenerating}
                  className="hidden"
                  id="clustering-file-upload"
                  multiple
                />
                <label htmlFor="clustering-file-upload">
                  <Button
                    variant="outline"
                    className="rounded-sm cursor-pointer"
                    asChild
                    disabled={isGenerating}
                  >
                    <span>
                      <Upload className="w-4 h-4 mr-2" />
                      选择文件
                    </span>
                  </Button>
                </label>
              </div>
              <p className="text-sm text-[#94A3B8] mt-2 text-center">
                支持 .txt、.md、.pdf、.docx、.doc 文件，每个文件至少100字符。建议上传2-5个标准文档。
              </p>
            </div>

            {/* 已上传文档列表 */}
            {documents.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-[#1E3A5F] mb-3">
                  已上传文档 ({documents.length})
                </h3>
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <Card key={doc.id} className="border border-[#E2E8F0] bg-[#F8FAFC] rounded-sm">
                      <CardContent className="py-3 px-4 flex justify-between items-center">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-[#1E3A5F]">{doc.name}</p>
                          <p className="text-xs text-[#94A3B8]">
                            文档ID: {doc.id} | 长度: {doc.content.length} 字符
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveDocument(doc.id)}
                          disabled={isGenerating}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 rounded-sm"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between items-center">
              <p className="text-sm text-[#94A3B8]">
                {documents.length > 0 && (
                  <span>
                    已上传 <strong>{documents.length}</strong> 个文档
                  </span>
                )}
              </p>
              <Button
                className="bg-[#1E3A5F] hover:bg-[#162e4d] text-white rounded-sm"
                onClick={handleStartGeneration}
                disabled={documents.length < 2 || isGenerating}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    处理中...
                  </>
                ) : (
                  '开始聚类分析'
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
              步骤 2: 正在生成聚类
            </h2>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="w-12 h-12 animate-spin text-[#1E3A5F]" />
              <p className="text-[#94A3B8]">
                系统正在使用DeepSeek、Claude和通义千问三个模型并行分析
                {documents.length}个文档，这可能需要3-5分钟...
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
                步骤 3: 查看聚类结果
              </h2>
              <Button variant="outline" onClick={handleRestart} className="rounded-sm">
                重新分析
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-[#94A3B8]">聚类结果将显示在这里</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
