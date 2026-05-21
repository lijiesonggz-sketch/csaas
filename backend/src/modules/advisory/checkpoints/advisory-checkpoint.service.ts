import { Inject, Injectable, OnModuleDestroy, Optional } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { randomUUID } from 'crypto'
import Redis from 'ioredis'
import {
  AdvisoryCheckpointConversationState,
  AdvisoryCheckpointCurrentStep,
  AdvisoryCheckpointDocumentState,
  AdvisoryCheckpointStateSnapshot,
  AdvisoryWorkflowCheckpoint,
} from '../../../database/entities/advisory-workflow-checkpoint.entity'
import { AdvisoryEventService } from '../events/advisory-event.service'
import {
  ThinkTankErrorCategory,
  ThinkTankEventName,
  ThinkTankEventOutcome,
  ThinkTankPrivacyClassification,
  ThinkTankSubjectType,
} from '../events/thinktank-event-contract'
import { AdvisoryWorkflowCheckpointRepository } from './advisory-workflow-checkpoint.repository'

export const ADVISORY_CHECKPOINT_HOT_STORE = Symbol('ADVISORY_CHECKPOINT_HOT_STORE')
export const THINKTANK_CHECKPOINT_TTL_SECONDS = 60 * 60 * 4
export const THINKTANK_CHECKPOINT_IO_TIMEOUT_MS = 750
export const THINKTANK_CHECKPOINT_WARNING_CODE = 'THINKTANK_CHECKPOINT_PERSISTENCE_DEGRADED'

export interface AdvisoryCheckpointHotStore {
  writeHash(key: string, fields: Record<string, string>, ttlSeconds: number): Promise<void>
  readHash(key: string): Promise<Record<string, string> | null>
}

export type AdvisoryCheckpointPersistenceErrorCategory =
  | 'hot_store'
  | 'cold_archive'
  | 'hot_and_cold_checkpoint_failed'
  | 'corrupted_hot_state'

export interface AdvisoryCheckpointWarning {
  code: typeof THINKTANK_CHECKPOINT_WARNING_CODE
  errorCategory: AdvisoryCheckpointPersistenceErrorCategory
  recoveryGuidance: string
}

export interface AdvisoryCheckpointSaveInput {
  tenantId: string
  actorId: string
  sessionId: string
  workflowKey: string
  workflowType: string
  currentStep: AdvisoryCheckpointCurrentStep
  conversation: AdvisoryCheckpointConversationState
  documentState: AdvisoryCheckpointDocumentState
  lastActivityAt?: string | Date
  metadata?: Record<string, unknown>
}

export interface AdvisoryCheckpointSaveResult {
  checkpointWarning?: AdvisoryCheckpointWarning
}

export interface AdvisoryCheckpointRestoreInput {
  tenantId: string
  sessionId: string
}

export interface AdvisoryCheckpointRestoreResult {
  source: 'hot' | 'cold' | null
  state: AdvisoryCheckpointStateSnapshot | null
  checkpointWarning?: AdvisoryCheckpointWarning
}

const SENSITIVE_CHECKPOINT_KEYS = new Set([
  'content',
  'contentmarkdown',
  'conversationhistory',
  'fullreportcontent',
  'hiddenruntimesource',
  'messagecontent',
  'messages',
  'prompt',
  'providerpayload',
  'providerrequest',
  'providerresponse',
  'rawcontent',
  'rawprompt',
  'rawreportcontent',
  'reportcontent',
  'runtimesource',
  'systemprompt',
])

export function createAdvisoryCheckpointHotKey(tenantId: string, sessionId: string): string {
  return `thinktank:${tenantId}:session:${sessionId}`
}

