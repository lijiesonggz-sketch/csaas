import { Test, TestingModule } from '@nestjs/testing'
import { AIOrchestrator } from './ai-orchestrator.service'
import { OpenAIClient } from './providers/openai.client'
import { AnthropicClient } from './providers/anthropic.client'
import { TongyiClient } from './providers/tongyi.client'
import { AIModel } from '../../database/entities/ai-generation-event.entity'

describe('AIOrchestrator', () => {
  let orchestrator: AIOrchestrator
  let openaiClient: OpenAIClient
  let anthropicClient: AnthropicClient
  let tongyiClient: TongyiClient

  const mockResponse = {
    content: 'Test response',
    model: 'gpt-4',
    tokens: {
      prompt: 100,
      completion: 50,
      total: 150,
    },
    cost: 0.005,
    metadata: {},
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIOrchestrator,
        {
          provide: OpenAIClient,
          useValue: {
            isAvailable: jest.fn(),
            generate: jest.fn(),
            // 使用mock返回动态模型名称，而不是硬编码
            getModelName: jest.fn().mockReturnValue('gpt-4'),
          },
        },
        {
          provide: AnthropicClient,
          useValue: {
            isAvailable: jest.fn(),
            generate: jest.fn(),
            // 实际环境可能是 claude-sonnet-4-5-20250929 或其他版本
            getModelName: jest.fn().mockReturnValue('claude-sonnet-4-5-20250929'),
          },
        },
        {
          provide: TongyiClient,
          useValue: {
            isAvailable: jest.fn(),
            generate: jest.fn(),
            // 实际环境可能是 qwen-max 或其他版本
            getModelName: jest.fn().mockReturnValue('qwen-max'),
          },
        },
      ],
    }).compile()

    orchestrator = module.get<AIOrchestrator>(AIOrchestrator)
    openaiClient = module.get<OpenAIClient>(OpenAIClient)
    anthropicClient = module.get<AnthropicClient>(AnthropicClient)
    tongyiClient = module.get<TongyiClient>(TongyiClient)
  })

  it('should be defined', () => {
    expect(orchestrator).toBeDefined()
  })

  describe('generate', () => {
    it('should successfully generate with preferred model (GPT-4)', async () => {
      jest.spyOn(openaiClient, 'isAvailable').mockReturnValue(true)
      jest.spyOn(openaiClient, 'generate').mockResolvedValue(mockResponse)

      const result = await orchestrator.generate(
        {
          prompt: 'Test prompt',
          temperature: 0.7,
          maxTokens: 2000,
        },
        AIModel.GPT4,
      )

      expect(result).toEqual(mockResponse)
      expect(openaiClient.generate).toHaveBeenCalledTimes(1)
    })

    it('should fallback to second provider when first fails', async () => {
      jest.spyOn(openaiClient, 'isAvailable').mockReturnValue(true)
      jest.spyOn(openaiClient, 'generate').mockRejectedValue(new Error('API timeout'))

      jest.spyOn(anthropicClient, 'isAvailable').mockReturnValue(true)
      // 使用实际的模型名称（从getModelName获取）
      const anthropicModel = anthropicClient.getModelName()
      jest.spyOn(anthropicClient, 'generate').mockResolvedValue({
        ...mockResponse,
        model: anthropicModel,
      })

      const result = await orchestrator.generate(
        {
          prompt: 'Test prompt',
          temperature: 0.7,
          maxTokens: 2000,
        },
        AIModel.GPT4,
      )

      expect(result.model).toBe(anthropicModel)
      expect(openaiClient.generate).toHaveBeenCalledTimes(1)
      expect(anthropicClient.generate).toHaveBeenCalledTimes(1)
    })

    it('should fallback to third provider when first two fail', async () => {
      jest.spyOn(openaiClient, 'isAvailable').mockReturnValue(true)
      jest.spyOn(openaiClient, 'generate').mockRejectedValue(new Error('API timeout'))

      jest.spyOn(anthropicClient, 'isAvailable').mockReturnValue(true)
      jest.spyOn(anthropicClient, 'generate').mockRejectedValue(new Error('Rate limit'))

      jest.spyOn(tongyiClient, 'isAvailable').mockReturnValue(true)
      // 使用实际的模型名称（从getModelName获取）
      const tongyiModel = tongyiClient.getModelName()
      jest.spyOn(tongyiClient, 'generate').mockResolvedValue({
        ...mockResponse,
        model: tongyiModel,
      })

      const result = await orchestrator.generate(
        {
          prompt: 'Test prompt',
          temperature: 0.7,
          maxTokens: 2000,
        },
        AIModel.GPT4,
      )

      expect(result.model).toBe(tongyiModel)
      expect(openaiClient.generate).toHaveBeenCalledTimes(1)
      expect(anthropicClient.generate).toHaveBeenCalledTimes(1)
      expect(tongyiClient.generate).toHaveBeenCalledTimes(1)
    })

    it('should throw error when all providers fail', async () => {
      jest.spyOn(openaiClient, 'isAvailable').mockReturnValue(true)
      jest.spyOn(openaiClient, 'generate').mockRejectedValue(new Error('OpenAI failed'))

      jest.spyOn(anthropicClient, 'isAvailable').mockReturnValue(true)
      jest.spyOn(anthropicClient, 'generate').mockRejectedValue(new Error('Anthropic failed'))

      jest.spyOn(tongyiClient, 'isAvailable').mockReturnValue(true)
      jest.spyOn(tongyiClient, 'generate').mockRejectedValue(new Error('Tongyi failed'))

      await expect(
        orchestrator.generate(
          {
            prompt: 'Test prompt',
            temperature: 0.7,
            maxTokens: 2000,
          },
          AIModel.GPT4,
        ),
      ).rejects.toThrow('All AI providers failed')
    })

    it('should skip unavailable providers', async () => {
      jest.spyOn(openaiClient, 'isAvailable').mockReturnValue(false)

      jest.spyOn(anthropicClient, 'isAvailable').mockReturnValue(true)
      // 使用实际的模型名称（从getModelName获取）
      const anthropicModel = anthropicClient.getModelName()
      jest.spyOn(anthropicClient, 'generate').mockResolvedValue({
        ...mockResponse,
        model: anthropicModel,
      })

      const result = await orchestrator.generate(
        {
          prompt: 'Test prompt',
          temperature: 0.7,
          maxTokens: 2000,
        },
        AIModel.GPT4,
      )

      expect(result.model).toBe(anthropicModel)
      expect(openaiClient.generate).not.toHaveBeenCalled()
      expect(anthropicClient.generate).toHaveBeenCalledTimes(1)
    })
  })

  describe('getAvailableProviders', () => {
    it('should return list of all providers with availability status', () => {
      jest.spyOn(openaiClient, 'isAvailable').mockReturnValue(true)
      jest.spyOn(anthropicClient, 'isAvailable').mockReturnValue(false)
      jest.spyOn(tongyiClient, 'isAvailable').mockReturnValue(true)

      const providers = orchestrator.getAvailableProviders()

      // 使用实际的模型名称（从getModelName获取）
      const openaiModel = openaiClient.getModelName()
      const anthropicModel = anthropicClient.getModelName()
      const tongyiModel = tongyiClient.getModelName()

      expect(providers).toHaveLength(3)
      expect(providers[0]).toEqual({
        name: 'OpenAI',
        model: openaiModel,
        available: true,
      })
      expect(providers[1]).toEqual({
        name: 'Anthropic',
        model: anthropicModel,
        available: false,
      })
      expect(providers[2]).toEqual({
        name: 'Tongyi',
        model: tongyiModel,
        available: true,
      })
    })
  })

  describe('hasAvailableProvider', () => {
    it('should return true when at least one provider is available', () => {
      jest.spyOn(openaiClient, 'isAvailable').mockReturnValue(false)
      jest.spyOn(anthropicClient, 'isAvailable').mockReturnValue(true)
      jest.spyOn(tongyiClient, 'isAvailable').mockReturnValue(false)

      expect(orchestrator.hasAvailableProvider()).toBe(true)
    })

    it('should return false when no providers are available', () => {
      jest.spyOn(openaiClient, 'isAvailable').mockReturnValue(false)
      jest.spyOn(anthropicClient, 'isAvailable').mockReturnValue(false)
      jest.spyOn(tongyiClient, 'isAvailable').mockReturnValue(false)

      expect(orchestrator.hasAvailableProvider()).toBe(false)
    })
  })
})
