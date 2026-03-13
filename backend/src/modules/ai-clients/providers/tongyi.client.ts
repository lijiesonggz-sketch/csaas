import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import OpenAI from 'openai'
import { IAIClient, AIClientRequest, AIClientResponse } from '../interfaces/ai-client.interface'

/**
 * Tongyi Qianwen (通义千问) client
 * Uses Alibaba Cloud DashScope API with OpenAI-compatible interface
 */
@Injectable()
export class TongyiClient implements IAIClient {
  private readonly logger = new Logger(TongyiClient.name)
  private readonly client: OpenAI
  private readonly defaultModel: string

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('TONGYI_API_KEY')
    const baseURL = this.configService.get<string>('TONGYI_BASE_URL')
    const model = this.configService.get<string>('TONGYI_MODEL')

    // 🔍 详细日志：诊断环境变量加载问题
    this.logger.log('🔍 TongyiClient构造函数 - 环境变量检查:')
    this.logger.log(`  TONGYI_API_KEY: ${apiKey ? apiKey.substring(0, 15) + '...' : '❌ MISSING'}`)
    this.logger.log(`  TONGYI_BASE_URL: ${baseURL || '❌ MISSING (使用默认值)'}`)
    this.logger.log(`  TONGYI_MODEL: ${model || '❌ MISSING (使用默认值)'}`)

    // Tongyi uses DashScope API with OpenAI-compatible interface
    this.client = new OpenAI({
      apiKey: apiKey || 'dummy-key',
      baseURL: baseURL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      timeout: 900000, // 15分钟超时（900秒 = 900000ms）- 与GLM保持一致
      maxRetries: 0, // 不重试，只调用一次
    })

    this.defaultModel = model || 'qwen-max'

    this.logger.log(`✅ TongyiClient初始化完成 - Model: ${this.defaultModel}`)
  }

  async generate(request: AIClientRequest): Promise<AIClientResponse> {
    this.logger.log(
      `🔵 TongyiClient.generate() called with model: ${this.defaultModel}, maxTokens: ${request.maxTokens}`,
    )

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

      // 根据模型设置最大 token 限制
      // qwen-long: 输出最大 32768
      // qwen3-max / Qwen3-Max-2026-01-23: 输出最大 32768（新旗舰模型）
      // qwen-max: 输出最大 8192
      // qwen-plus/turbo: 输出最大 6144
      const modelMaxTokens =
        model === 'qwen-long'
          ? 32768
          : model === 'qwen3-max' || model === 'Qwen3-Max-2026-01-23'
            ? 32768
            : model === 'qwen-max'
              ? 8192
              : 6144
      const maxTokens = Math.min(request.maxTokens ?? 5000, modelMaxTokens)

      this.logger.debug(
        `Calling Tongyi API with model ${model}, prompt length: ${request.prompt.length}, maxTokens: ${maxTokens}`,
      )

      const completion = await this.client.chat.completions.create({
        model,
        messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: maxTokens,
        ...(request.responseFormat && { response_format: request.responseFormat }),
      })

      const executionTime = Date.now() - startTime

      const choice = completion.choices[0]
      const usage = completion.usage

      if (!choice?.message?.content) {
        throw new Error('Tongyi returned empty response')
      }

      const promptTokens = usage?.prompt_tokens || 0
      const completionTokens = usage?.completion_tokens || 0
      const totalTokens = usage?.total_tokens || 0

      // Calculate cost based on model pricing
      const cost = this.calculateCost(model, promptTokens, completionTokens)

      this.logger.log(
        `Tongyi request completed in ${executionTime}ms, tokens: ${totalTokens}, cost: ¥${cost.toFixed(4)}`,
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
      this.logger.error(`Tongyi API error: ${error.message}`, error.stack)
      throw new Error(`Tongyi API failed: ${error.message}`)
    }
  }

  getModelName(): string {
    return this.defaultModel
  }

  isAvailable(): boolean {
    const apiKey = this.configService.get<string>('TONGYI_API_KEY')
    const model = this.configService.get<string>('TONGYI_MODEL')
    const available = !!apiKey && apiKey !== 'dummy-key'

    this.logger.log(
      `🔍 TongyiClient.isAvailable() = ${available} (API key: ${apiKey ? apiKey.substring(0, 10) + '...' : 'missing'}, model: ${model})`,
    )

    return available
  }

  /**
   * Calculate cost based on Tongyi pricing (in RMB)
   * Prices as of Dec 2025 (approximate)
   *
   * NOTE: 新模型定价会不断更新，如果遇到未知模型会使用默认定价并记录警告
   */
  private calculateCost(model: string, promptTokens: number, completionTokens: number): number {
    // Pricing in RMB per token (2025年最新定价)
    // 官方定价是每1000 tokens的价格，这里转换为每个token的价格
    const pricing: Record<string, { prompt: number; completion: number }> = {
      'qwen-plus': { prompt: 0.004 / 1000, completion: 0.012 / 1000 }, // 普通版
      'qwen-turbo': { prompt: 0.002 / 1000, completion: 0.006 / 1000 }, // 快速版
      'qwen3-max': { prompt: 0.02 / 1000, completion: 0.06 / 1000 }, // 新旗舰版（与qwen-max定价相同）
      'Qwen3-Max-2026-01-23': { prompt: 0.02 / 1000, completion: 0.06 / 1000 }, // 最新旗舰版
      'qwen-max': { prompt: 0.02 / 1000, completion: 0.06 / 1000 }, // 旗舰版
      'qwen-long': { prompt: 0.0005 / 1000, completion: 0.002 / 1000 }, // 长文本版 (输入1000万tokens/输出32768tokens)
      'qwen2.5-72b-instruct': { prompt: 0.004 / 1000, completion: 0.004 / 1000 },
    }

    const modelPricing = pricing[model]

    if (!modelPricing) {
      this.logger.warn(
        `Unknown Tongyi model: ${model}. Using default pricing (qwen-plus). ` +
          `Please update pricing table in tongyi.client.ts`,
      )
      return (
        promptTokens * pricing['qwen-plus'].prompt +
        completionTokens * pricing['qwen-plus'].completion
      )
    }

    return promptTokens * modelPricing.prompt + completionTokens * modelPricing.completion
  }
}
