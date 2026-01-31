/**
 * 简单的WebSocket连接测试脚本
 *
 * 使用方法:
 * node test-ws-connection.js
 */

const { io } = require('socket.io-client')

const SOCKET_URL = 'http://localhost:3000/tasks'

console.log('🔌 测试WebSocket连接...')
console.log('📡 连接到:', SOCKET_URL)
console.log('')

const socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  timeout: 10000,
})

socket.on('connect', () => {
  console.log('✅ 成功! WebSocket已连接')
  console.log('📱 Socket ID:', socket.id)
  console.log('')
  console.log('💡 现在可以打开浏览器访问:')
  console.log('   http://localhost:3001/radar/tech')
  console.log('')
  console.log('📋 检查项:')
  console.log('   ✓ 浏览器控制台应该显示 "WebSocket connected"')
  console.log('   ✓ 页面顶部应该显示 "✓ 实时推送已连接"')
  console.log('   ✓ 不应该出现 timeout 错误')
  console.log('')

  // 3秒后断开连接
  setTimeout(() => {
    console.log('✅ 测试完成! 断开连接...')
    socket.disconnect()
    process.exit(0)
  }, 3000)
})

socket.on('connect_error', (error) => {
  console.error('❌ 连接错误:', error.message)
  console.log('')
  console.log('🔍 故障排查:')
  console.log('   1. 确认后端服务正在运行 (http://localhost:3000)')
  console.log('   2. 检查后端日志是否有错误')
  console.log('   3. 确认端口3000没有被占用')
  console.log('')
  process.exit(1)
})

socket.on('disconnect', (reason) => {
  console.log('🔌 断开连接:', reason)
})

console.log('⏳ 等待连接... (10秒超时)')
console.log('')
