export function toAuthoritativeScorePercent(
  authoritativeScore?: number | null,
): number | null {
  if (authoritativeScore == null || Number.isNaN(Number(authoritativeScore))) {
    return null
  }

  const numericScore = Number(authoritativeScore)

  // Preferred contract is 0-1 raw score from backend.
  // Keep a compatibility guard for older fixtures that still use 0-100.
  const percentage = numericScore <= 1 ? numericScore * 100 : numericScore
  return Math.max(0, Math.min(100, Math.round(percentage)))
}

export function formatAuthoritativeScorePercent(
  authoritativeScore?: number | null,
): string {
  const percent = toAuthoritativeScorePercent(authoritativeScore)
  return percent == null ? '--' : `${percent}%`
}
