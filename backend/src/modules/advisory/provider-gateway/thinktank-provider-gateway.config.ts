import { ConfigService } from '@nestjs/config'
import {
  ThinkTankProviderRetryOptions,
  ThinkTankProviderType,
} from './thinktank-provider-gateway.types'

export const THINKTANK_PROVIDER_GATEWAY_CONFIG = 'THINKTANK_PROVIDER_GATEWAY_CONFIG'
export const THINKTANK_PROVIDER_GATEWAY_ADAPTERS = 'THINKTANK_PROVIDER_GATEWAY_ADAPTERS'
export const THINKTANK_PROVIDER_GATEWAY_DEFAULT_MODEL = 'glm-5.1'
export const THINKTANK_PROVIDER_GATEWAY_DEFAULT_BASE_URL = 'https://open.bigmodel.cn/api/anthropic'
export const THINKTANK_PROVIDER_GATEWAY_FAKE_MODEL = 'fake-thinktank-smoke'
export const THINKTANK_PROVIDER_GATEWAY_DEFAULT_TIMEOUT_MS = 120000
export const THINKTANK_PROVIDER_GATEWAY_DEFAULT_MAX_OUTPUT_TOKENS = 65536

export interface ThinkTankProviderGatewayConfig {
  providerMode: ThinkTankProviderType
  model: string
  apiKey?: string
  baseUrl?: string
  timeoutMs: number
  maxOutputTokens?: number
  retry: Required<Pick<ThinkTankProviderRetryOptions, 'maxAttempts' | 'delayMs'>> & {
    backoffMultiplier: number
  }
  liveProviderEnabled: boolean
  anthropicExplicitCacheEnabled: boolean
}

type ConfigSource = ConfigService | Record<string, unknown> | NodeJS.ProcessEnv

export function resolveThinkTankProviderGatewayConfig(
  source: ConfigSource = process.env,
): ThinkTankProviderGatewayConfig {
  const requestedMode = readString(source, 'THINKTANK_PROVIDER_MODE')
  const apiKey = resolveGlmApiKey(source)
  const baseUrl = resolveGlmBaseUrl(source, Boolean(apiKey))
  const providerMode = resolveProviderMode(source, requestedMode, Boolean(apiKey && baseUrl))
  const timeoutMs = readPositiveInteger(
    source,
    'THINKTANK_PROVIDER_TIMEOUT_MS',
    THINKTANK_PROVIDER_GATEWAY_DEFAULT_TIMEOUT_MS,
  )
  const maxOutputTokens = readPositiveInteger(
    source,
    'THINKTANK_PROVIDER_MAX_OUTPUT_TOKENS',
    THINKTANK_PROVIDER_GATEWAY_DEFAULT_MAX_OUTPUT_TOKENS,
  )
  const maxAttempts = readPositiveInteger(source, 'THINKTANK_PROVIDER_RETRY_ATTEMPTS', 2)
  const delayMs = readNonNegativeInteger(source, 'THINKTANK_PROVIDER_RETRY_DELAY_MS', 100)

  return {
    providerMode,
    model: readString(source, 'GLM_MODEL') ?? THINKTANK_PROVIDER_GATEWAY_DEFAULT_MODEL,
    apiKey: apiKey ?? undefined,
    baseUrl: baseUrl ?? undefined,
    timeoutMs,
    maxOutputTokens,
    retry: {
      maxAttempts,
      delayMs,
      backoffMultiplier: 2,
    },
    liveProviderEnabled: providerMode === 'glm' && Boolean(apiKey && baseUrl),
    anthropicExplicitCacheEnabled:
      readString(source, 'THINKTANK_ANTHROPIC_EXPLICIT_CACHE_ENABLED') === 'true',
  }
}

function resolveGlmApiKey(source: ConfigSource): string | null {
  const explicitGlmApiKey = readString(source, 'GLM_API_KEY')
  if (explicitGlmApiKey) {
    return explicitGlmApiKey
  }

  return isBigModelBaseUrl(readString(source, 'OPENAI_BASE_URL'))
    ? readString(source, 'OPENAI_API_KEY')
    : null
}

function resolveGlmBaseUrl(source: ConfigSource, hasApiKey: boolean): string | null {
  const explicitGlmBaseUrl = readString(source, 'GLM_BASE_URL')
  if (explicitGlmBaseUrl) {
    return explicitGlmBaseUrl
  }

  return hasApiKey && isBigModelBaseUrl(readString(source, 'OPENAI_BASE_URL'))
    ? THINKTANK_PROVIDER_GATEWAY_DEFAULT_BASE_URL
    : null
}

function isBigModelBaseUrl(baseUrl: string | null): boolean {
  return baseUrl?.toLowerCase().includes('open.bigmodel.cn') ?? false
}

function resolveProviderMode(
  source: ConfigSource,
  requestedMode: string | null,
  hasGlmCredentials: boolean,
): ThinkTankProviderType {
  if (requestedMode === 'glm' || requestedMode === 'fake') {
    return requestedMode
  }

  if (hasGlmCredentials) {
    return 'glm'
  }

  return readString(source, 'NODE_ENV') === 'test' ? 'fake' : 'glm'
}

function readString(source: ConfigSource, key: string): string | null {
  const value =
    typeof (source as ConfigService).get === 'function'
      ? (source as ConfigService).get<string | undefined>(key)
      : (source as Record<string, unknown>)[key]

  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function readPositiveInteger(source: ConfigSource, key: string, fallback: number): number {
  const rawValue = readString(source, key)
  if (rawValue === null) return fallback

  const value = Number(rawValue)
  return Number.isInteger(value) && value > 0 ? value : fallback
}

function readNonNegativeInteger(source: ConfigSource, key: string, fallback: number): number {
  const rawValue = readString(source, key)
  if (rawValue === null) return fallback

  const value = Number(rawValue)
  return Number.isInteger(value) && value >= 0 ? value : fallback
}
