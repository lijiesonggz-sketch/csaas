import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import { AITask } from './ai-task.entity'
import { AIModel } from './ai-generation-event.entity'

@Entity('ai_cost_tracking')
export class AICostTracking {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'task_id' })
  taskId: string

  @ManyToOne(() => AITask, (task) => task.costs)
  @JoinColumn({ name: 'task_id' })
  task: AITask

  @Column({
    type: 'enum',
    enum: AIModel,
  })
  model: AIModel

  @Column({ type: 'integer' })
  tokens: number

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  cost: number

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date
}
