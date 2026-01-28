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
 * @returns Socket实例和连接状态
 */
export function useWebSocket() {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    // 创建Socket连接
    const socketUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001'
    const newSocket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    })

    socketRef.current = newSocket

    // 连接事件
    newSocket.on('connect', () => {
      console.log('WebSocket connected')
      setIsConnected(true)
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
  }, [])

  return { socket, isConnected }
}
