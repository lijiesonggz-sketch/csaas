export interface AIClientRequest {
  prompt: string
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
  model?: string
  responseFormat?: { type: 'json_object' | 'text' } // 强制JSON输出
}

export interface AIClientResponse {
  content: string
  model: string
  tokens: {
    prompt: number
    completion: number
    total: number
  }
  cost: number
  metadata?: Record<string, any>
}

export interface IAIClient {
  /**
   * Generate text completion from AI model
   */
  generate(request: AIClientRequest): Promise<AIClientResponse>

  /**
   * Get model name
   */
  getModelName(): string

  /**
   * Check if client is available (API key configured)
   */
  isAvailable(): boolean
}
