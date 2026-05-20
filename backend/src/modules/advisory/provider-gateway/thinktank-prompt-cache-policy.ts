import { createHash } from 'node:crypto'
import {
  ThinkTankPromptCacheBypassReason,
  ThinkTankPromptCachePolicy,
  ThinkTankPromptCacheStatus,
  ThinkTankPromptCacheStrategy,
  ThinkTankProviderUsage,
} from './thinktank-provider-gateway.types'

export interface ThinkTankPromptCacheIdentitySource {
  relativePath: string
  contentHash: string
}

export interface ThinkTankPromptCachePolicyInput {
  workflowKey: string
  strategy?: ThinkTankPromptCacheStrategy
  provider?: string
  model?: string
  stepIndex?: number
  sources: ThinkTankPromptCacheIdentitySource[]
  cacheEligibleInputTokens?: number
}

export function createThinkTankPromptCachePolicy(
  input: ThinkTankPromptCachePolicyInput,
): ThinkTankPromptCachePolicy {
  const sourceRefs = input.sources.map((source) => source.relativePath)
  const sourceHashes = input.sources.map((source) => source.contentHash)
  const strategy = input.strategy ?? (sourceHashes.length ? 'provider-auto' : 'disabled')
  const bypassReason: ThinkTankPromptCacheBypassReason | undefined =
    strategy === 'disabled' ? 'no_static_prompt' : undefined

  return {
    strategy,
    cacheKey: hashCacheIdentity({
      workflowKey: input.workflowKey,
      strategy,
      provider: input.provider ?? 'default',
      model: input.model ?? 'default',
      sources: input.sources.map((source) => ({
        relativePath: source.relativePath,
        contentHash: source.contentHash,
      })),
    }),
    sourceRefs,
    sourceHashes,
    cacheEligibleInputTokens: input.cacheEligibleInputTokens,
    ...(bypassReason ? { bypassReason } : {}),
  }
}

export function bindThinkTankPromptCachePolicy(
  policy: ThinkTankPromptCachePolicy,
  input: {
    workflowKey?: string
    provider: string
    model: string
    stepIndex?: number
  },
): ThinkTankPromptCachePolicy {
  if (
    !input.workflowKey ||
    !policy.sourceRefs?.length ||
    !policy.sourceHashes?.length ||
    policy.sourceRefs.length !== policy.sourceHashes.length ||
    policy.sourceHashes.some((hash) => !hash)
  ) {
    return policy
  }

  return {
    ...policy,
    cacheKey: hashCacheIdentity({
      workflowKey: input.workflowKey,
      strategy: policy.strategy,
      provider: input.provider,
      model: input.model,
      sources: policy.sourceRefs.map((relativePath, index) => ({
        relativePath,
        contentHash: policy.sourceHashes?.[index] ?? '',
      })),
    }),
  }
}

export function inferThinkTankCacheStatus(
  strategy: ThinkTankPromptCacheStrategy | undefined,
  usage: Partial<ThinkTankProviderUsage> | undefined,
): ThinkTankPromptCacheStatus | undefined {
  if (!strategy) return undefined
  if (!usage) return undefined
  if (strategy === 'disabled' || strategy === 'unsupported') return 'bypass'
  if (!hasProviderCacheUsageMetadata(usage)) return 'bypass'
  if ((usage?.cacheReadInputTokens ?? 0) > 0 || (usage?.cachedInputTokens ?? 0) > 0) return 'hit'

  return 'miss'
}

export function inferThinkTankCacheBypassReason(
  strategy: ThinkTankPromptCacheStrategy | undefined,
  status: ThinkTankPromptCacheStatus | undefined,
  fallback?: ThinkTankPromptCacheBypassReason,
): ThinkTankPromptCacheBypassReason | undefined {
  if (status !== 'bypass') return undefined
  if (fallback) return fallback
  if (strategy === 'disabled') return 'disabled'
  if (strategy === 'unsupported') return 'unsupported'

  return 'provider_metadata_absent'
}

export function isThinkTankPromptCacheKey(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{32}$/i.test(value.trim())
}

function hasProviderCacheUsageMetadata(usage: Partial<ThinkTankProviderUsage>): boolean {
  return (
    usage.cacheReadInputTokens !== undefined ||
    usage.cacheCreationInputTokens !== undefined ||
    usage.cachedInputTokens !== undefined
  )
}

function hashCacheIdentity(value: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 32)
}
