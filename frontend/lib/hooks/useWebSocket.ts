'use client'

import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'

export function useWebSocket(organizationId?: string) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    const socketBaseUrl =
      process.env.NEXT_PUBLIC_WS_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')
    const socketUrl = socketBaseUrl.endsWith('/tasks')
      ? socketBaseUrl
      : `${socketBaseUrl.replace(/\/$/, '')}/tasks`

    const newSocket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      timeout: 10000,
    })

    socketRef.current = newSocket

    newSocket.on('connect', () => {
      console.log('WebSocket connected')
      setIsConnected(true)

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

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
    }
  }, [organizationId])

  return { socket, isConnected }
}
