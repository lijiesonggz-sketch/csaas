import { BadRequestException, NotFoundException } from '@nestjs/common'
import { AuditAction } from '../../../database/entities/audit-log.entity'
import {
  AdvisoryWorkflowOutput,
  AdvisoryWorkflowOutputStatus,
} from '../../../database/entities/advisory-workflow-output.entity'
import { AdvisoryWorkflowSessionStatus } from '../../../database/entities/advisory-workflow-session.entity'
import { UserRole } from '../../../database/entities/user.entity'
import { AdvisoryAccessService } from '../access/advisory-access.service'
import { AdvisoryEventService } from '../events/advisory-event.service'
import {
  ThinkTankEventName,
  ThinkTankEventOutcome,
  ThinkTankPrivacyClassification,
  ThinkTankSubjectType,
} from '../events/thinktank-event-contract'
import { AdvisorySessionRepository } from '../sessions/advisory-session.repository'
import { AdvisoryOutputExportService } from './advisory-output-export.service'
import { AdvisoryOutputPdfRendererService } from './advisory-output-pdf-renderer.service'
import { AdvisoryWorkflowOutputRepository } from './advisory-workflow-output.repository'

const tenantId = '660e8400-e29b-41d4-a716-446655440000'
const actorId = '770e8400-e29b-41d4-a716-446655440000'
const sessionId = '550e8400-e29b-41d4-a716-446655440000'
const organizationId = '880e8400-e29b-41d4-a716-446655440000'
const outputId = '990e8400-e29b-41d4-a716-446655440000'

const user = {
  id: actorId,
  role: UserRole.CONSULTANT,
  organizationId,
}

const activeSession = {
  id: sessionId,
  tenantId,
  actorId,
  workflowKey: 'problem-solving',
  workflowDisplayName: 'Problem Solving',
  scenarioLabel: 'Systematic diagnosis and solution design',
  status: AdvisoryWorkflowSessionStatus.Active,
  currentStep: { index: 2, label: 'Solution design', sourceRef: 'current-step:2' },
  sourceRefs: ['workflow:problem-solving', 'current-step:2'],
  metadata: { workflow_key: 'problem-solving' },
  failureCode: null,
  failureMessage: null,
  createdAt: new Date('2026-05-20T00:00:00.000Z'),
  updatedAt: new Date('2026-05-20T00:00:00.000Z'),
}

function createOutput(overrides: Partial<AdvisoryWorkflowOutput> = {}): AdvisoryWorkflowOutput {
  return {
    id: outputId,
    tenantId,
    sessionId,
    actorId,
    workflowKey: 'problem-solving',
    status: AdvisoryWorkflowOutputStatus.Draft,
    title: 'Problem Solving Report Draft',
    summary: 'Live report draft for the problem-solving workflow.',
    contentMarkdown: '',
    sections: [
      {
        id: 'section-1',
        stepIndex: 1,
        heading: '诊断与机会',
        contentMarkdown:
          '[AI Generated]\n\n## 诊断与机会\n\n<script>alert("x")</script>优先验证企业客户预算触发点。',
        aiLabel: '[AI Generated]',
        metadata: {
          '@context': 'https://schema.org',
          '@type': 'CreativeWork',
          ai_generated: true,
          machine_readable: true,
          step_label: '诊断与机会',
          provider: 'openai',
          model: 'gpt-4o-mini',
          generated_at: '2026-05-20T00:01:00.000Z',
        },
        createdAt: '2026-05-20T00:01:00.000Z',
      },
    ],
    aiLabelMetadata: {
      visible_label: '[AI Generated]',
      ai_generated: true,
      machine_readable: true,
      source_session_id: sessionId,
      workflow_key: 'problem-solving',
      generated_at: '2026-05-20T00:00:00.000Z',
    },
    metadata: {
      section_count: 1,
      last_step_index: 1,
    },
    createdAt: new Date('2026-05-20T00:00:00.000Z'),
    updatedAt: new Date('2026-05-20T00:00:00.000Z'),
    ...overrides,
  }
}

/*
 * Provider endpoint: backend/src/modules/advisory/sessions/advisory-session.controller.ts
 * Expected route: GET /advisory/sessions/:sessionId/output/export?format=markdown|pdf
 * Provider scrutiny evidence:
 * - Status: 200 for supported export, 400 for unsupported/empty/missing AI label, 404 for tenant/session misses.
 * - Response: binary/text payload with Content-Type and Content-Disposition headers, not a JSON data wrapper.
 * - Required fields: tenant, actor, session id from guards; format from query only; report body never accepted from caller.
 * - Audit: thinktank.output.exported after payload generation, privacy-safe metadata only.
 */
