import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets'
import { Logger } from '@nestjs/common'
import { Server, Socket } from 'socket.io'

/**
 * Task进度事件类型
 */
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
  executionTimeMs: number
  cost: number
}

export interface TaskFailedEvent {
  taskId: string
  error: string
  failedAt: Date
}

/**
 * WebSocket Gateway for real-time task progress updates
 *
 * Events:
 * - task:progress - 任务进度更新 (0-100%)
 * - task:completed - 任务完成
 * - task:failed - 任务失败
 */
@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      process.env.FRONTEND_URL || 'http://localhost:3001',
    ].filter(Boolean),
    credentials: true,
  },
  namespace: '/tasks',
})
export class TasksGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server

  private readonly logger = new Logger(TasksGateway.name)

  // 跟踪客户端订阅的任务
  private taskSubscriptions = new Map<string, Set<string>>() // taskId -> Set<socketId>

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`)
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`)

    // 清理订阅
    this.taskSubscriptions.forEach((subscribers, taskId) => {
      subscribers.delete(client.id)
      if (subscribers.size === 0) {
        this.taskSubscriptions.delete(taskId)
      }
    })
  }

  /**
   * 客户端订阅任务进度
   */
  @SubscribeMessage('subscribe:task')
  handleSubscribeTask(
    @MessageBody() data: { taskId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { taskId } = data

    if (!this.taskSubscriptions.has(taskId)) {
      this.taskSubscriptions.set(taskId, new Set())
    }

    this.taskSubscriptions.get(taskId).add(client.id)
    this.logger.debug(`Client ${client.id} subscribed to task ${taskId}`)

    return { success: true, taskId }
  }

  /**
   * 客户端取消订阅任务进度
   */
  @SubscribeMessage('unsubscribe:task')
  handleUnsubscribeTask(
    @MessageBody() data: { taskId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { taskId } = data

    if (this.taskSubscriptions.has(taskId)) {
      this.taskSubscriptions.get(taskId).delete(client.id)

      if (this.taskSubscriptions.get(taskId).size === 0) {
        this.taskSubscriptions.delete(taskId)
      }
    }

    this.logger.debug(`Client ${client.id} unsubscribed from task ${taskId}`)

    return { success: true, taskId }
  }

  /**
   * 发送任务进度更新（由AITaskProcessor调用）
   */
  emitTaskProgress(event: TaskProgressEvent) {
    const subscribers = this.taskSubscriptions.get(event.taskId)

    if (subscribers && subscribers.size > 0) {
      this.logger.debug(
        `Emitting progress for task ${event.taskId}: ${event.progress}% - ${event.message}`,
      )

      // 向所有订阅者发送进度更新
      subscribers.forEach((socketId) => {
        this.server.to(socketId).emit('task:progress', event)
      })
    }

    // 也广播到任务房间（如果客户端join了房间）
    this.server.to(`task:${event.taskId}`).emit('task:progress', event)
  }

  /**
   * 发送任务完成事件
   */
  emitTaskCompleted(event: TaskCompletedEvent) {
    const subscribers = this.taskSubscriptions.get(event.taskId)

    this.logger.log(
      `Task ${event.taskId} completed in ${event.executionTimeMs}ms, cost: $${event.cost.toFixed(4)}`,
    )

    if (subscribers && subscribers.size > 0) {
      subscribers.forEach((socketId) => {
        this.server.to(socketId).emit('task:completed', event)
      })
    }

    this.server.to(`task:${event.taskId}`).emit('task:completed', event)

    // 清理订阅
    this.taskSubscriptions.delete(event.taskId)
  }

  /**
   * 发送任务失败事件
   */
  emitTaskFailed(event: TaskFailedEvent) {
    const subscribers = this.taskSubscriptions.get(event.taskId)

    this.logger.error(`Task ${event.taskId} failed: ${event.error}`)

    if (subscribers && subscribers.size > 0) {
      subscribers.forEach((socketId) => {
        this.server.to(socketId).emit('task:failed', event)
      })
    }

    this.server.to(`task:${event.taskId}`).emit('task:failed', event)

    // 清理订阅
    this.taskSubscriptions.delete(event.taskId)
  }

  /**
   * 获取当前订阅统计
   */
  getSubscriptionStats() {
    const stats = {
      totalTasks: this.taskSubscriptions.size,
      totalSubscribers: 0,
      tasks: [] as Array<{ taskId: string; subscribers: number }>,
    }

    this.taskSubscriptions.forEach((subscribers, taskId) => {
      stats.totalSubscribers += subscribers.size
      stats.tasks.push({
        taskId,
        subscribers: subscribers.size,
      })
    })

    return stats
  }
}
