/**
 * 测试Socket.IO连接
 * 需要在 frontend 目录运行: cd frontend && node ../test-socket-connection.js
 */
const { io } = require('./frontend/node_modules/socket.io-client');

console.log('🔌 尝试连接到 Socket.IO 服务器...\n');

const socket = io('http://localhost:3000/tasks', {
  transports: ['websocket', 'polling'],
});

socket.on('connect', () => {
  console.log('✅ WebSocket连接成功!');
  console.log(`   Socket ID: ${socket.id}`);
  console.log(`   Transport: ${socket.io.engine.transport.name}\n`);

  // 测试订阅
  console.log('📡 发送订阅请求...');
  socket.emit('subscribe:task', { taskId: 'test-task-123' });

  setTimeout(() => {
    console.log('\n✅ 测试完成,连接正常!');
    socket.disconnect();
    process.exit(0);
  }, 2000);
});

socket.on('connect_error', (error) => {
  console.error('❌ 连接失败!');
  console.error(`   错误: ${error.message}`);
  console.error(`   描述: ${error.description || '无'}\n`);
  process.exit(1);
});

socket.on('disconnect', (reason) => {
  console.log(`🔌 连接断开: ${reason}`);
});

// 超时保护
setTimeout(() => {
  console.error('❌ 连接超时!');
  process.exit(1);
}, 10000);
