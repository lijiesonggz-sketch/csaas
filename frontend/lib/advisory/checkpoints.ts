export interface ThinkTankCheckpointWarning {
  code: 'THINKTANK_CHECKPOINT_PERSISTENCE_DEGRADED' | string
  errorCategory: string
  recoveryGuidance: string
}

export const THINKTANK_CHECKPOINT_WARNING_FALLBACK =
  '当前操作已完成，但自动恢复检查点暂时不可用。你可以继续工作；离开后请从最近保存的会话状态恢复。'

export function normalizeThinkTankCheckpointWarning(
  value: unknown
): ThinkTankCheckpointWarning | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined

  const warning = value as Partial<ThinkTankCheckpointWarning>
  if (typeof warning.code !== 'string' || typeof warning.errorCategory !== 'string') {
    return undefined
  }

  return {
    code: warning.code,
    errorCategory: warning.errorCategory,
    recoveryGuidance:
      typeof warning.recoveryGuidance === 'string' && warning.recoveryGuidance.trim()
        ? warning.recoveryGuidance.trim()
        : THINKTANK_CHECKPOINT_WARNING_FALLBACK,
  }
}

export function readThinkTankCheckpointWarningMessage(
  warning: ThinkTankCheckpointWarning | undefined
): string | null {
  if (!warning) return null

  return warning.recoveryGuidance || THINKTANK_CHECKPOINT_WARNING_FALLBACK
}
