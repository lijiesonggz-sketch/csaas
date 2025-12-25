import { Injectable, Logger } from '@nestjs/common'
import { OpenAIClient } from './providers/openai.client'
import { AnthropicClient } from './providers/anthropic.client'
import { TongyiClient } from './providers/tongyi.client'
import {
  IAIClient,
  AIClientRequest,
  AIClientResponse,
} from './interfaces/ai-client.interface'
import { AIModel } from '../../database/entities/ai-generation-event.entity'

/**
 * AI Orchestrator Service
 * Manages routing, fallback, and cost optimization across multiple AI providers
 */
@Injectable()
export class AIOrchestrator {
  private readonly logger = new Logger(AIOrchestrator.name)

  constructor(
    private readonly openaiClient: OpenAIClient,
    private readonly anthropicClient: AnthropicClient,
    private readonly tongyiClient: TongyiClient,
  ) {}

  /**
   * Generate AI response with automatic provider selection and fallback
   */
  async generate(
    request: AIClientRequest,
    preferredModel: AIModel = AIModel.GPT4,
  ): Promise<AIClientResponse> {
    const providers = this.getProviderChain(preferredModel)

    let lastError: Error | null = null

    for (const provider of providers) {
      try {
        if (!provider.client.isAvailable()) {
          this.logger.debug(
            `${provider.name} is not available, skipping to next provider`,
          )
          continue
        }

        this.logger.log(
          `Attempting to generate with ${provider.name} (${provider.client.getModelName()})`,
        )

        const response = await provider.client.generate(request)

        this.logger.log(
          `Successfully generated response with ${provider.name}, tokens: ${response.tokens.total}, cost: $${response.cost.toFixed(4)}`,
        )

        return response
      } catch (error) {
        lastError = error
        this.logger.warn(
          `${provider.name} failed: ${error.message}, trying next provider`,
        )
      }
    }

    // All providers failed
    throw new Error(
      `All AI providers failed. Last error: ${lastError?.message || 'Unknown error'}`,
    )
  }

  /**
   * Get provider chain based on preferred model with fallback strategy
   */
  private getProviderChain(
    preferredModel: AIModel,
  ): Array<{ name: string; client: IAIClient }> {
    switch (preferredModel) {
      case AIModel.GPT4:
        return [
          { name: 'OpenAI', client: this.openaiClient },
          { name: 'Anthropic', client: this.anthropicClient },
          { name: 'Tongyi', client: this.tongyiClient },
        ]

      case AIModel.CLAUDE:
        return [
          { name: 'Anthropic', client: this.anthropicClient },
          { name: 'OpenAI', client: this.openaiClient },
          { name: 'Tongyi', client: this.tongyiClient },
        ]

      case AIModel.DOMESTIC:
        return [
          { name: 'Tongyi', client: this.tongyiClient },
          { name: 'OpenAI', client: this.openaiClient },
          { name: 'Anthropic', client: this.anthropicClient },
        ]

      default:
        return [
          { name: 'OpenAI', client: this.openaiClient },
          { name: 'Anthropic', client: this.anthropicClient },
          { name: 'Tongyi', client: this.tongyiClient },
        ]
    }
  }

  /**
   * Get all available providers
   */
  getAvailableProviders(): Array<{
    name: string
    model: string
    available: boolean
  }> {
    return [
      {
        name: 'OpenAI',
        model: this.openaiClient.getModelName(),
        available: this.openaiClient.isAvailable(),
      },
      {
        name: 'Anthropic',
        model: this.anthropicClient.getModelName(),
        available: this.anthropicClient.isAvailable(),
      },
      {
        name: 'Tongyi',
        model: this.tongyiClient.getModelName(),
        available: this.tongyiClient.isAvailable(),
      },
    ]
  }

  /**
   * Check if any provider is available
   */
  hasAvailableProvider(): boolean {
    return (
      this.openaiClient.isAvailable() ||
      this.anthropicClient.isAvailable() ||
      this.tongyiClient.isAvailable()
    )
  }
}