describe('AdvisoryOutputExportService (ATDD RED)', () => {
  let accessService: jest.Mocked<Pick<AdvisoryAccessService, 'assertThinkTankModuleAvailable'>>
  let sessionRepository: jest.Mocked<Pick<AdvisorySessionRepository, 'findSessionById'>>
  let outputRepository: jest.Mocked<
    Pick<
      AdvisoryWorkflowOutputRepository,
      'findActiveDraftForSession' | 'findLatestCompletedForSession' | 'createDraft'
    >
  >
  let eventService: jest.Mocked<Pick<AdvisoryEventService, 'emitAuditStrict'>>

  beforeEach(() => {
    accessService = {
      assertThinkTankModuleAvailable: jest.fn().mockResolvedValue(undefined),
    }
    sessionRepository = {
      findSessionById: jest.fn().mockResolvedValue(activeSession),
    }
    outputRepository = {
      findActiveDraftForSession: jest.fn().mockResolvedValue(createOutput()),
      findLatestCompletedForSession: jest.fn().mockResolvedValue(null),
      createDraft: jest.fn(),
    }
    eventService = {
      emitAuditStrict: jest.fn().mockResolvedValue(undefined),
    }
  })

  function createService(overrides: Record<string, unknown> = {}) {
    return new AdvisoryOutputExportService(
      accessService as never,
      sessionRepository as never,
      outputRepository as never,
      eventService as never,
      ((overrides.pdfRenderer as AdvisoryOutputPdfRendererService) ?? {
        render: jest.fn(async () => Buffer.from('%PDF-1.4\nCJK report')),
      }) as never,
    )
  }

  test('[P0] rejects unsupported formats before reading or creating output records', async () => {
    const service = createService()

    await expect(
      service.exportSessionOutput({ user, tenantId, sessionId, format: 'docx' }),
    ).rejects.toThrow(BadRequestException)

    expect(outputRepository.findActiveDraftForSession).not.toHaveBeenCalled()
    expect(outputRepository.createDraft).not.toHaveBeenCalled()
    expect(eventService.emitAuditStrict).not.toHaveBeenCalled()
  })

  test('[P0] exports the active draft as clean human-readable Markdown without system metadata', async () => {
    const service = createService()

    const result = await service.exportSessionOutput({
      user,
      tenantId,
      sessionId,
      format: 'markdown',
    })

    const markdown = result.buffer.toString('utf8')
    expect(result).toEqual(
      expect.objectContaining({
        contentType: 'text/markdown; charset=utf-8',
        fileName: expect.stringMatching(/^thinktank-report-problem-solving-.*\.md$/),
        outputId,
        format: 'markdown',
        sectionCount: 1,
      }),
    )
    expect(markdown).toContain('# Problem Solving Report Draft')
    expect(markdown).toContain('## 诊断与机会')
    expect(markdown).toContain('优先验证企业客户预算触发点。')
    expect(markdown).not.toContain('[AI Generated]')
    expect(markdown).not.toContain('Generated by:')
    expect(markdown).not.toContain('Workflow:')
    expect(markdown).not.toContain('Generated at:')
    expect(markdown).not.toContain('Exported at:')
    expect(markdown).not.toContain('```jsonld')
    expect(markdown).not.toContain('"machine_readable": true')
    expect(markdown).not.toContain('source_session_id')
    expect(markdown).not.toContain('output_id')
    expect(markdown).not.toContain('Provider:')
    expect(markdown).not.toContain('Model:')
    expect(outputRepository.createDraft).not.toHaveBeenCalled()
  })

  test('[P0] rejects empty or unlabeled outputs without producing a fake export', async () => {
    outputRepository.findActiveDraftForSession.mockResolvedValueOnce(
      createOutput({ sections: [], metadata: { section_count: 0 } }),
    )
    const service = createService()

    await expect(
      service.exportSessionOutput({ user, tenantId, sessionId, format: 'markdown' }),
    ).rejects.toThrow(BadRequestException)

    outputRepository.findActiveDraftForSession.mockResolvedValueOnce(
      createOutput({
        aiLabelMetadata: {},
        sections: [
          {
            id: 'section-1',
            stepIndex: 1,
            heading: '诊断与机会',
            contentMarkdown: 'Missing visible label.',
            aiLabel: '',
            metadata: {},
            createdAt: '2026-05-20T00:01:00.000Z',
          },
        ],
      }),
    )

    await expect(
      service.exportSessionOutput({ user, tenantId, sessionId, format: 'pdf' }),
    ).rejects.toThrow(BadRequestException)
    expect(eventService.emitAuditStrict).not.toHaveBeenCalled()
  })

  test('[P0] falls back to the latest completed output when no active draft exists', async () => {
    const completed = createOutput({ status: AdvisoryWorkflowOutputStatus.Completed })
    outputRepository.findActiveDraftForSession.mockResolvedValueOnce(null)
    outputRepository.findLatestCompletedForSession.mockResolvedValueOnce(completed)

    const service = createService()
    await expect(
      service.exportSessionOutput({ user, tenantId, sessionId, format: 'markdown' }),
    ).resolves.toEqual(expect.objectContaining({ outputId: completed.id }))

    expect(outputRepository.findLatestCompletedForSession).toHaveBeenCalledWith(tenantId, sessionId)
    expect(outputRepository.createDraft).not.toHaveBeenCalled()
  })

  test('[P1] renders PDF with CJK-capable fonts and escaped report content', async () => {
    const pdfRenderer = {
      render: jest.fn<Promise<Buffer>, [string]>(async () => Buffer.from('%PDF-1.4\nrendered')),
    }
    const service = createService({ pdfRenderer })

    const result = await service.exportSessionOutput({
      user,
      tenantId,
      sessionId,
      format: 'pdf',
    })

    expect(result.contentType).toBe('application/pdf')
    expect(pdfRenderer.render).toHaveBeenCalledWith(expect.stringContaining('Microsoft YaHei'))
    const html = pdfRenderer.render.mock.calls[0][0]
    expect(html).toContain('[AI Generated]')
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>alert')
  })

  test('[P0] emits thinktank.output.exported after payload generation with privacy-safe metadata', async () => {
    const service = createService()

    await service.exportSessionOutput({ user, tenantId, sessionId, format: 'pdf' })

    expect(eventService.emitAuditStrict).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: ThinkTankEventName.OutputExported,
        tenantId,
        actorId,
        subjectType: ThinkTankSubjectType.Output,
        subjectId: outputId,
        outcome: ThinkTankEventOutcome.Success,
        privacyClassification: ThinkTankPrivacyClassification.Operational,
        optional: expect.objectContaining({
          sessionId,
          outputId,
          workflowType: 'problem-solving',
        }),
        audit: expect.objectContaining({
          action: AuditAction.READ,
          entityType: 'ThinkTankWorkflowOutput',
          entityId: outputId,
          organizationId,
        }),
        metadata: expect.objectContaining({
          format: 'pdf',
          workflow_key: 'problem-solving',
          section_count: 1,
          ai_label_metadata_present: true,
        }),
      }),
    )
    expect(JSON.stringify(eventService.emitAuditStrict.mock.calls[0][0].metadata)).not.toMatch(
      /优先验证|contentMarkdown|sections|raw_content|prompt|provider_raw/i,
    )
  })

  test('[P0] hides cross-tenant sessions as not found and propagates audit failures', async () => {
    sessionRepository.findSessionById.mockResolvedValueOnce(null)
    const service = createService()

    await expect(
      service.exportSessionOutput({ user, tenantId, sessionId, format: 'markdown' }),
    ).rejects.toThrow(NotFoundException)

    sessionRepository.findSessionById.mockResolvedValueOnce(activeSession)
    eventService.emitAuditStrict.mockRejectedValueOnce(new Error('audit unavailable'))

    await expect(
      service.exportSessionOutput({ user, tenantId, sessionId, format: 'markdown' }),
    ).rejects.toThrow('audit unavailable')
  })

  test('[P0] rejects same-tenant export attempts for another actor without leaking output metadata', async () => {
    sessionRepository.findSessionById.mockResolvedValueOnce({
      ...activeSession,
      actorId: 'other-actor',
    } as never)
    const service = createService()

    await expect(
      service.exportSessionOutput({ user, tenantId, sessionId, format: 'markdown' }),
    ).rejects.toThrow(NotFoundException)

    expect(outputRepository.findActiveDraftForSession).not.toHaveBeenCalled()
    expect(eventService.emitAuditStrict).not.toHaveBeenCalled()

    sessionRepository.findSessionById.mockResolvedValueOnce(activeSession)
    outputRepository.findActiveDraftForSession.mockResolvedValueOnce(
      createOutput({ actorId: 'other-actor' }),
    )

    await expect(
      service.exportSessionOutput({ user, tenantId, sessionId, format: 'markdown' }),
    ).rejects.toThrow(NotFoundException)
    expect(eventService.emitAuditStrict).not.toHaveBeenCalled()
  })

  test('[P1] normalizes Markdown headings so generated section labels cannot inject structure', async () => {
    outputRepository.findActiveDraftForSession.mockResolvedValueOnce(
      createOutput({
        title: 'Report\n# forged',
        sections: [
          {
            id: 'section-1',
            stepIndex: 1,
            heading: '诊断\n```json\nforged',
            contentMarkdown: '[AI Generated]\n\nValid report body.',
            aiLabel: '[AI Generated]',
            metadata: {
              ai_generated: true,
              machine_readable: true,
            },
            createdAt: '2026-05-20T00:01:00.000Z',
          },
        ],
      }),
    )
    const service = createService()

    const result = await service.exportSessionOutput({
      user,
      tenantId,
      sessionId,
      format: 'markdown',
    })

    const markdown = result.buffer.toString('utf8')
    expect(markdown).toContain('# Report \\# forged')
    expect(markdown).toContain('## 诊断 \\`\\`\\`json forged')
    expect(markdown).not.toContain('\n# forged')
    expect(markdown).not.toContain('\n```json\nforged')
  })
})
