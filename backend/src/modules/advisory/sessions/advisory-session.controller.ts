import { Body, Controller, Get, Param, Post, Res, UseGuards } from '@nestjs/common'
import type { Response } from 'express'
import { CurrentUser } from '../../auth/decorators/current-user.decorator'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator'
import { TenantGuard } from '../../organizations/guards/tenant.guard'
import { AdvisoryAccessUser } from '../access/advisory-access.service'
import {
  AdvisoryConversationStreamingEvent,
  AdvisorySessionService,
  THINKTANK_MESSAGE_SUBMIT_FAILED_MESSAGE,
} from './advisory-session.service'
import { SubmitAdvisoryMessageDto } from './dto/submit-advisory-message.dto'

export function formatSseEvent(event: AdvisoryConversationStreamingEvent): string {
  return `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`
}

async function writeSseEvent(
  response: Response,
  event: AdvisoryConversationStreamingEvent,
  signal: AbortSignal,
): Promise<void> {
  if (signal.aborted) return

  const canContinue = response.write(formatSseEvent(event))
  if (canContinue !== false) return
  if (typeof response.once !== 'function') return

  await new Promise<void>((resolve) => {
    const cleanup = () => {
      signal.removeEventListener('abort', onAbort)
      response.off?.('drain', onDrain)
      response.off?.('close', onAbort)
    }
    const onDrain = () => {
      cleanup()
      resolve()
    }
    const onAbort = () => {
      cleanup()
      resolve()
    }

    signal.addEventListener('abort', onAbort, { once: true })
    response.once?.('drain', onDrain)
    response.once?.('close', onAbort)
  })
}

@Controller('advisory')
@UseGuards(JwtAuthGuard, TenantGuard)
export class AdvisorySessionController {
  constructor(private readonly advisorySessionService: AdvisorySessionService) {}

  @Get('workflows')
  async getWorkflows(@CurrentUser() user: AdvisoryAccessUser, @CurrentTenant() tenantId: string) {
    const catalog = await this.advisorySessionService.listWorkflows({ user, tenantId })

    return { data: catalog }
  }

  @Post('workflows/:workflowKey/launch')
  async launchWorkflow(
    @Param('workflowKey') workflowKey: string,
    @CurrentUser() user: AdvisoryAccessUser,
    @CurrentTenant() tenantId: string,
  ) {
    const launch = await this.advisorySessionService.launchWorkflow({
      user,
      tenantId,
      workflowKey,
    })

    return { data: launch }
  }

  @Get('sessions/:sessionId/messages')
  async getMessages(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: AdvisoryAccessUser,
    @CurrentTenant() tenantId: string,
  ) {
    const messages = await this.advisorySessionService.listMessages({
      user,
      tenantId,
      sessionId,
    })

    return { data: messages }
  }

  @Post('sessions/:sessionId/messages')
  async submitMessage(
    @Param('sessionId') sessionId: string,
    @Body() body: SubmitAdvisoryMessageDto,
    @CurrentUser() user: AdvisoryAccessUser,
    @CurrentTenant() tenantId: string,
  ) {
    const response = await this.advisorySessionService.submitMessage({
      user,
      tenantId,
      sessionId,
      content: body.content,
      decisionAction: body.decisionAction,
    })

    return { data: response }
  }

  @Post('sessions/:sessionId/messages/stream')
  async streamMessage(
    @Param('sessionId') sessionId: string,
    @Body() body: SubmitAdvisoryMessageDto,
    @CurrentUser() user: AdvisoryAccessUser,
    @CurrentTenant() tenantId: string,
    @Res() response: Response,
  ) {
    const abortController = new AbortController()
    let responseEnding = false
    const abortOnClose = () => {
      if (!responseEnding) {
        abortController.abort()
      }
    }
    response.once?.('close', abortOnClose)
    const stream = this.advisorySessionService.streamMessage({
      user,
      tenantId,
      sessionId,
      content: body.content,
      decisionAction: body.decisionAction,
      signal: abortController.signal,
    })
    const iterator = stream[Symbol.asyncIterator]()
    const firstEvent = await iterator.next()

    response.status(200)
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    response.setHeader('Cache-Control', 'no-cache, no-transform')
    response.setHeader('Connection', 'keep-alive')
    response.flushHeaders?.()

    try {
      if (!firstEvent.done) {
        await writeSseEvent(response, firstEvent.value, abortController.signal)
      }

      while (!abortController.signal.aborted) {
        const nextEvent = await iterator.next()
        if (nextEvent.done) break
        await writeSseEvent(response, nextEvent.value, abortController.signal)
      }
    } catch {
      if (!abortController.signal.aborted) {
        await writeSseEvent(
          response,
          {
            event: 'message.error',
            data: {
              code: 'THINKTANK_STREAM_FAILED',
              message: THINKTANK_MESSAGE_SUBMIT_FAILED_MESSAGE,
              retryable: true,
            },
          },
          abortController.signal,
        )
      }
    } finally {
      responseEnding = true
      response.off?.('close', abortOnClose)
      if (!response.destroyed) {
        response.end()
      }
      if (typeof iterator.return === 'function') {
        await iterator.return()
      }
    }
  }
}
