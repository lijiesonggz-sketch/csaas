import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import OpenAI from 'openai'
import { IAIClient, AIClientRequest, AIClientResponse } from '../interfaces/ai-client.interface'

@Injectable()
export class OpenAIClient implements IAIClient {
  private readonly logger = new Logger(OpenAIClient.name)
  private readonly client: OpenAI
  private readonly defaultModel: string
  private readonly providerName: string

  constructor(private readonly configService: ConfigService) {
    const deepseekApiKey = this.configService.get<string>('DEEPSEEK_API_KEY')
    const apiKey = deepseekApiKey || this.configService.get<string>('OPENAI_API_KEY')
    const baseURL =
      this.configService.get<string>('DEEPSEEK_BASE_URL') ||
      this.configService.get<string>('OPENAI_BASE_URL')

    this.client = new OpenAI({
      apiKey: apiKey || 'dummy-key',
      baseURL,
      timeout: 900000, // 15分钟超时（900秒 = 900000ms）- 大型Prompt需要更长处理时间
      maxRetries: 0, // 不重试，只调用一次
    })

    this.defaultModel =
      this.configService.get<string>('DEEPSEEK_MODEL') ||
      this.configService.get<string>('OPENAI_MODEL') ||
      'deepseek-v4-flash'
    this.providerName = deepseekApiKey ? 'DeepSeek' : 'OpenAI'
  }

  async generate(request: AIClientRequest): Promise<AIClientResponse> {
    const startTime = Date.now()

    try {
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = []

      if (request.systemPrompt) {
        messages.push({
          role: 'system',
          content: request.systemPrompt,
        })
      }

      messages.push({
        role: 'user',
        content: request.prompt,
      })

      const model = request.model || this.defaultModel

      this.logger.debug(
        `Calling ${this.providerName} API with model ${model}, prompt length: ${request.prompt.length}`,
      )

      const completion = await this.client.chat.completions.create({
        model,
        messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 120000, // 标准解读等任务需要较大的输出窗口
        ...(request.responseFormat && { response_format: request.responseFormat }),
      })

      const executionTime = Date.now() - startTime

      const choice = completion.choices[0]
      const usage = completion.usage

      if (!choice?.message?.content) {
        throw new Error(`${this.providerName} returned empty response`)
      }

      const promptTokens = usage?.prompt_tokens || 0
      const completionTokens = usage?.completion_tokens || 0
      const totalTokens = usage?.total_tokens || 0

      // Calculate cost based on model pricing
      const cost = this.calculateCost(model, promptTokens, completionTokens)

      this.logger.log(
        `${this.providerName} request completed in ${executionTime}ms, tokens: ${totalTokens}, cost: $${cost.toFixed(4)}`,
      )

      return {
        content: choice.message.content,
        model: completion.model,
        tokens: {
          prompt: promptTokens,
          completion: completionTokens,
          total: totalTokens,
        },
        cost,
        metadata: {
          finishReason: choice.finish_reason,
          executionTimeMs: executionTime,
        },
      }
    } catch (error) {
      this.logger.error(`${this.providerName} API error: ${error.message}`, error.stack)
      throw new Error(`${this.providerName} API failed: ${error.message}`)
    }
  }

  getModelName(): string {
    return this.defaultModel
  }

  getProviderName(): string {
    return this.providerName
  }

  isAvailable(): boolean {
    const apiKey =
      this.configService.get<string>('DEEPSEEK_API_KEY') ||
      this.configService.get<string>('OPENAI_API_KEY')
    return !!apiKey && apiKey !== 'dummy-key'
  }

  /**
   * Calculate cost based on OpenAI-compatible model pricing.
   *
   * NOTE: 新模型定价会不断更新，如果遇到未知模型会使用默认定价并记录警告
   */
  private calculateCost(model: string, promptTokens: number, completionTokens: number): number {
    const pricing: Record<string, { prompt: number; completion: number }> = {
      'gpt-4': { prompt: 0.03 / 1000, completion: 0.06 / 1000 },
      'gpt-4-turbo': { prompt: 0.01 / 1000, completion: 0.03 / 1000 },
      'gpt-4o': { prompt: 0.005 / 1000, completion: 0.015 / 1000 },
      'gpt-4o-mini': { prompt: 0.00015 / 1000, completion: 0.0006 / 1000 },
      'gpt-3.5-turbo': { prompt: 0.0005 / 1000, completion: 0.0015 / 1000 },
      'o1-preview': { prompt: 0.015 / 1000, completion: 0.06 / 1000 },
      'o1-mini': { prompt: 0.003 / 1000, completion: 0.012 / 1000 },
      'deepseek-v4-flash': { prompt: 0, completion: 0 },
    }

    const modelPricing = pricing[model]

    if (!modelPricing) {
      this.logger.warn(
        `Unknown ${this.providerName} model: ${model}. Using default pricing (first-model-compatible slot). ` +
          `Please update pricing table in openai.client.ts`,
      )
      return promptTokens * pricing['gpt-4'].prompt + completionTokens * pricing['gpt-4'].completion
    }

    return promptTokens * modelPricing.prompt + completionTokens * modelPricing.completion
  }
}
