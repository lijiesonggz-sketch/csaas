/**
 * WebSocket Hook (Story 2.4 - Issue #2修复)
 *
 * 提供WebSocket连接和事件监听
 */

'use client'

import { useEffect, useState, useRef } from 'react'
import { io, Socket } from 'socket.io-client'

/**
 * WebSocket连接hook
 *
 * @param organizationId - 组织ID，用于订阅组织房间
 * @returns Socket实例和连接状态
 */
export function useWebSocket(organizationId?: string) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    // 创建Socket连接
    const socketUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000/tasks'
    const newSocket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      // 超时配置
      timeout: 10000,              // 连接超时：10秒
      connectTimeout: 10000,       // 连接尝试超时：10秒
      pingTimeout: 60000,          // Ping超时：60秒
      pingInterval: 25000,         // Ping间隔：25秒
    })

    socketRef.current = newSocket

    // 连接事件
    newSocket.on('connect', () => {
      console.log('WebSocket connected')
      setIsConnected(true)

      // 连接成功后订阅组织房间
      if (organizationId) {
        newSocket.emit('subscribe:organization', { organizationId })
        console.log(`Subscribed to organization: ${organizationId}`)
      }
    })

    newSocket.on('disconnect', () => {
      console.log('WebSocket disconnected')
      setIsConnected(false)
    })

    newSocket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error)
      setIsConnected(false)
    })

    setSocket(newSocket)

    // 清理函数
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
    }
  }, [organizationId])

  return { socket, isConnected }
}
