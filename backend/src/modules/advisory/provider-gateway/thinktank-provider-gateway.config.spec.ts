import {
  THINKTANK_PROVIDER_GATEWAY_DEFAULT_BASE_URL,
  THINKTANK_PROVIDER_GATEWAY_DEFAULT_TIMEOUT_MS,
  resolveThinkTankProviderGatewayConfig,
  THINKTANK_PROVIDER_GATEWAY_DEFAULT_MODEL,
} from './thinktank-provider-gateway.config'

describe('ThinkTank provider gateway config', () => {
  it('defaults automated test execution to fake mode without model API keys', () => {
    const config = resolveThinkTankProviderGatewayConfig({
      NODE_ENV: 'test',
      THINKTANK_PROVIDER_MODE: undefined,
      GLM_API_KEY: undefined,
      ANTHROPIC_API_KEY: undefined,
    })

    expect(config).toMatchObject({
      providerMode: 'fake',
      model: THINKTANK_PROVIDER_GATEWAY_DEFAULT_MODEL,
      timeoutMs: THINKTANK_PROVIDER_GATEWAY_DEFAULT_TIMEOUT_MS,
      liveProviderEnabled: false,
      anthropicExplicitCacheEnabled: false,
      retry: {
        maxAttempts: 2,
        delayMs: 100,
        backoffMultiplier: 2,
      },
    })
  })

  it('does not silently fall back to fake provider in development when GLM is missing', () => {
    const config = resolveThinkTankProviderGatewayConfig({
      NODE_ENV: 'development',
      THINKTANK_PROVIDER_MODE: undefined,
      GLM_API_KEY: undefined,
      GLM_BASE_URL: undefined,
    })

    expect(config).toMatchObject({
      providerMode: 'glm',
      apiKey: undefined,
      baseUrl: undefined,
      liveProviderEnabled: false,
    })
  })

  it('selects live GLM automatically when credentials are configured', () => {
    const config = resolveThinkTankProviderGatewayConfig({
      NODE_ENV: 'development',
      THINKTANK_PROVIDER_MODE: undefined,
      GLM_API_KEY: 'glm-key',
      GLM_BASE_URL: 'https://example.test/api/anthropic',
      GLM_MODEL: 'glm-5.1',
    })

    expect(config).toMatchObject({
      providerMode: 'glm',
      apiKey: 'glm-key',
      baseUrl: 'https://example.test/api/anthropic',
      model: 'glm-5.1',
      timeoutMs: THINKTANK_PROVIDER_GATEWAY_DEFAULT_TIMEOUT_MS,
      liveProviderEnabled: true,
    })
  })

  it('maps existing BigModel OpenAI-compatible settings to live GLM without duplicating secrets', () => {
    const config = resolveThinkTankProviderGatewayConfig({
      NODE_ENV: 'development',
      THINKTANK_PROVIDER_MODE: undefined,
      OPENAI_API_KEY: 'bigmodel-key',
      OPENAI_BASE_URL: 'https://open.bigmodel.cn/api/paas/v4/',
      GLM_MODEL: 'glm-5.1',
    })

    expect(config).toMatchObject({
      providerMode: 'glm',
      apiKey: 'bigmodel-key',
      baseUrl: THINKTANK_PROVIDER_GATEWAY_DEFAULT_BASE_URL,
      model: 'glm-5.1',
      liveProviderEnabled: true,
    })
  })

  it('uses explicit GLM settings only when live mode is requested', () => {
    const config = resolveThinkTankProviderGatewayConfig({
      THINKTANK_PROVIDER_MODE: 'glm',
      GLM_API_KEY: 'glm-key',
      GLM_BASE_URL: 'https://example.test/v1',
      GLM_MODEL: 'glm-5.1',
      THINKTANK_PROVIDER_TIMEOUT_MS: '15000',
      THINKTANK_PROVIDER_RETRY_ATTEMPTS: '3',
      THINKTANK_PROVIDER_RETRY_DELAY_MS: '250',
    })

    expect(config).toMatchObject({
      providerMode: 'glm',
      apiKey: 'glm-key',
      baseUrl: 'https://example.test/v1',
      model: 'glm-5.1',
      timeoutMs: 15000,
      liveProviderEnabled: true,
      anthropicExplicitCacheEnabled: false,
      retry: {
        maxAttempts: 3,
        delayMs: 250,
        backoffMultiplier: 2,
      },
    })
  })

  it('does not fall back to Anthropic defaults for GLM live mode', () => {
    const anthropicOnly = resolveThinkTankProviderGatewayConfig({
      THINKTANK_PROVIDER_MODE: 'glm',
      ANTHROPIC_API_KEY: 'anthropic-key',
      ANTHROPIC_BASE_URL: 'https://api.anthropic.com',
    })

    expect(anthropicOnly).toMatchObject({
      providerMode: 'glm',
      apiKey: undefined,
      baseUrl: undefined,
      liveProviderEnabled: false,
      anthropicExplicitCacheEnabled: false,
    })

    const missingBaseUrl = resolveThinkTankProviderGatewayConfig({
      THINKTANK_PROVIDER_MODE: 'glm',
      GLM_API_KEY: 'glm-key',
    })

    expect(missingBaseUrl).toMatchObject({
      providerMode: 'glm',
      apiKey: 'glm-key',
      baseUrl: undefined,
      liveProviderEnabled: false,
      anthropicExplicitCacheEnabled: false,
    })
  })

  it('enables Anthropic explicit cache only through the dedicated flag', () => {
    const config = resolveThinkTankProviderGatewayConfig({
      THINKTANK_ANTHROPIC_EXPLICIT_CACHE_ENABLED: 'true',
    })

    expect(config.anthropicExplicitCacheEnabled).toBe(true)
  })
})
