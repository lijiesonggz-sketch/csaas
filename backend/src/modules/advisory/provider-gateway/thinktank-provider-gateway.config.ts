import { ConfigService } from '@nestjs/config'
import {
  ThinkTankProviderRetryOptions,
  ThinkTankProviderType,
} from './thinktank-provider-gateway.types'

export const THINKTANK_PROVIDER_GATEWAY_CONFIG = 'THINKTANK_PROVIDER_GATEWAY_CONFIG'
export const THINKTANK_PROVIDER_GATEWAY_ADAPTERS = 'THINKTANK_PROVIDER_GATEWAY_ADAPTERS'
export const THINKTANK_PROVIDER_GATEWAY_DEFAULT_MODEL = 'glm-5.1'
export const THINKTANK_PROVIDER_GATEWAY_FAKE_MODEL = 'fake-thinktank-smoke'

export interface ThinkTankProviderGatewayConfig {
  providerMode: ThinkTankProviderType
  model: string
  apiKey?: string
  baseUrl?: string
  timeoutMs: number
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
  const providerMode: ThinkTankProviderType = requestedMode === 'glm' ? 'glm' : 'fake'
  const apiKey = readString(source, 'GLM_API_KEY')
  const baseUrl = readString(source, 'GLM_BASE_URL')
  const timeoutMs = readPositiveInteger(source, 'THINKTANK_PROVIDER_TIMEOUT_MS', 30000)
  const maxAttempts = readPositiveInteger(source, 'THINKTANK_PROVIDER_RETRY_ATTEMPTS', 2)
  const delayMs = readNonNegativeInteger(source, 'THINKTANK_PROVIDER_RETRY_DELAY_MS', 100)

  return {
    providerMode,
    model: readString(source, 'GLM_MODEL') ?? THINKTANK_PROVIDER_GATEWAY_DEFAULT_MODEL,
    apiKey: apiKey ?? undefined,
    baseUrl: baseUrl ?? undefined,
    timeoutMs,
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
