export const story14TenantId = '660e8400-e29b-41d4-a716-446655440014'
export const story14ActorId = '770e8400-e29b-41d4-a716-446655440014'
export const story14SubjectId = 'thinktank'
export const story14CorrelationId = '880e8400-e29b-41d4-a716-446655440014'

export const story14RawSensitivePayload = {
  conversation: 'raw user conversation must not be copied into event payloads',
  message: 'raw message must not be copied',
  messages: ['raw thread'],
  prompt: 'hidden prompt',
  content: 'raw generated content',
  rawContent: 'raw provider content',
  report: 'full report body',
  document: 'attached document text',
  enterpriseContext: 'confidential enterprise background',
  attachments: ['file-body'],
}

export const expectedStory14AuditEvents = [
  'thinktank.access.opened',
  'thinktank.access.denied',
  'thinktank.module.enabled',
  'thinktank.module.disabled',
  'thinktank.role_access.updated',
  'thinktank.workflow.started',
  'thinktank.workflow.start_failed',
  'thinktank.workflow.completed',
  'thinktank.quick_consult.started',
  'thinktank.quick_consult.completed',
  'thinktank.quick_consult.failed',
  'thinktank.output.exported',
  'thinktank.session.deleted',
  'thinktank.output.deleted',
] as const

export const expectedStory14TelemetryEvents = [
  'thinktank.provider.call_completed',
  'thinktank.provider.call_failed',
  'thinktank.provider.call_retried',
  'thinktank.prompt_cache.hit',
  'thinktank.prompt_cache.miss',
  'thinktank.recommendation.feedback_submitted',
  'thinktank.output.rating_submitted',
  'thinktank.output.favorite_updated',
  'thinktank.context_compression.executed',
  'thinktank.context_compression.deferred',
  'thinktank.party_mode.budget_exceeded',
  'thinktank.party_mode.advisor_failed',
] as const
