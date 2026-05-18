export const story15TenantId = '660e8400-e29b-41d4-a716-446655440015'
export const story15ActorId = '770e8400-e29b-41d4-a716-446655440015'
export const story15SubjectId = 'provider-call-smoke'
export const story15CorrelationId = '880e8400-e29b-41d4-a716-446655440015'

export const story15GatewayRequest = {
  tenantId: story15TenantId,
  actorId: story15ActorId,
  subjectId: story15SubjectId,
  correlationId: story15CorrelationId,
  provider: 'fake',
  model: 'glm-5.1',
  system: 'You are a ThinkTank advisor smoke test.',
  messages: [
    {
      role: 'user',
      content: 'Return the deterministic provider gateway smoke response.',
    },
  ],
  maxTokens: 256,
  temperature: 0.2,
  metadata: {
    workflow_type: 'provider_gateway_smoke',
    smoke: true,
  },
} as const

export const story15DeterministicResponse = {
  id: 'fake-provider-call-0001',
  provider: 'fake',
  model: 'fake-thinktank-smoke',
  content: 'ThinkTank fake provider smoke response.',
  status: 'completed',
  usage: {
    inputTokens: 12,
    outputTokens: 7,
    totalTokens: 19,
  },
  estimatedCost: 0,
  finishReason: 'stop',
} as const

export const story15StreamChunks = [
  { index: 0, delta: 'ThinkTank ', done: false },
  { index: 1, delta: 'fake provider ', done: false },
  {
    index: 2,
    delta: 'stream.',
    done: true,
    usage: story15DeterministicResponse.usage,
    estimatedCost: story15DeterministicResponse.estimatedCost,
  },
] as const

export const story15RetryableFailure = {
  code: 'FAKE_RATE_LIMIT',
  category: 'provider',
  provider: 'fake',
  status: 'failed',
  retryable: true,
  message: 'Fake provider retryable failure',
} as const

export const story15TimeoutFailure = {
  code: 'THINKTANK_PROVIDER_TIMEOUT',
  category: 'timeout',
  provider: 'fake',
  status: 'timeout',
  retryable: true,
  message: 'Provider call timed out',
} as const

export const story15ExpectedCompletedTelemetry = {
  event_name: 'thinktank.provider.call_completed',
  tenant_id: story15TenantId,
  actor_id: story15ActorId,
  subject_type: 'provider_call',
  subject_id: story15SubjectId,
  outcome: 'success',
  correlation_id: story15CorrelationId,
  privacy_classification: 'operational',
  provider: 'fake',
  status: 'completed',
  estimated_tokens: 19,
  estimated_cost: 0,
} as const

export const story15ExpectedFailedTelemetry = {
  event_name: 'thinktank.provider.call_failed',
  tenant_id: story15TenantId,
  actor_id: story15ActorId,
  subject_type: 'provider_call',
  subject_id: story15SubjectId,
  outcome: 'failure',
  correlation_id: story15CorrelationId,
  privacy_classification: 'operational',
  provider: 'fake',
  status: 'timeout',
  error_category: 'timeout',
  estimated_cost: 0,
} as const

export const story15ExpectedRetriedTelemetry = {
  event_name: 'thinktank.provider.call_retried',
  tenant_id: story15TenantId,
  actor_id: story15ActorId,
  subject_type: 'provider_call',
  subject_id: story15SubjectId,
  outcome: 'failure',
  correlation_id: story15CorrelationId,
  privacy_classification: 'operational',
  provider: 'fake',
  retry_attempt: 1,
  error_category: 'provider',
} as const

export const story15RawSensitiveKeys = [
  'conversation',
  'message',
  'messages',
  'prompt',
  'content',
  'rawContent',
  'report',
  'document',
  'enterpriseContext',
  'attachments',
] as const

export const story15SafeTestEnv = {
  THINKTANK_PROVIDER_MODE: 'fake',
  NODE_ENV: 'test',
  GLM_API_KEY: undefined,
  ANTHROPIC_API_KEY: undefined,
} as const
