import 'reflect-metadata'
import { EventEmitter } from 'node:events'
import { BadRequestException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { TenantGuard } from '../../organizations/guards/tenant.guard'
import { AdvisorySessionController } from './advisory-session.controller'
import { AdvisorySessionService } from './advisory-session.service'

describe('AdvisorySessionController guided messages', () => {
  let controller: AdvisorySessionController
  let service: jest.Mocked<
    Pick<
      AdvisorySessionService,
      'listMessages' | 'submitMessage' | 'streamMessage' | 'listWorkflows' | 'launchWorkflow'
    >
  >

  beforeEach(async () => {
    service = {
      listWorkflows: jest.fn(),
      launchWorkflow: jest.fn(),
      listMessages: jest.fn().mockResolvedValue({
        sessionId: 'session-1',
        currentStep: { index: 1, label: '当前步骤', sourceRef: 'current-step:1' },
        messages: [],
      }),
      submitMessage: jest.fn().mockResolvedValue({
        sessionId: 'session-1',
        currentStep: { index: 1, label: '当前步骤', sourceRef: 'current-step:1' },
        messages: [],
        assistantMessage: {
          id: 'assistant-1',
          role: 'assistant',
          content: 'Here is a guided summary.',
          decisionOptions: [{ action: 'continue', label: '继续', shortcut: 'C', enabled: true }],
        },
        stream: [{ index: 0, delta: 'Here is a guided summary.', done: true }],
        decisionOptions: [{ action: 'continue', label: '继续', shortcut: 'C', enabled: true }],
      }),
      streamMessage: jest.fn(async function* () {
        yield {
          event: 'message.started',
          data: {
            sessionId: 'session-1',
            currentStep: { index: 1, label: '当前步骤', sourceRef: 'current-step:1' },
          },
        }
        yield {
          event: 'message.delta',
          data: {
            index: 0,
            delta: 'Here is a streamed summary.',
          },
        }
        yield {
          event: 'message.completed',
          data: {
            sessionId: 'session-1',
            currentStep: { index: 1, label: '当前步骤', sourceRef: 'current-step:1' },
            assistantMessage: {
              id: 'assistant-1',
              role: 'assistant',
              content: 'Here is a streamed summary.',
              decisionOptions: [],
            },
            decisionOptions: [],
          },
        }
      }),
    } as never

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdvisorySessionController],
      providers: [
        {
          provide: AdvisorySessionService,
          useValue: service,
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

  test('[P0] returns session messages without accepting tenantId from caller input', async () => {
    const user = { id: 'user-1', organizationId: 'org-1' }

    await expect(controller.getMessages('session-1', user as never, 'tenant-1')).resolves.toEqual({
      data: {
        sessionId: 'session-1',
        currentStep: { index: 1, label: '当前步骤', sourceRef: 'current-step:1' },
        messages: [],
      },
    })
    expect(service.listMessages).toHaveBeenCalledWith({
      user,
      tenantId: 'tenant-1',
      sessionId: 'session-1',
    })
  })

  test('[P0] submits a user answer through the session context and returns streamed advisor data', async () => {
    const user = { id: 'user-1', organizationId: 'org-1' }

    await expect(
      controller.submitMessage(
        'session-1',
        { content: 'We need to inspect retention drop-off.', tenantId: 'attacker-tenant' } as never,
        user as never,
        'tenant-1',
      ),
    ).resolves.toEqual({
      data: expect.objectContaining({
        sessionId: 'session-1',
        assistantMessage: expect.objectContaining({
          role: 'assistant',
          content: 'Here is a guided summary.',
        }),
        stream: [expect.objectContaining({ done: true })],
      }),
    })
    expect(service.submitMessage).toHaveBeenCalledWith({
      user,
      tenantId: 'tenant-1',
      sessionId: 'session-1',
      content: 'We need to inspect retention drop-off.',
      decisionAction: undefined,
    })
  })

  test('[P0] writes UTF-8 SSE frames with streaming headers without accepting tenantId from the body', async () => {
    const user = { id: 'user-1', organizationId: 'org-1' }
    const response = {
      status: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      flushHeaders: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
    }

    await controller.streamMessage(
      'session-1',
      { content: 'Please stream this response.', tenantId: 'attacker-tenant' } as never,
      user as never,
      'tenant-1',
      response as never,
    )

    expect(response.status).toHaveBeenCalledWith(200)
    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'text/event-stream; charset=utf-8',
    )
    expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache, no-transform')
    expect(response.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive')
    expect(response.flushHeaders).toHaveBeenCalled()
    expect(service.streamMessage).toHaveBeenCalledWith({
      user,
      tenantId: 'tenant-1',
      sessionId: 'session-1',
      content: 'Please stream this response.',
      decisionAction: undefined,
      signal: expect.any(AbortSignal),
    })
    expect(response.write.mock.calls.map(([frame]) => frame)).toEqual([
      'event: message.started\ndata: {"sessionId":"session-1","currentStep":{"index":1,"label":"当前步骤","sourceRef":"current-step:1"}}\n\n',
      'event: message.delta\ndata: {"index":0,"delta":"Here is a streamed summary."}\n\n',
      'event: message.completed\ndata: {"sessionId":"session-1","currentStep":{"index":1,"label":"当前步骤","sourceRef":"current-step:1"},"assistantMessage":{"id":"assistant-1","role":"assistant","content":"Here is a streamed summary.","decisionOptions":[]},"decisionOptions":[]}\n\n',
    ])
    expect(response.end).toHaveBeenCalled()
  })

  test('[P0] lets pre-stream validation errors use normal HTTP exception handling', async () => {
    const user = { id: 'user-1', organizationId: 'org-1' }
    service.streamMessage.mockImplementationOnce(async function* () {
      throw new BadRequestException('请输入你的回答后再提交。')
    })
    const response = {
      status: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      flushHeaders: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
    }

    await expect(
      controller.streamMessage(
        'session-1',
        { content: '' },
        user as never,
        'tenant-1',
        response as never,
      ),
    ).rejects.toThrow(BadRequestException)

    expect(response.status).not.toHaveBeenCalled()
    expect(response.setHeader).not.toHaveBeenCalled()
    expect(response.end).not.toHaveBeenCalled()
  })

  test('[P1] waits for response drain when SSE writes hit backpressure', async () => {
    const user = { id: 'user-1', organizationId: 'org-1' }
    const emitter = new EventEmitter()
    const response = Object.assign(emitter, {
      destroyed: false,
      status: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      flushHeaders: jest.fn(),
      write: jest.fn().mockReturnValueOnce(false).mockReturnValue(true),
      end: jest.fn(),
    })
    const streamPromise = controller.streamMessage(
      'session-1',
      { content: 'Please stream this response.' },
      user as never,
      'tenant-1',
      response as never,
    )

    await new Promise((resolve) => setImmediate(resolve))
    expect(response.write).toHaveBeenCalledTimes(1)
    emitter.emit('drain')
    await streamPromise

    expect(response.write).toHaveBeenCalledTimes(3)
    expect(response.end).toHaveBeenCalled()
  })

  test('[P1] aborts the service stream when the client connection closes', async () => {
    const user = { id: 'user-1', organizationId: 'org-1' }
    const emitter = new EventEmitter()
    const response = Object.assign(emitter, {
      destroyed: false,
      status: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      flushHeaders: jest.fn(),
      write: jest.fn().mockImplementation(() => {
        emitter.emit('close')
        return true
      }),
      end: jest.fn(),
    })
    let observedSignal: AbortSignal | undefined
    service.streamMessage.mockImplementationOnce(async function* (context) {
      observedSignal = context.signal
      yield {
        event: 'message.started',
        data: {
          sessionId: 'session-1',
          currentStep: { index: 1, label: '当前步骤', sourceRef: 'current-step:1' },
        },
      }
      yield {
        event: 'message.delta',
        data: {
          index: 0,
          delta: 'Should not be written after close.',
        },
      }
    })

    await controller.streamMessage(
      'session-1',
      { content: 'Please stream this response.' },
      user as never,
      'tenant-1',
      response as never,
    )

    expect(observedSignal?.aborted).toBe(true)
    expect(response.write).toHaveBeenCalledTimes(1)
  })
})
