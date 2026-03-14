import { useCallback, useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'

export interface TaskProgressEvent {
  taskId: string
  progress: number
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

const SOCKET_BASE_URL =
  process.env.NEXT_PUBLIC_WS_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3000'

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

    const socketUrl = SOCKET_BASE_URL.endsWith('/tasks')
      ? SOCKET_BASE_URL
      : `${SOCKET_BASE_URL.replace(/\/$/, '')}/tasks`
    const newSocket = io(socketUrl, {
      transports: ['websocket', 'polling'],
    })

    newSocket.on('connect', () => {
      console.log('WebSocket connected to /tasks namespace')
      newSocket.emit('subscribe:task', { taskId })
    })

    newSocket.on('disconnect', () => {
      console.log('WebSocket disconnected')
    })

    newSocket.on('task:progress', (data: TaskProgressEvent) => {
      if (data.taskId === taskId) {
        setProgress(data.progress)
        setMessage(data.message)
        setCurrentStep(data.currentStep)
      }
    })

    newSocket.on('task:completed', (data: TaskCompletedEvent) => {
      if (data.taskId === taskId) {
        setProgress(100)
        setMessage(data.message)
        setIsCompleted(true)
      }
    })

    newSocket.on('task:failed', (data: TaskCompletedEvent) => {
      if (data.taskId === taskId) {
        console.error('Task failed:', data)
        setMessage(data.message)
        setIsFailed(true)
        setError(data.message || 'Task failed')
      }
    })

    setSocket(newSocket)

    return () => {
      newSocket.emit('unsubscribe:task', { taskId })
      newSocket.disconnect()
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
