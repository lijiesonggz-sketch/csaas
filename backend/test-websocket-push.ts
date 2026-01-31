/**
 * 手动触发雷达推送的测试脚本
 *
 * 使用方法：
 * 1. 确保后端服务正在运行 (http://localhost:3000)
 * 2. 运行: npx ts-node test-websocket-push.ts
 */

import { io, Socket } from 'socket.io-client'

// WebSocket连接配置
const SOCKET_URL = 'http://localhost:3000/tasks'
const TEST_ORG_ID = 'test-org-001' // 替换为你的组织ID

console.log('🔌 连接到WebSocket服务器:', SOCKET_URL)

// 连接到WebSocket
const socket: Socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'],
  reconnection: true,
})

socket.on('connect', () => {
  console.log('✅ WebSocket连接成功!')
  console.log('📱 Socket ID:', socket.id)

  // 订阅组织房间（接收推送）
  socket.emit('subscribe:organization', { organizationId: TEST_ORG_ID })
  console.log('📥 已订阅组织:', TEST_ORG_ID)

  // 模拟服务器发送推送事件（用于测试前端接收）
  // 注意：这只是模拟客户端行为，实际推送需要从后端BullMQ任务触发
  setTimeout(() => {
    console.log('\n🧪 测试: 监听 radar:push:new 事件...')
    console.log('💡 提示: 如果你想测试实际的推送功能，需要:')
    console.log('   1. 在数据库中创建 status=scheduled 的推送记录')
    console.log('   2. 手动触发 BullMQ 推送任务')
    console.log('   3. 或者等待定时任务自动触发')
  }, 1000)
})

socket.on('connect_error', (error) => {
  console.error('❌ WebSocket连接错误:', error.message)
})

socket.on('disconnect', (reason) => {
  console.log('🔌 WebSocket断开连接:', reason)
})

// 监听雷达推送事件
socket.on('radar:push:new', (data) => {
  console.log('\n🎉 收到新的雷达推送!')
  console.log('📦 推送数据:', JSON.stringify(data, null, 2))
})

// 保持连接
process.on('SIGINT', () => {
  console.log('\n👋 断开连接...')
  socket.disconnect()
  process.exit(0)
})

console.log('⏳ 等待连接...')
console.log('💡 提示: 按 Ctrl+C 退出\n')