@Injectable()
export class IORedisAdvisoryCheckpointHotStore
  implements AdvisoryCheckpointHotStore, OnModuleDestroy
{
  private client?: Redis

  constructor(private readonly configService: ConfigService) {}

  async writeHash(key: string, fields: Record<string, string>, ttlSeconds: number): Promise<void> {
    const client = await this.getReadyClient()
    const results = await client.multi().hset(key, fields).expire(key, ttlSeconds).exec()
    const failedCommand = results?.find(([error]) => error)
    if (failedCommand?.[0]) {
      throw failedCommand[0]
    }
  }

  async readHash(key: string): Promise<Record<string, string> | null> {
    const fields = await this.getReadyClient().then((client) => client.hgetall(key))
    return Object.keys(fields).length > 0 ? fields : null
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client) return
    await this.client.quit().catch(() => undefined)
  }

  private getClient(): Redis {
    if (!this.client) {
      this.client = new Redis({
        host: this.configService.get('REDIS_HOST', 'localhost'),
        port: Number(this.configService.get('REDIS_PORT', 6379)),
        password: this.configService.get('REDIS_PASSWORD') || undefined,
        db: Number(this.configService.get('REDIS_DB', 0)),
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
      })
    }

    return this.client
  }

  private async getReadyClient(): Promise<Redis> {
    const client = this.getClient()
    if (client.status === 'ready') return client

    if (client.status === 'wait' || client.status === 'end') {
      await this.withTimeout(client.connect())
      return client
    }

    await this.withTimeout(
      new Promise<void>((resolve, reject) => {
        const onReady = () => {
          cleanup()
          resolve()
        }
        const onError = (error: Error) => {
          cleanup()
          reject(error)
        }
        const cleanup = () => {
          client.off('ready', onReady)
          client.off('error', onError)
        }

        client.once('ready', onReady)
        client.once('error', onError)
      }),
    )

    return client
  }

  private async withTimeout<T>(promise: Promise<T>): Promise<T> {
    let timer: NodeJS.Timeout | undefined
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('Redis checkpoint operation timed out')),
            THINKTANK_CHECKPOINT_IO_TIMEOUT_MS,
          )
        }),
      ])
    } finally {
      if (timer) clearTimeout(timer)
    }
  }
}

@Injectable()
export class AdvisoryCheckpointService {
  constructor(
    @Inject(ADVISORY_CHECKPOINT_HOT_STORE)
    @Optional()
    private readonly hotStore?: AdvisoryCheckpointHotStore,
    @Optional()
    private readonly checkpointRepository?: AdvisoryWorkflowCheckpointRepository,
    @Optional()
    private readonly eventService?: AdvisoryEventService,
  ) {}

  async saveCheckpoint(input: AdvisoryCheckpointSaveInput): Promise<AdvisoryCheckpointSaveResult> {
    const checkpointId = randomUUID()
    const snapshot = this.createSanitizedSnapshot({
      ...input,
      metadata: {
        ...(input.metadata ?? {}),
        checkpoint_id: checkpointId,
      },
    })
    const key = createAdvisoryCheckpointHotKey(snapshot.tenantId, snapshot.sessionId)
    const checkpointType = this.readCheckpointType(snapshot.metadata)
    const hotTask = this.hotStore
      ? this.hotStore.writeHash(
          key,
          this.toHotFields(snapshot, checkpointId, checkpointType),
          THINKTANK_CHECKPOINT_TTL_SECONDS,
        )
      : Promise.reject(new Error('Checkpoint hot store is not configured'))
    const coldTask = this.checkpointRepository
      ? this.archiveColdCheckpoint(snapshot, checkpointType)
      : Promise.reject(new Error('Checkpoint repository is not configured'))

    const [hotResult, coldResult] = await Promise.all([
      this.observeCheckpointTask(hotTask),
      this.observeCheckpointTask(coldTask, () =>
        this.recordCheckpointFailure('save', input, this.createWarning('cold_archive')).catch(
          () => undefined,
        ),
      ),
    ])
    const checkpointWarning = this.warningFromSaveFailures(
      hotResult !== 'fulfilled',
      coldResult !== 'fulfilled',
    )
    if (checkpointWarning) {
      await this.recordCheckpointFailure('save', input, checkpointWarning).catch(() => undefined)
      return { checkpointWarning }
    }

    return {}
  }

  async restoreCheckpoint(
    input: AdvisoryCheckpointRestoreInput,
  ): Promise<AdvisoryCheckpointRestoreResult> {
    let checkpointWarning: AdvisoryCheckpointWarning | undefined

    try {
      const hotState = await this.readHotCheckpoint(input)
      if (hotState) {
        return {
          source: 'hot',
          state: hotState,
        }
      }
    } catch {
      checkpointWarning = this.createWarning('corrupted_hot_state')
      await this.recordCheckpointFailure(
        'restore',
        {
          tenantId: input.tenantId,
          actorId: 'system',
          sessionId: input.sessionId,
          workflowKey: 'unknown',
        },
        checkpointWarning,
      ).catch(() => undefined)
    }

    const coldCheckpoint = await this.checkpointRepository?.findLatestCheckpoint(
      input.tenantId,
      input.sessionId,
    )

    if (coldCheckpoint) {
      return {
        source: 'cold',
        state: this.toStateSnapshot(coldCheckpoint),
        ...(checkpointWarning ? { checkpointWarning } : {}),
      }
    }

    return {
      source: null,
      state: null,
      ...(checkpointWarning ? { checkpointWarning } : {}),
    }
  }

