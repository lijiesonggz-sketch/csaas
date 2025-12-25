import { AIModel } from '../../../database/entities/ai-generation-event.entity'

export interface AITaskJobData {
  taskId: string
  type: string
  input: Record<string, any>
  model: AIModel
  priority?: number
  userId?: string
}

export interface AITaskJobResult {
  taskId: string
  output: Record<string, any>
  tokens: number
  cost: number
  executionTimeMs: number
}
