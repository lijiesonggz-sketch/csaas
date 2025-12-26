import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Anthropic from '@anthropic-ai/sdk'
import {
  IAIClient,
  AIClientRequest,
  AIClientResponse,
} from '../interfaces/ai-client.interface'

@Injectable()
export class AnthropicClient implements IAIClient {
  private readonly logger = new Logger(AnthropicClient.name)
  private readonly client: Anthropic
  private readonly defaultModel: string

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY')
    const baseURL = this.configService.get<string>('ANTHROPIC_BASE_URL')

    this.client = new Anthropic({
      apiKey: apiKey || 'dummy-key',
      baseURL,
    })

    this.defaultModel =
      this.configService.get<string>('ANTHROPIC_MODEL') ||
      'claude-3-5-sonnet-20241022'
  }

  async generate(request: AIClientRequest): Promise<AIClientResponse> {
    const startTime = Date.now()

    try {
      const model = request.model || this.defaultModel

      this.logger.debug(
        `Calling Anthropic API with model ${model}, prompt length: ${request.prompt.length}`,
      )

      const response = await this.client.messages.create({
        model,
        max_tokens: request.maxTokens ?? 2000,
        temperature: request.temperature ?? 0.7,
        system: request.systemPrompt,
        messages: [
          {
            role: 'user',
            content: request.prompt,
          },
        ],
        // 禁用 Extended Thinking 功能（针对 Sonnet 4.5+）
        // 当type为disabled时，不需要传budget_tokens参数
        // @ts-ignore - thinking 是新功能，TypeScript类型定义可能未更新
        thinking: {
          type: 'disabled',
        },
      })

      const executionTime = Date.now() - startTime

      const content = response.content[0]
      if (content.type !== 'text') {
        throw new Error('Anthropic returned non-text response')
      }

      const promptTokens = response.usage.input_tokens
      const completionTokens = response.usage.output_tokens
      const totalTokens = promptTokens + completionTokens

      // Calculate cost based on model pricing
      const cost = this.calculateCost(model, promptTokens, completionTokens)

      this.logger.log(
        `Anthropic request completed in ${executionTime}ms, tokens: ${totalTokens}, cost: $${cost.toFixed(4)}`,
      )

      return {
        content: content.text,
        model: response.model,
        tokens: {
          prompt: promptTokens,
          completion: completionTokens,
          total: totalTokens,
        },
        cost,
        metadata: {
          stopReason: response.stop_reason,
          executionTimeMs: executionTime,
        },
      }
    } catch (error) {
      this.logger.error(`Anthropic API error: ${error.message}`, error.stack)
      throw new Error(`Anthropic API failed: ${error.message}`)
    }
  }

  getModelName(): string {
    return this.defaultModel
  }

  isAvailable(): boolean {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY')
    return !!apiKey && apiKey !== 'dummy-key'
  }

  /**
   * Calculate cost based on Anthropic pricing
   * Prices as of Dec 2025 (approximate)
   *
   * NOTE: 新模型定价会不断更新，如果遇到未知模型会使用默认定价并记录警告
   */
  private calculateCost(
    model: string,
    promptTokens: number,
    completionTokens: number,
  ): number {
    const pricing: Record<string, { prompt: number; completion: number }> = {
      // Claude Sonnet 4.5 (2025-01)
      'claude-sonnet-4-5-20250929': {
        prompt: 0.003 / 1000,
        completion: 0.015 / 1000,
      },
      // Claude 3.5 Sonnet
      'claude-3-5-sonnet-20241022': {
        prompt: 0.003 / 1000,
        completion: 0.015 / 1000,
      },
      // Claude 3.5 Haiku
      'claude-3-5-haiku-20241022': {
        prompt: 0.001 / 1000,
        completion: 0.005 / 1000,
      },
      // Claude 3 Opus
      'claude-3-opus-20240229': {
        prompt: 0.015 / 1000,
        completion: 0.075 / 1000,
      },
    }

    const modelPricing = pricing[model]

    if (!modelPricing) {
      this.logger.warn(
        `Unknown Anthropic model: ${model}. Using default pricing (Sonnet 3.5). ` +
        `Please update pricing table in anthropic.client.ts`,
      )
      return (
        promptTokens * pricing['claude-3-5-sonnet-20241022'].prompt +
        completionTokens * pricing['claude-3-5-sonnet-20241022'].completion
      )
    }

    return (
      promptTokens * modelPricing.prompt +
      completionTokens * modelPricing.completion
    )
  }
}
