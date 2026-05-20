import { Body, Controller, Optional, Post, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../auth/decorators/current-user.decorator'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator'
import { TenantGuard } from '../../organizations/guards/tenant.guard'
import { AdvisoryAccessUser } from '../access/advisory-access.service'
import { StartQuickConsultDto } from './dto/start-quick-consult.dto'
import { SubmitRecommendationFeedbackDto } from './dto/submit-recommendation-feedback.dto'
import { QuickConsultMethodBrowseService } from './quick-consult-method-browse.service'
import { QuickConsultRecommendationFeedbackService } from './quick-consult-recommendation-feedback.service'
import { QuickConsultService } from './quick-consult.service'

interface ManualBrowseBody {
  quickConsultContextId?: unknown
  [key: string]: unknown
}

@Controller('advisory/quick-consult')
@UseGuards(JwtAuthGuard, TenantGuard)
export class QuickConsultController {
  constructor(
    private readonly quickConsultService: QuickConsultService,
    @Optional() private readonly methodBrowseService?: QuickConsultMethodBrowseService,
    @Optional()
    private readonly recommendationFeedbackService?: QuickConsultRecommendationFeedbackService,
  ) {}

  @Post('start')
  async startQuickConsult(
    @CurrentUser() user: AdvisoryAccessUser,
    @CurrentTenant() tenantId: string,
    @Body() body: StartQuickConsultDto & { tenantId?: unknown },
  ) {
    const result = await this.quickConsultService.startQuickConsult({
      user,
      tenantId,
      problem: body?.problem,
      contextId: body?.contextId,
      originalProblem: body?.originalProblem,
      clarificationAnswers: body?.clarificationAnswers,
    })

    return { data: result }
  }

  @Post('manual-browse')
  async getManualBrowseCatalog(
    @CurrentUser() user: AdvisoryAccessUser,
    @CurrentTenant() tenantId: string,
    @Body() body: ManualBrowseBody,
  ) {
    const catalog = await this.requireMethodBrowseService().listManualBrowseCatalog({
      user,
      tenantId,
      quickConsultContextId: this.toOptionalText(body?.quickConsultContextId),
    })

    return { data: catalog }
  }

  @Post('recommendation-feedback')
  async submitRecommendationFeedback(
    @CurrentUser() user: AdvisoryAccessUser,
    @CurrentTenant() tenantId: string,
    @Body() body: SubmitRecommendationFeedbackDto,
  ) {
    const feedback = await this.requireRecommendationFeedbackService().submitRecommendationFeedback(
      {
        user,
        tenantId,
        quickConsultContextId: this.toOptionalText(body?.quickConsultContextId),
        recommendationIds: this.toOptionalTextList(body?.recommendationIds),
        rating: body?.rating,
        feedbackText: this.toOptionalText(body?.feedbackText),
      },
    )

    return { data: feedback }
  }

  private requireMethodBrowseService(): QuickConsultMethodBrowseService {
    if (!this.methodBrowseService) {
      throw new Error('Quick Consult method browse service is not configured.')
    }

    return this.methodBrowseService
  }

  private requireRecommendationFeedbackService(): QuickConsultRecommendationFeedbackService {
    if (!this.recommendationFeedbackService) {
      throw new Error('Quick Consult recommendation feedback service is not configured.')
    }

    return this.recommendationFeedbackService
  }

  private toOptionalText(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined
  }

  private toOptionalTextList(value: unknown): string[] | undefined {
    if (!Array.isArray(value)) return undefined

    const values = value
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((item) => item.trim())

    return values.length > 0 ? values : undefined
  }
}
