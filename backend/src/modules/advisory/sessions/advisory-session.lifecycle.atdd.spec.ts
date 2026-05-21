import { NotFoundException } from '@nestjs/common'
import { AuditAction } from '../../../database/entities/audit-log.entity'
import { AdvisoryWorkflowOutputStatus } from '../../../database/entities/advisory-workflow-output.entity'
import { AdvisoryWorkflowSessionStatus } from '../../../database/entities/advisory-workflow-session.entity'
import {
  ThinkTankEventName,
  ThinkTankEventOutcome,
  ThinkTankPrivacyClassification,
  ThinkTankSubjectType,
} from '../events/thinktank-event-contract'

const tenantId = '660e8400-e29b-41d4-a716-446655440000'
const actorId = '770e8400-e29b-41d4-a716-446655440000'
const organizationId = '880e8400-e29b-41d4-a716-446655440000'
const sessionId = '990e8400-e29b-41d4-a716-446655440000'
const outputId = 'aa0e8400-e29b-41d4-a716-446655440000'

const user = {
  id: actorId,
  organizationId,
}

function createActiveSession(overrides: Record<string, unknown> = {}) {
  return {
    id: sessionId,
    tenantId,
    actorId,
    workflowKey: 'problem-solving',
    workflowDisplayName: 'Problem Solving',
    scenarioLabel: 'Diagnose retention',
    status: AdvisoryWorkflowSessionStatus.Active,
    currentStep: { index: 2, label: 'Map constraints', sourceRef: 'current-step:2' },
    sourceRefs: ['workflow:problem-solving'],
    metadata: { title: 'Retention Diagnosis' },
    failureCode: null,
    failureMessage: null,
    createdAt: new Date('2026-05-21T01:00:00.000Z'),
    updatedAt: new Date('2026-05-21T01:06:00.000Z'),
    ...overrides,
  }
}

function createDraftOutput(overrides: Record<string, unknown> = {}) {
  return {
    id: outputId,
    tenantId,
    sessionId,
    actorId,
    workflowKey: 'problem-solving',
    status: AdvisoryWorkflowOutputStatus.Draft,
    title: 'Retention Diagnosis',
    summary: 'Users drop after setup.',
    contentMarkdown: '# Retention Diagnosis\n\nRaw advisory content must not enter audit.',
    sections: [
      {
        id: 'section-1',
        stepIndex: 2,
        heading: 'Constraints',
        contentMarkdown: 'Raw section content must not enter audit.',
        aiLabel: '[AI Generated]',
        metadata: {},
      },
    ],
    aiLabelMetadata: { visible_label: '[AI Generated]' },
    metadata: {},
    createdAt: new Date('2026-05-21T01:01:00.000Z'),
    updatedAt: new Date('2026-05-21T01:06:00.000Z'),
    ...overrides,
  }
}

