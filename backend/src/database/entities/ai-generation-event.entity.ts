import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import { AITask } from './ai-task.entity'

export enum AIModel {
  GPT4 = 'gpt4',
  CLAUDE = 'claude',
  DOMESTIC = 'domestic',
}

@Entity('ai_generation_events')
export class AIGenerationEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'task_id' })
  taskId: string

  @ManyToOne(() => AITask, (task) => task.events)
  @JoinColumn({ name: 'task_id' })
  task: AITask

  @Column({
    type: 'enum',
    enum: AIModel,
  })
  model: AIModel

  @Column({ type: 'jsonb' })
  input: Record<string, any>

  @Column({ type: 'jsonb', nullable: true })
  output: Record<string, any>

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>

  @Column({ type: 'text', nullable: true, name: 'error_message' })
  errorMessage: string

  @Column({ type: 'integer', nullable: true, name: 'execution_time_ms' })
  executionTimeMs: number

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date
}
