import {
  Body,
  Controller,
  Get,
  Optional,
  Param,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common'
import type { Response } from 'express'
import { CurrentUser } from '../../auth/decorators/current-user.decorator'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator'
import { TenantGuard } from '../../organizations/guards/tenant.guard'
import { AdvisoryAccessUser } from '../access/advisory-access.service'
import { AdvisoryOutputExportService } from '../outputs/advisory-output-export.service'
import {
  AdvisoryConversationStreamingEvent,
  AdvisorySessionService,
  THINKTANK_MESSAGE_SUBMIT_FAILED_MESSAGE,
} from './advisory-session.service'
import { SubmitAdvisoryMessageDto } from './dto/submit-advisory-message.dto'

interface AppendOutputSectionBody {
  stepIndex?: unknown
  stepLabel?: unknown
  contentMarkdown?: unknown
  sourceMessageId?: unknown
  providerMetadata?: Record<string, unknown>
}

interface CompleteOutputBody {
  outcome?: unknown
}

interface SubmitOutputRatingBody {
  outputId?: unknown
  rating?: unknown
  feedbackText?: unknown
}

interface UpdateOutputFavoriteBody {
  outputId?: unknown
  isFavorited?: unknown
}

interface LaunchWorkflowBody {
  quickConsultContextId?: unknown
  acceptedRecommendationId?: unknown
  acceptedRecommendation?: unknown
  manualChoice?: unknown
  manualChoiceKind?: unknown
  manualChoiceId?: unknown
  manualChoiceLabel?: unknown
}

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
  constructor(
    private readonly advisorySessionService: AdvisorySessionService,
    @Optional() private readonly outputExportService?: AdvisoryOutputExportService,
  ) {}

  @Get('workflows')
  async getWorkflows(@CurrentUser() user: AdvisoryAccessUser, @CurrentTenant() tenantId: string) {
    const catalog = await this.advisorySessionService.listWorkflows({ user, tenantId })

    return { data: catalog }
  }

  @Post('workflows/:workflowKey/launch')
  async launchWorkflow(
    @Param('workflowKey') workflowKey: string,
    @Body() body: LaunchWorkflowBody,
    @CurrentUser() user: AdvisoryAccessUser,
    @CurrentTenant() tenantId: string,
  ) {
    const launch = await this.advisorySessionService.launchWorkflow({
      user,
      tenantId,
      workflowKey,
      quickConsultContextId: this.toOptionalText(body?.quickConsultContextId),
      acceptedRecommendationId:
        body?.manualChoice === true
          ? undefined
          : this.toOptionalText(body?.acceptedRecommendationId),
      acceptedRecommendation:
        body?.manualChoice === true ? false : body?.acceptedRecommendation === true,
      manualChoice: body?.manualChoice === true,
      manualChoiceKind: this.toManualChoiceKind(body?.manualChoiceKind),
      manualChoiceId: this.toOptionalText(body?.manualChoiceId),
      manualChoiceLabel: this.toOptionalText(body?.manualChoiceLabel),
    })

    return { data: launch }
  }

  @Get('sessions/unfinished')
  async listUnfinishedSessions(
    @CurrentUser() user: AdvisoryAccessUser,
    @CurrentTenant() tenantId: string,
  ) {
    const sessions = await this.advisorySessionService.listUnfinishedSessions({
      user,
      tenantId,
    })

    return { data: sessions }
  }

  @Get('sessions/history')
  async listSessionHistory(
    @Query() query: Record<string, unknown>,
    @CurrentUser() user: AdvisoryAccessUser,
    @CurrentTenant() tenantId: string,
  ) {
    const history = await this.advisorySessionService.listSessionHistory({
      user,
      tenantId,
      query: this.toHistoryQuery(query),
    })

    return { data: history }
  }

  @Get('sessions/search')
  async searchSessionHistory(
    @Query() query: Record<string, unknown>,
    @CurrentUser() user: AdvisoryAccessUser,
    @CurrentTenant() tenantId: string,
  ) {
    const results = await this.advisorySessionService.searchSessionHistory({
      user,
      tenantId,
      query: this.toHistoryQuery(query),
    })

    return { data: results }
  }

  @Post('sessions/:sessionId/resume')
  async resumeSession(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: AdvisoryAccessUser,
    @CurrentTenant() tenantId: string,
  ) {
    const resumed = await this.advisorySessionService.resumeSession({
      user,
      tenantId,
      sessionId,
    })

    return { data: resumed }
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

  @Get('sessions/:sessionId/output')
  async getOutput(
    @Param('sessionId') sessionId: string,
    @Query('outputId') outputId: string | undefined,
    @CurrentUser() user: AdvisoryAccessUser,
    @CurrentTenant() tenantId: string,
  ) {
    const output = await this.advisorySessionService.getSessionOutput({
      user,
      tenantId,
      sessionId,
      ...(this.toOptionalText(outputId) ? { outputId: this.toOptionalText(outputId) } : {}),
    })

    return { data: output }
  }

  @Get('sessions/:sessionId/output/state')
  async getOutputAssetState(
    @Param('sessionId') sessionId: string,
    @Query('outputId') outputId: string | undefined,
    @CurrentUser() user: AdvisoryAccessUser,
    @CurrentTenant() tenantId: string,
  ) {
    const assetState = await this.advisorySessionService.getOutputAssetState({
      user,
      tenantId,
      sessionId,
      ...(this.toOptionalText(outputId) ? { outputId: this.toOptionalText(outputId) } : {}),
    })

    return { data: assetState }
  }

  @Put('sessions/:sessionId/output/rating')
  async submitOutputRating(
    @Param('sessionId') sessionId: string,
    @Body() body: SubmitOutputRatingBody,
    @CurrentUser() user: AdvisoryAccessUser,
    @CurrentTenant() tenantId: string,
  ) {
    const rating = await this.advisorySessionService.submitOutputRating({
      user,
      tenantId,
      sessionId,
      ...(this.toOptionalText(body?.outputId)
        ? { outputId: this.toOptionalText(body?.outputId) }
        : {}),
      rating: body?.rating,
      ...(this.toOptionalText(body?.feedbackText)
        ? { feedbackText: this.toOptionalText(body?.feedbackText) }
        : {}),
    })

    return { data: rating }
  }

  @Put('sessions/:sessionId/output/favorite')
  async updateOutputFavorite(
    @Param('sessionId') sessionId: string,
    @Body() body: UpdateOutputFavoriteBody,
    @CurrentUser() user: AdvisoryAccessUser,
    @CurrentTenant() tenantId: string,
  ) {
    const favorite = await this.advisorySessionService.updateOutputFavorite({
      user,
      tenantId,
      sessionId,
      ...(this.toOptionalText(body?.outputId)
        ? { outputId: this.toOptionalText(body?.outputId) }
        : {}),
      isFavorited: typeof body?.isFavorited === 'boolean' ? body.isFavorited : undefined,
    })

    return { data: favorite }
  }

  @Get('sessions/:sessionId/checkpoint')
  async getCheckpoint(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: AdvisoryAccessUser,
    @CurrentTenant() tenantId: string,
  ) {
    const checkpoint = await this.advisorySessionService.getSessionCheckpoint({
      user,
      tenantId,
      sessionId,
    })

    return { data: checkpoint }
  }

  @Post('sessions/:sessionId/output/sections')
  async appendOutputSection(
    @Param('sessionId') sessionId: string,
    @Body() body: AppendOutputSectionBody,
    @CurrentUser() user: AdvisoryAccessUser,
    @CurrentTenant() tenantId: string,
  ) {
    const section = await this.advisorySessionService.appendOutputSection({
      user,
      tenantId,
      sessionId,
      stepIndex: Number.isInteger(body?.stepIndex) ? (body.stepIndex as number) : 1,
      stepLabel: typeof body?.stepLabel === 'string' ? body.stepLabel : undefined,
      contentMarkdown: typeof body?.contentMarkdown === 'string' ? body.contentMarkdown : '',
      sourceMessageId: typeof body?.sourceMessageId === 'string' ? body.sourceMessageId : undefined,
      providerMetadata: this.toSafeProviderMetadata(body?.providerMetadata),
    })

    return { data: section }
  }

  @Post('sessions/:sessionId/output/complete')
  async completeOutput(
    @Param('sessionId') sessionId: string,
    @Body() body: CompleteOutputBody,
    @CurrentUser() user: AdvisoryAccessUser,
    @CurrentTenant() tenantId: string,
  ) {
    const output = await this.advisorySessionService.completeOutput({
      user,
      tenantId,
      sessionId,
      outcome: typeof body?.outcome === 'string' ? body.outcome : 'success',
    })

    return { data: output }
  }

  @Get('sessions/:sessionId/output/export')
  async exportOutput(
    @Param('sessionId') sessionId: string,
    @Query('format') format: string | undefined,
    @CurrentUser() user: AdvisoryAccessUser,
    @CurrentTenant() tenantId: string,
    @Res() response: Response,
  ) {
    const exported = await this.requireOutputExportService().exportSessionOutput({
      user,
      tenantId,
      sessionId,
      format: format ?? '',
    })

    response.status(200)
    response.setHeader('Content-Type', exported.contentType)
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${this.toContentDispositionFileName(exported.fileName)}"`,
    )
    response.setHeader('Content-Length', String(exported.buffer.length))
    response.send(exported.buffer)
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

  private toSafeProviderMetadata(metadata: unknown): Record<string, unknown> {
    if (!metadata || typeof metadata !== 'object') {
      return {}
    }

    const source = metadata as Record<string, unknown>
    const safe: Record<string, unknown> = {}
    const copyText = (sourceKey: string) => {
      const value = source[sourceKey]
      if (typeof value === 'string' && value.trim()) {
        safe[sourceKey] = value.trim()
      }
    }
    const copyNumber = (sourceKey: string) => {
      const value = source[sourceKey]
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
        safe[sourceKey] = value
      }
    }

    copyText('provider')
    copyText('model')
    copyNumber('latencyMs')
    copyNumber('inputTokens')
    copyNumber('outputTokens')
    copyNumber('totalTokens')
    copyNumber('estimatedCost')
    const cacheStatus = readCacheStatus(source.cacheStatus)
    const cacheStrategy = readCacheStrategy(source.cacheStrategy)
    const cacheKey = readCacheKey(source.cacheKey)
    const cacheBypassReason =
      cacheStatus === 'bypass' ? readCacheBypassReason(source.cacheBypassReason) : undefined
    if (cacheStatus) safe.cacheStatus = cacheStatus
    if (cacheStrategy) safe.cacheStrategy = cacheStrategy
    if (cacheKey) safe.cacheKey = cacheKey
    if (cacheBypassReason) safe.cacheBypassReason = cacheBypassReason
    copyNumber('cacheReadInputTokens')
    copyNumber('cacheCreationInputTokens')
    copyNumber('cachedInputTokens')
    copyNumber('cacheEligibleInputTokens')

    return safe
  }

  private toOptionalText(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined
  }

  private toHistoryQuery(query: Record<string, unknown> | undefined) {
    const safe: Record<string, string> = {}
    const copy = (key: string) => {
      const value = this.toOptionalText(query?.[key])
      if (value) safe[key] = value
    }

    copy('q')
    copy('type')
    copy('workflowKey')
    copy('status')
    copy('from')
    copy('to')
    copy('page')
    copy('limit')

    return safe
  }

  private toManualChoiceKind(value: unknown): 'workflow' | 'method' | undefined {
    return value === 'workflow' || value === 'method' ? value : undefined
  }

  private requireOutputExportService(): AdvisoryOutputExportService {
    if (!this.outputExportService) {
      throw new Error('Advisory output export service is not configured.')
    }

    return this.outputExportService
  }

  private toContentDispositionFileName(fileName: string): string {
    return fileName.replace(/[^A-Za-z0-9._-]/g, '-')
  }
}

function readCacheStatus(value: unknown): 'hit' | 'miss' | 'bypass' | undefined {
  return value === 'hit' || value === 'miss' || value === 'bypass' ? value : undefined
}

function readCacheStrategy(
  value: unknown,
): 'provider-auto' | 'anthropic-explicit' | 'disabled' | 'unsupported' | undefined {
  return value === 'provider-auto' ||
    value === 'anthropic-explicit' ||
    value === 'disabled' ||
    value === 'unsupported'
    ? value
    : undefined
}

function readCacheBypassReason(
  value: unknown,
): 'disabled' | 'unsupported' | 'no_static_prompt' | 'provider_metadata_absent' | undefined {
  return value === 'disabled' ||
    value === 'unsupported' ||
    value === 'no_static_prompt' ||
    value === 'provider_metadata_absent'
    ? value
    : undefined
}

function readCacheKey(value: unknown): string | undefined {
  return typeof value === 'string' && /^[a-f0-9]{32}$/i.test(value.trim())
    ? value.trim().toLowerCase()
    : undefined
}
