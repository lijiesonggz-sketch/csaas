/**
 * WebSocket任务进度Hook
 */

import { useEffect, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'

export interface TaskProgressEvent {
  taskId: string
  progress: number // 0-100
  message: string
  currentStep?: string
  estimatedTimeMs?: number
}

export interface TaskCompletedEvent {
  taskId: string
  status: 'completed' | 'failed'
  message: string
  result?: any
}

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

export function useTaskProgress(taskId: string | null) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState('')
  const [currentStep, setCurrentStep] = useState<string>()
  const [isCompleted, setIsCompleted] = useState(false)
  const [isFailed, setIsFailed] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (!taskId) return

    // 创建Socket连接（连接到 /tasks namespace）
    const newSocket = io(SOCKET_URL + '/tasks', {
      transports: ['websocket', 'polling'],
    })

    newSocket.on('connect', () => {
      console.log('WebSocket connected to /tasks namespace')
      // 订阅任务进度
      newSocket.emit('subscribe:task', { taskId })
    })

    newSocket.on('disconnect', () => {
      console.log('WebSocket disconnected')
    })

    // 监听进度更新
    newSocket.on('task:progress', (data: TaskProgressEvent) => {
      if (data.taskId === taskId) {
        setProgress(data.progress)
        setMessage(data.message)
        setCurrentStep(data.currentStep)
      }
    })

    // 监听任务完成
    newSocket.on('task:completed', (data: TaskCompletedEvent) => {
      if (data.taskId === taskId) {
        setProgress(100)
        setMessage(data.message)
        setIsCompleted(true)
      }
    })

    // 监听任务失败
    newSocket.on('task:failed', (data: TaskCompletedEvent) => {
      if (data.taskId === taskId) {
        console.error('❌ Task failed:', data)
        setMessage(data.message)
        setIsFailed(true)
        setError(data.message || '未知错误')
      }
    })

    setSocket(newSocket)

    return () => {
      if (newSocket) {
        newSocket.emit('unsubscribe:task', { taskId })
        newSocket.disconnect()
      }
    }
  }, [taskId])

  const reset = useCallback(() => {
    setProgress(0)
    setMessage('')
    setCurrentStep(undefined)
    setIsCompleted(false)
    setIsFailed(false)
    setError(undefined)
  }, [])

  return {
    progress,
    message,
    currentStep,
    isCompleted,
    isFailed,
    error,
    reset,
  }
}
