'use client'

/**
 * 聚类生成页面
 * 支持多文档上传、跨标准聚类分析和可视化展示
 */

import { useState } from 'react'
import { Card, Button, message, Steps, Upload } from 'antd'
import {
  FileTextOutlined,
  ThunderboltOutlined,
  CheckOutlined,
  UploadOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import type { UploadFile } from 'antd/es/upload/interface'
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

export default function ClusteringGenerationPage() {
  const [currentStep, setCurrentStep] = useState(0)
  const [documents, setDocuments] = useState<StandardDocument[]>([])
  const [taskId, setTaskId] = useState<string | null>(null)
  const [result, setResult] = useState<GenerationResult | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [fileList, setFileList] = useState<UploadFile[]>([])

  // 处理文件上传
  const handleFileUpload = async (file: File) => {
    try {
      // 使用通用文件解析器（支持TXT, MD, PDF, DOCX, DOC）
      const content = await parseFile(file)

      if (content.length < 100) {
        message.error(`文件 ${file.name} 内容太短，至少需要100字符`)
        return false
      }

      const newDoc: StandardDocument = {
        id: `doc_${uuidv4()}`,
        name: file.name.replace(/\.(txt|md|pdf|docx|doc)$/i, ''),
        content,
      }

      setDocuments((prev) => [...prev, newDoc])
      message.success(`文件 ${file.name} 已加载`)
      return false // 阻止自动上传
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '未知错误'
      message.error(`读取文件 ${file.name} 失败: ${errorMsg}`)
      return false
    }
  }

  // 删除文档
  const handleRemoveDocument = (docId: string) => {
    setDocuments((prev) => prev.filter((doc) => doc.id !== docId))
    setFileList((prev) => prev.filter((file) => file.uid !== docId))
  }

  // 开始生成聚类
  const handleStartGeneration = async () => {
    if (documents.length < 2) {
      message.error('请至少上传2个标准文档')
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
        message.success('聚类任务已启动，请等待完成...')
      }
    } catch (error: any) {
      message.error(error.message || '启动聚类任务失败')
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
        message.success('聚类生成完成！')
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
    setDocuments([])
    setFileList([])
    setIsGenerating(false)
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">AI 智能聚类分析</h1>
        <p className="text-gray-600">
          上传多个IT标准文档（如ISO 27001、等保2.0等），系统将自动识别相似要求并进行跨标准聚类合并
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
              description: '上传多个标准文档',
            },
            {
              title: '生成聚类',
              icon: <ThunderboltOutlined />,
              description: '三模型并行分析',
            },
            {
              title: '查看结果',
              icon: <CheckOutlined />,
              description: '聚类结果和覆盖率',
            },
          ]}
        />
      </Card>

      {/* 步骤 1: 文档上传 */}
      {currentStep === 0 && (
        <Card title="步骤 1: 上传标准文档" className="mb-6">
          <div className="mb-4">
            <Upload
              beforeUpload={handleFileUpload}
              fileList={fileList}
              onRemove={(file) => handleRemoveDocument(file.uid)}
              accept={SUPPORTED_FILE_EXTENSIONS}
              multiple
            >
              <Button icon={<UploadOutlined />} disabled={isGenerating}>
                选择文件
              </Button>
            </Upload>
            <p className="text-sm text-gray-500 mt-2">
              支持 .txt、.md、.pdf、.docx、.doc 文件，每个文件至少100字符。建议上传2-5个标准文档。
            </p>
          </div>

          {/* 已上传文档列表 */}
          {documents.length > 0 && (
            <div className="space-y-2 mb-4">
              <h3 className="font-semibold text-gray-700">已上传文档 ({documents.length})</h3>
              {documents.map((doc) => (
                <Card key={doc.id} size="small" className="bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-800">{doc.name}</h4>
                      <p className="text-sm text-gray-500">
                        文档ID: {doc.id} | 长度: {doc.content.length} 字符
                      </p>
                    </div>
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => handleRemoveDocument(doc.id)}
                      disabled={isGenerating}
                    >
                      删除
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}

          <div className="mt-6 flex justify-between items-center">
            <div className="text-sm text-gray-500">
              {documents.length > 0 && (
                <span>
                  已上传 <strong>{documents.length}</strong> 个文档
                </span>
              )}
            </div>
            <Button
              type="primary"
              size="large"
              onClick={handleStartGeneration}
              disabled={documents.length < 2 || isGenerating}
            >
              开始聚类分析
            </Button>
          </div>
        </Card>
      )}

      {/* 步骤 2: 生成中 */}
      {currentStep === 1 && (
        <Card title="步骤 2: 正在生成聚类" className="mb-6">
          <TaskProgressBar
            taskId={taskId}
            onCompleted={handleGenerationCompleted}
            onFailed={handleGenerationFailed}
          />

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500 mb-4">
              系统正在使用GPT-4、Claude和通义千问三个模型并行分析
              {documents.length}个文档，这可能需要3-5分钟...
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
            title="步骤 3: 查看聚类结果"
            extra={
              <Button type="default" onClick={handleRestart}>
                重新分析
              </Button>
            }
          >
            <ClusteringResultDisplay result={result} documents={documents} />
          </Card>
        </div>
      )}
    </div>
  )
}
