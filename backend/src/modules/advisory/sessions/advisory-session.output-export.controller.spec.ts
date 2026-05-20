import 'reflect-metadata'
import { RequestMethod } from '@nestjs/common'
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants'
import { Test, TestingModule } from '@nestjs/testing'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { TenantGuard } from '../../organizations/guards/tenant.guard'
import { AdvisoryOutputExportService } from '../outputs/advisory-output-export.service'
import { AdvisorySessionController } from './advisory-session.controller'
import { AdvisorySessionService } from './advisory-session.service'

const user = { id: 'user-1', organizationId: 'org-1' }

const markdownExport = {
  buffer: Buffer.from('# Problem Solving Report Draft\n\n[AI Generated]'),
  contentType: 'text/markdown; charset=utf-8',
  fileName: 'thinktank-report-problem-solving-2026-05-20.md',
  outputId: 'output-1',
  format: 'markdown',
  sectionCount: 1,
}

function createResponse() {
  return {
    setHeader: jest.fn(),
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  }
}

/*
 * Provider endpoint: backend/src/modules/advisory/sessions/advisory-session.controller.ts
 * Expected route: GET /advisory/sessions/:sessionId/output/export?format=markdown|pdf
 * Provider scrutiny evidence:
 * - Status: 200 with raw export payload; 400/404 provider exceptions flow through Nest filters.
 * - Request: format query only. Caller-supplied tenant, actor, output id, report content, and audit fields are ignored.
 * - Response headers: Content-Type and Content-Disposition are required for browser download.
 */
describe('AdvisorySessionController output export route (ATDD RED)', () => {
  let controller: AdvisorySessionController
  let outputExportService: {
    exportSessionOutput: jest.Mock
  }

  beforeEach(async () => {
    outputExportService = {
      exportSessionOutput: jest.fn().mockResolvedValue(markdownExport),
    }

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdvisorySessionController],
      providers: [
        {
          provide: AdvisorySessionService,
          useValue: {},
        },
        {
          provide: AdvisoryOutputExportService,
          useValue: outputExportService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(TenantGuard)
      .useValue({ canActivate: () => true })
      .compile()

    controller = module.get<AdvisorySessionController>(AdvisorySessionController)
  })

  test('[P0] exposes a guarded session-scoped output export route', () => {
    const exportOutput = (controller as unknown as Record<string, unknown>).exportOutput

    expect(Reflect.getMetadata(PATH_METADATA, AdvisorySessionController)).toBe('advisory')
    expect(Reflect.getMetadata(GUARDS_METADATA, AdvisorySessionController)).toEqual(
      expect.arrayContaining([JwtAuthGuard, TenantGuard]),
    )
    expect(Reflect.getMetadata(PATH_METADATA, exportOutput)).toBe(
      'sessions/:sessionId/output/export',
    )
    expect(Reflect.getMetadata(METHOD_METADATA, exportOutput)).toBe(RequestMethod.GET)
  })

  test('[P0] streams Markdown with download headers instead of a JSON data envelope', async () => {
    const response = createResponse()

    await (
      controller as never as {
        exportOutput: (
          sessionId: string,
          format: string,
          user: unknown,
          tenantId: string,
          response: ReturnType<typeof createResponse>,
        ) => Promise<void>
      }
    ).exportOutput('session-1', 'markdown', user, 'tenant-1', response)

    expect(outputExportService.exportSessionOutput).toHaveBeenCalledWith({
      user,
      tenantId: 'tenant-1',
      sessionId: 'session-1',
      format: 'markdown',
    })
    expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'text/markdown; charset=utf-8')
    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="thinktank-report-problem-solving-2026-05-20.md"',
    )
    expect(response.send).toHaveBeenCalledWith(markdownExport.buffer)
  })

  test('[P0] never accepts caller-supplied tenant, output id, or raw report content for export', async () => {
    const response = createResponse()

    await (
      controller as never as {
        exportOutput: (
          sessionId: string,
          format: string,
          user: unknown,
          tenantId: string,
          response: ReturnType<typeof createResponse>,
        ) => Promise<void>
      }
    ).exportOutput('session-1', 'pdf', user, 'tenant-1', response)

    const call = outputExportService.exportSessionOutput.mock.calls[0][0]
    expect(call).toEqual({
      user,
      tenantId: 'tenant-1',
      sessionId: 'session-1',
      format: 'pdf',
    })
    expect(JSON.stringify(call)).not.toMatch(/outputId|contentMarkdown|sections|audit|attacker/i)
  })

  test('[P1] forwards PDF payload headers for CJK-capable renderer output', async () => {
    outputExportService.exportSessionOutput.mockResolvedValueOnce({
      ...markdownExport,
      buffer: Buffer.from('%PDF-1.4\n'),
      contentType: 'application/pdf',
      fileName: 'thinktank-report-problem-solving-2026-05-20.pdf',
      format: 'pdf',
    })
    const response = createResponse()

    await (
      controller as never as {
        exportOutput: (
          sessionId: string,
          format: string,
          user: unknown,
          tenantId: string,
          response: ReturnType<typeof createResponse>,
        ) => Promise<void>
      }
    ).exportOutput('session-1', 'pdf', user, 'tenant-1', response)

    expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf')
    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="thinktank-report-problem-solving-2026-05-20.pdf"',
    )
    expect(response.send).toHaveBeenCalledWith(Buffer.from('%PDF-1.4\n'))
  })
})
