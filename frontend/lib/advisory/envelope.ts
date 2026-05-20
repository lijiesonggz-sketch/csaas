type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function unwrapAdvisoryEnvelope<T>(body: unknown): T | null {
  let current = body

  for (let depth = 0; depth < 3; depth += 1) {
    if (isRecord(current) && 'data' in current) {
      current = current.data
      continue
    }
    break
  }

  return current === null || current === undefined ? null : (current as T)
}

export function readAdvisoryMessage(body: unknown): string | null {
  if (!isRecord(body)) return null

  const message = body.message
  if (typeof message === 'string' && message.trim()) return message
  if (Array.isArray(message)) {
    const first = message.find((item) => typeof item === 'string' && item.trim())
    return typeof first === 'string' ? first : null
  }

  if (isRecord(body.error)) {
    return readAdvisoryMessage(body.error)
  }

  return readAdvisoryMessage(body.data)
}