  private async readHotCheckpoint(
    input: AdvisoryCheckpointRestoreInput,
  ): Promise<AdvisoryCheckpointStateSnapshot | null> {
    if (!this.hotStore) return null

    const fields = await this.hotStore.readHash(
      createAdvisoryCheckpointHotKey(input.tenantId, input.sessionId),
    )
    if (!fields) return null
    if (fields.tenant_id !== input.tenantId || fields.session_id !== input.sessionId) {
      throw new Error('Checkpoint tenant/session mismatch')
    }

    const snapshot = JSON.parse(fields.state_snapshot) as AdvisoryCheckpointStateSnapshot
    if (snapshot.tenantId !== input.tenantId || snapshot.sessionId !== input.sessionId) {
      throw new Error('Checkpoint snapshot tenant/session mismatch')
    }

    return this.createSanitizedSnapshot(snapshot)
  }

  private warningFromSaveFailures(
    hotFailed: boolean,
    coldFailed: boolean,
  ): AdvisoryCheckpointWarning | undefined {
    if (hotFailed && coldFailed) return this.createWarning('hot_and_cold_checkpoint_failed')
    if (hotFailed) return this.createWarning('hot_store')
    if (coldFailed) return this.createWarning('cold_archive')
    return undefined
  }

  private createWarning(
    errorCategory: AdvisoryCheckpointPersistenceErrorCategory,
  ): AdvisoryCheckpointWarning {
    return {
      code: THINKTANK_CHECKPOINT_WARNING_CODE,
      errorCategory,
      recoveryGuidance:
        'Your current action succeeded, but workflow progress recovery may be degraded. Continue working; if you leave now, reopen the latest saved session state.',
    }
  }

  private createSanitizedSnapshot(
    input: AdvisoryCheckpointSaveInput | AdvisoryCheckpointStateSnapshot,
  ): AdvisoryCheckpointStateSnapshot {
    const lastActivityAt = this.normalizeLastActivity(input.lastActivityAt)

    return {
      tenantId: input.tenantId,
      actorId: input.actorId,
      sessionId: input.sessionId,
      workflowKey: input.workflowKey,
      workflowType: input.workflowType,
      currentStep: this.sanitizeValue(input.currentStep) as AdvisoryCheckpointCurrentStep,
      conversation: this.sanitizeValue(input.conversation) as AdvisoryCheckpointConversationState,
      documentState: this.sanitizeValue(input.documentState) as AdvisoryCheckpointDocumentState,
      lastActivityAt,
      metadata: this.sanitizeValue(input.metadata ?? {}) as Record<string, unknown>,
    }
  }

  private toHotFields(
    snapshot: AdvisoryCheckpointStateSnapshot,
    checkpointId: string,
    checkpointType: string,
  ): Record<string, string> {
    return {
      checkpoint_id: checkpointId,
      checkpoint_type: checkpointType,
      tenant_id: snapshot.tenantId,
      session_id: snapshot.sessionId,
      actor_id: snapshot.actorId,
      workflow_key: snapshot.workflowKey,
      workflow_type: snapshot.workflowType,
      current_step: JSON.stringify(snapshot.currentStep),
      conversation_state: JSON.stringify(snapshot.conversation),
      conversation: JSON.stringify(snapshot.conversation),
      document_state: JSON.stringify(snapshot.documentState),
      state_snapshot: JSON.stringify(snapshot),
      last_activity: snapshot.lastActivityAt,
      last_activity_at: snapshot.lastActivityAt,
      archival_status: 'pending',
    }
  }

  private async archiveColdCheckpoint(
    snapshot: AdvisoryCheckpointStateSnapshot,
    checkpointType: string,
  ): Promise<void> {
    await this.checkpointRepository?.archiveCheckpoint(snapshot.tenantId, {
      sessionId: snapshot.sessionId,
      actorId: snapshot.actorId,
      workflowKey: snapshot.workflowKey,
      workflowType: snapshot.workflowType,
      stepIndex: snapshot.currentStep.index,
      checkpointType,
      currentStep: snapshot.currentStep,
      conversationState: snapshot.conversation,
      documentState: snapshot.documentState,
      stateSnapshot: snapshot,
      summary: this.readCheckpointSummary(snapshot),
      metadata: snapshot.metadata ?? {},
      lastActivityAt: new Date(snapshot.lastActivityAt),
    })
  }

  private async observeCheckpointTask<T>(
    promise: Promise<T>,
    onLateReject?: () => void | Promise<void>,
  ): Promise<'fulfilled' | 'failed' | 'timeout'> {
    try {
      await this.withCheckpointTimeout(promise)
      return 'fulfilled'
    } catch (error) {
      if (error instanceof Error && error.message === 'Checkpoint operation timed out') {
        promise.catch(() => {
          void onLateReject?.()
        })
        return 'timeout'
      }

      return 'failed'
    }
  }

