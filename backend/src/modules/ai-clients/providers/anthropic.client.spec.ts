import { ConfigService } from '@nestjs/config'
import { AnthropicClient } from './anthropic.client'

const mockMessagesCreate = jest.fn()
const mockAnthropicConstructor = jest.fn()

jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation((options) => {
    mockAnthropicConstructor(options)

    return {
      messages: {
        create: mockMessagesCreate,
      },
    }
  }),
}))

describe('AnthropicClient', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'ok' }],
      model: 'glm-5.1',
      usage: {
        input_tokens: 10,
        output_tokens: 5,
      },
      stop_reason: 'end_turn',
    })
  })

  it('uses the GLM Anthropic-compatible endpoint without Claude-only thinking params', async () => {
    const client = createClient({
      ANTHROPIC_API_KEY: 'glm-key',
      ANTHROPIC_BASE_URL: 'https://open.bigmodel.cn/api/anthropic',
      ANTHROPIC_MODEL: 'glm-5.1',
    })

    await client.generate({
      prompt: '生成一段测试内容',
      maxTokens: 1000,
    })

    expect(mockAnthropicConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'glm-key',
        baseURL: 'https://open.bigmodel.cn/api/anthropic',
      }),
    )

    const request = mockMessagesCreate.mock.calls[0][0]
    expect(request).toEqual(
      expect.objectContaining({
        model: 'glm-5.1',
        max_tokens: 1000,
      }),
    )
    expect(request).not.toHaveProperty('thinking')
  })

  it('keeps Claude thinking disabled when using Claude models', async () => {
    const client = createClient({
      ANTHROPIC_API_KEY: 'claude-key',
      ANTHROPIC_BASE_URL: 'https://api.anthropic.com',
      ANTHROPIC_MODEL: 'claude-sonnet-4-5-20250929',
    })

    await client.generate({
      prompt: 'Generate a test response',
      maxTokens: 1000,
    })

    const request = mockMessagesCreate.mock.calls[0][0]
    expect(request.thinking).toEqual({ type: 'disabled' })
  })
})

function createClient(config: Record<string, string>): AnthropicClient {
  const configService = {
    get: jest.fn((key: string) => config[key]),
  } as unknown as ConfigService

  return new AnthropicClient(configService)
}
