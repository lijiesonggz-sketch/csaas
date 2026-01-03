'use client'

/**
 * 成熟度矩阵生成页面
 * 基于聚类结果生成5级成熟度矩阵
 */

import { useState, useEffect } from 'react'
import { Card, Button, message, Steps } from 'antd'
import {
  TableOutlined,
  ThunderboltOutlined,
  CheckOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import TaskProgressBar from '@/components/features/TaskProgressBar'
import MatrixResultDisplay from '@/components/features/MatrixResultDisplay'
import { AIGenerationAPI } from '@/lib/api/ai-generation'
import type { GenerationResult } from '@/lib/types/ai-generation'
import { v4 as uuidv4 } from 'uuid'

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
      message.error('请输入聚类任务ID')
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
        message.success('矩阵生成任务已启动，请等待完成...')
      }
    } catch (error: any) {
      message.error(error.message || '启动矩阵生成失败')
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
        message.success('成熟度矩阵生成完成！')
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
    setClusteringTaskId('')
    setIsGenerating(false)
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">成熟度矩阵生成</h1>
        <p className="text-gray-600">
          基于聚类结果生成CMMI 5级成熟度矩阵，为每个聚类定义从初始级到优化级的5个成熟度级别
        </p>
      </div>

      {/* 步骤指示器 */}
      <Card className="mb-6">
        <Steps
          current={currentStep}
          items={[
            {
              title: '输入聚类结果',
              icon: <UploadOutlined />,
              description: '提供聚类任务ID',
            },
            {
              title: '生成矩阵',
              icon: <ThunderboltOutlined />,
              description: '三模型并行生成',
            },
            {
              title: '查看结果',
              icon: <CheckOutlined />,
              description: 'N行 × 5列成熟度矩阵',
            },
          ]}
        />
      </Card>

      {/* 步骤 1: 输入聚类任务ID */}
      {currentStep === 0 && (
        <Card title="步骤 1: 输入聚类结果" className="mb-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              聚类任务ID
            </label>
            <input
              type="text"
              value={clusteringTaskId}
              onChange={(e) => setClusteringTaskId(e.target.value)}
              placeholder="输入聚类生成的任务ID（例如：xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx）"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isGenerating}
            />
            <p className="text-sm text-gray-500 mt-2">
              请先在&ldquo;聚类分析&rdquo;页面完成聚类任务，然后将任务ID复制到此处
            </p>
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              type="primary"
              size="large"
              onClick={handleStartGeneration}
              disabled={!clusteringTaskId.trim() || isGenerating}
              icon={<TableOutlined />}
            >
              生成成熟度矩阵
            </Button>
          </div>
        </Card>
      )}

      {/* 步骤 2: 生成中 */}
      {currentStep === 1 && (
        <Card title="步骤 2: 正在生成成熟度矩阵" className="mb-6">
          <TaskProgressBar
            taskId={taskId}
            onCompleted={handleGenerationCompleted}
            onFailed={handleGenerationFailed}
          />

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500 mb-4">
              系统正在使用GPT-4、Claude和通义千问三个模型并行生成成熟度矩阵，这可能需要2-4分钟...
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
            title="步骤 3: 查看成熟度矩阵"
            extra={
              <Button type="default" onClick={handleRestart}>
                重新生成
              </Button>
            }
          >
            <MatrixResultDisplay result={result} />
          </Card>
        </div>
      )}
    </div>
  )
}
