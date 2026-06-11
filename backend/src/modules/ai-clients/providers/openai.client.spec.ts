import { ConfigService } from '@nestjs/config'
import { OpenAIClient } from './openai.client'

const mockChatCompletionCreate = jest.fn()
const mockOpenAIConstructor = jest.fn()

jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation((options) => {
    mockOpenAIConstructor(options)

    return {
      chat: {
        completions: {
          create: mockChatCompletionCreate,
        },
      },
    }
  }),
}))

describe('OpenAIClient', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockChatCompletionCreate.mockResolvedValue({
      model: 'deepseek-v4-flash',
      choices: [
        {
          message: {
            content: 'ok',
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
      },
    })
  })

  it('优先使用 DeepSeek 配置作为第一模型槽位', async () => {
    const client = createClient({
      DEEPSEEK_API_KEY: 'deepseek-key',
      DEEPSEEK_BASE_URL: 'https://api.deepseek.com',
      DEEPSEEK_MODEL: 'deepseek-v4-flash',
      OPENAI_API_KEY: 'openai-key',
      OPENAI_BASE_URL: 'https://api.openai.com/v1',
      OPENAI_MODEL: 'gpt-4',
    })

    expect(client.getProviderName()).toBe('DeepSeek')
    expect(client.getModelName()).toBe('deepseek-v4-flash')
    expect(client.isAvailable()).toBe(true)

    await client.generate({
      prompt: '生成一段测试内容',
      maxTokens: 1000,
    })

    expect(mockOpenAIConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'deepseek-key',
        baseURL: 'https://api.deepseek.com',
      }),
    )
    expect(mockChatCompletionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'deepseek-v4-flash',
        max_tokens: 1000,
      }),
    )
  })

  it('未配置 DeepSeek 时保留 OpenAI-compatible 旧配置兜底', () => {
    const client = createClient({
      OPENAI_API_KEY: 'bigmodel-key',
      OPENAI_BASE_URL: 'https://open.bigmodel.cn/api/paas/v4/',
      OPENAI_MODEL: 'glm-5',
    })

    expect(client.getProviderName()).toBe('OpenAI')
    expect(client.getModelName()).toBe('glm-5')
    expect(client.isAvailable()).toBe(true)
    expect(mockOpenAIConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'bigmodel-key',
        baseURL: 'https://open.bigmodel.cn/api/paas/v4/',
      }),
    )
  })
})

function createClient(config: Record<string, string>): OpenAIClient {
  const configService = {
    get: jest.fn((key: string) => config[key]),
  } as unknown as ConfigService

  return new OpenAIClient(configService)
}