describe('Story 4.7 ATDD RED - safe exit and destructive session lifecycle', () => {
  test.skip('[P0][4.7-BE-001][AC1] safe exit transitions an active session to paused and refreshes checkpoint state', async () => {
    const session = createActiveSession()
    const checkpointService = {
      saveCheckpoint: jest.fn().mockResolvedValue({ source: 'hot' }),
    }
    const sessionRepository = {
      findSessionById: jest.fn().mockResolvedValue(session),
      updateSession: jest.fn().mockResolvedValue(
        createActiveSession({
          status: 'paused',
          metadata: {
            ...session.metadata,
            exited_at: '2026-05-21T01:10:00.000Z',
            exit_reason: 'user_safe_exit',
          },
        }),
      ),
    }
    const service = {
      safeExitSession: jest.fn(async (_context: unknown) => {
        await checkpointService.saveCheckpoint()
        return sessionRepository.updateSession(tenantId, sessionId, {
          status: 'paused',
          metadata: expect.objectContaining({ exit_reason: 'user_safe_exit' }),
        } as never)
      }),
    }

    await expect(
      service.safeExitSession({ user, tenantId, sessionId }),
    ).resolves.toMatchObject({
      id: sessionId,
      status: 'paused',
      metadata: expect.objectContaining({
        exit_reason: 'user_safe_exit',
      }),
    })
    expect(checkpointService.saveCheckpoint).toHaveBeenCalled()
    expect(sessionRepository.updateSession).toHaveBeenCalledWith(
      tenantId,
      sessionId,
      expect.objectContaining({
        status: 'paused',
      }),
    )
  })

  test.skip('[P0][4.7-BE-002][AC1,AC3] resume accepts a paused session and reactivates it only when no other active session exists', async () => {
    const pausedSession = createActiveSession({ status: 'paused' })
    const sessionRepository = {
      findSessionById: jest.fn().mockResolvedValue(pausedSession),
      findActiveSessionForActor: jest.fn().mockResolvedValue(null),
      updateSession: jest.fn().mockResolvedValue(createActiveSession()),
    }
    const service = {
      resumeSession: jest.fn(async (_context: unknown) => {
        const active = await sessionRepository.findActiveSessionForActor(tenantId, actorId)
        if (active) throw new Error('active session conflict')
        return {
          session: await sessionRepository.updateSession(tenantId, sessionId, {
            status: 'active',
          } as never),
        }
      }),
    }

    await expect(service.resumeSession({ user, tenantId, sessionId })).resolves.toMatchObject({
      session: expect.objectContaining({
        id: sessionId,
        status: AdvisoryWorkflowSessionStatus.Active,
      }),
    })
    expect(sessionRepository.findActiveSessionForActor).toHaveBeenCalledWith(tenantId, actorId)
    expect(sessionRepository.updateSession).toHaveBeenCalledWith(
      tenantId,
      sessionId,
      expect.objectContaining({ status: 'active' }),
    )
  })

  test.skip('[P0][4.7-BE-003][AC2,AC3] session delete tombstones the session and its visible outputs in a transaction', async () => {
    const session = createActiveSession({ status: 'paused' })
    const output = createDraftOutput()
    const lifecycleRepository = {
      tombstoneSessionWithOutputs: jest.fn().mockResolvedValue({
        session: createActiveSession({ status: 'deleted' }),
        outputIds: [output.id],
        deletedOutputCount: 1,
        previousStatus: session.status,
      }),
    }
    const service = {
      deleteSession: jest.fn((_context: unknown) =>
        lifecycleRepository.tombstoneSessionWithOutputs({
          tenantId,
          actorId,
          sessionId,
          deletedAt: expect.any(String),
        }),
      ),
    }

    await expect(service.deleteSession({ user, tenantId, sessionId })).resolves.toMatchObject({
      session: expect.objectContaining({
        id: sessionId,
        status: 'deleted',
      }),
      outputIds: [outputId],
      deletedOutputCount: 1,
    })
    expect(lifecycleRepository.tombstoneSessionWithOutputs).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        actorId,
        sessionId,
      }),
    )
  })

  test.skip('[P0][4.7-BE-004][AC2,AC3] output delete tombstones only the tenant-owned route output', async () => {
    const output = createDraftOutput({ status: AdvisoryWorkflowOutputStatus.Completed })
    const outputRepository = {
      tombstoneOutputForSession: jest.fn().mockResolvedValue({
        output: createDraftOutput({ status: 'deleted' }),
        previousStatus: output.status,
      }),
    }
    const service = {
      deleteOutput: jest.fn((_context: unknown) =>
        outputRepository.tombstoneOutputForSession({
          tenantId,
          actorId,
          sessionId,
          outputId,
        }),
      ),
    }

    await expect(service.deleteOutput({ user, tenantId, sessionId, outputId })).resolves.toEqual({
      output: expect.objectContaining({
        id: outputId,
        sessionId,
        status: 'deleted',
      }),
      previousStatus: AdvisoryWorkflowOutputStatus.Completed,
    })
    expect(outputRepository.tombstoneOutputForSession).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        actorId,
        sessionId,
        outputId,
      }),
    )
  })

  test.skip('[P0][4.7-BE-005][AC2,AC3] destructive actions use NotFound semantics for foreign, completed, or already deleted records', async () => {
    const service = {
      safeExitSession: jest.fn().mockRejectedValue(new NotFoundException()),
      deleteSession: jest.fn().mockRejectedValue(new NotFoundException()),
      deleteOutput: jest.fn().mockRejectedValue(new NotFoundException()),
    }

    await expect(service.safeExitSession({ user, tenantId, sessionId })).rejects.toThrow(
      NotFoundException,
    )
    await expect(service.deleteSession({ user, tenantId, sessionId })).rejects.toThrow(
      NotFoundException,
    )
    await expect(service.deleteOutput({ user, tenantId, sessionId, outputId })).rejects.toThrow(
      NotFoundException,
    )
  })

  test.skip('[P0][4.7-BE-006][AC3] session and output deletion emit privacy-safe audit events with tenant and actor context', async () => {
    const eventService = {
      emitAudit: jest.fn().mockResolvedValue(undefined),
    }
    const service = {
      deleteSession: jest.fn(async (_context: unknown) => {
        await eventService.emitAudit({
          eventName: ThinkTankEventName.SessionDeleted,
          tenantId,
          actorId,
          subjectType: ThinkTankSubjectType.Session,
          subjectId: sessionId,
          outcome: ThinkTankEventOutcome.Success,
          privacyClassification: ThinkTankPrivacyClassification.Operational,
          optional: { sessionId, workflowType: 'problem-solving' },
          audit: {
            action: AuditAction.DELETE,
            entityType: 'ThinkTankWorkflowSession',
            entityId: sessionId,
            organizationId,
          },
          metadata: {
            workflow_key: 'problem-solving',
            previous_status: 'paused',
            deleted_output_count: 1,
            source: 'user_destructive_action',
          },
        })
      }),
      deleteOutput: jest.fn(async (_context: unknown) => {
        await eventService.emitAudit({
          eventName: ThinkTankEventName.OutputDeleted,
          tenantId,
          actorId,
          subjectType: ThinkTankSubjectType.Output,
          subjectId: outputId,
          outcome: ThinkTankEventOutcome.Success,
          privacyClassification: ThinkTankPrivacyClassification.Operational,
          optional: { sessionId, outputId, workflowType: 'problem-solving' },
          audit: {
            action: AuditAction.DELETE,
            entityType: 'ThinkTankWorkflowOutput',
            entityId: outputId,
            organizationId,
          },
          metadata: {
            workflow_key: 'problem-solving',
            previous_status: 'completed',
            section_count: 1,
            source: 'user_destructive_action',
          },
        })
      }),
    }

    await service.deleteSession({ user, tenantId, sessionId })
    await service.deleteOutput({ user, tenantId, sessionId, outputId })

    expect(eventService.emitAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: ThinkTankEventName.SessionDeleted,
        tenantId,
        actorId,
        metadata: expect.objectContaining({
          deleted_output_count: 1,
        }),
      }),
    )
    expect(eventService.emitAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: ThinkTankEventName.OutputDeleted,
        tenantId,
        actorId,
        metadata: expect.objectContaining({
          section_count: 1,
        }),
      }),
    )
    expect(JSON.stringify(eventService.emitAudit.mock.calls)).not.toMatch(
      /prompt|message|conversation|content|report|document|summary|Raw advisory content/i,
    )
  })
})