  private async withCheckpointTimeout<T>(promise: Promise<T>): Promise<T> {
    let timer: NodeJS.Timeout | undefined
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('Checkpoint operation timed out')),
            THINKTANK_CHECKPOINT_IO_TIMEOUT_MS,
          )
        }),
      ])
    } finally {
      if (timer) clearTimeout(timer)
    }
  }

  private toStateSnapshot(checkpoint: AdvisoryWorkflowCheckpoint): AdvisoryCheckpointStateSnapshot {
    const snapshot = checkpoint.stateSnapshot
    if (this.isUsableColdSnapshot(checkpoint, snapshot)) {
      return this.createSanitizedSnapshot(snapshot)
    }

    return this.createSanitizedSnapshot({
      tenantId: checkpoint.tenantId,
      actorId: checkpoint.actorId,
      sessionId: checkpoint.sessionId,
      workflowKey: checkpoint.workflowKey,
      workflowType: checkpoint.workflowType,
      currentStep: checkpoint.currentStep,
      conversation: checkpoint.conversationState,
      documentState: checkpoint.documentState,
      lastActivityAt: checkpoint.lastActivityAt.toISOString(),
      metadata: checkpoint.metadata ?? {},
    })
  }

  private isUsableColdSnapshot(
    checkpoint: AdvisoryWorkflowCheckpoint,
    snapshot: AdvisoryCheckpointStateSnapshot | null | undefined,
  ): snapshot is AdvisoryCheckpointStateSnapshot {
    return (
      !!snapshot &&
      snapshot.tenantId === checkpoint.tenantId &&
      snapshot.actorId === checkpoint.actorId &&
      snapshot.sessionId === checkpoint.sessionId &&
      snapshot.workflowKey === checkpoint.workflowKey &&
      snapshot.workflowType === checkpoint.workflowType &&
      typeof snapshot.currentStep?.index === 'number' &&
      snapshot.currentStep.index === checkpoint.stepIndex &&
      typeof snapshot.currentStep.label === 'string' &&
      typeof snapshot.conversation?.messageCount === 'number' &&
      typeof snapshot.conversation.historyPointer === 'string' &&
      typeof snapshot.documentState?.sectionCount === 'number' &&
      typeof snapshot.lastActivityAt === 'string' &&
      !Number.isNaN(new Date(snapshot.lastActivityAt).getTime())
    )
  }

  private sanitizeValue(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeValue(item))
    }

    if (!value || typeof value !== 'object') {
      return value
    }

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !SENSITIVE_CHECKPOINT_KEYS.has(normalizeCheckpointKey(key)))
        .map(([key, child]) => [key, this.sanitizeValue(child)]),
    )
  }

  private normalizeLastActivity(value: string | Date | undefined): string {
    if (value instanceof Date) return value.toISOString()
    if (typeof value === 'string' && value.trim()) {
      const parsed = new Date(value)
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString()
      }
    }

    return new Date().toISOString()
  }

  private readCheckpointType(metadata?: Record<string, unknown>): string {
    const value = metadata?.checkpointReason ?? metadata?.checkpoint_reason
    if (typeof value === 'string' && /^[a-z0-9_-]{1,64}$/i.test(value.trim())) {
      return value.trim()
    }

    return 'automatic'
  }

  private readCheckpointSummary(snapshot: AdvisoryCheckpointStateSnapshot): string {
    const summary = snapshot.documentState.summary
    if (typeof summary === 'string' && summary.trim()) {
      return summary.trim().slice(0, 1000)
    }

    return [
      snapshot.workflowType,
      `step ${snapshot.currentStep.index}`,
      `${snapshot.conversation.messageCount} messages`,
      `${snapshot.documentState.sectionCount} sections`,
    ].join(' | ')
  }

  private async recordCheckpointFailure(
    operation: 'save' | 'restore',
    input: Pick<AdvisoryCheckpointSaveInput, 'tenantId' | 'actorId' | 'sessionId' | 'workflowKey'>,
    warning: AdvisoryCheckpointWarning,
  ): Promise<void> {
    await this.eventService?.emitTelemetry({
      eventName: ThinkTankEventName.CheckpointPersistenceFailed,
      tenantId: input.tenantId,
      actorId: input.actorId,
      subjectType: ThinkTankSubjectType.Session,
      subjectId: input.sessionId,
      outcome: ThinkTankEventOutcome.Partial,
      privacyClassification: ThinkTankPrivacyClassification.Operational,
      optional: {
        sessionId: input.sessionId,
        workflowType: input.workflowKey,
        errorCategory: ThinkTankErrorCategory.Unknown,
      },
      metadata: {
        checkpoint_error_category: warning.errorCategory,
        checkpoint_operation: operation,
        recovery_guidance: warning.recoveryGuidance,
      },
      telemetry: {
        entityType: 'ThinkTankWorkflowCheckpoint',
      },
    })
  }
}

function normalizeCheckpointKey(value: string): string {
  return value.replace(/[-_\s]/g, '').toLowerCase()
}
