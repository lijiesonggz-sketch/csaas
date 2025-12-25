export interface AIClientRequest {
  prompt: string
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
  model?: string
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
