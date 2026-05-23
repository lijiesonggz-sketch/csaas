import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Optional,
  Query,
  UseGuards,
} from '@nestjs/common'
import { UserRole } from '../../../database/entities/user.entity'
import { CurrentUser } from '../../auth/decorators/current-user.decorator'
import { Roles } from '../../auth/decorators/roles.decorator'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../../auth/guards/roles.guard'
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator'
import { TenantGuard } from '../../organizations/guards/tenant.guard'
import { THINKTANK_GOVERNANCE_EVENT_NAMES } from '../events/thinktank-governance-events'
import { ThinkTankEventOutcome } from '../events/thinktank-event-contract'
import { AdvisoryOperationsService } from './advisory-operations.service'
import { AdvisoryGovernanceService } from './advisory-governance.service'
import { AdvisoryGovernanceGroupBy } from './advisory-governance.types'
import { AdvisoryQualityFeedbackService } from './advisory-quality-feedback.service'
import {
  AdvisoryQualityFeedbackGroupBy,
  AdvisoryQualityFeedbackTimeBucket,
} from './advisory-quality-feedback.types'
import { AdvisoryProviderTelemetryService } from './advisory-provider-telemetry.service'
import { AdvisoryProviderTelemetryGroupBy } from './advisory-provider-telemetry.types'
import { AdvisoryOperationsActor } from './advisory-operations.types'

const MAX_PROVIDER_TELEMETRY_WINDOW_DAYS = 90
const GOVERNANCE_EVENT_NAME_SET = new Set<string>(THINKTANK_GOVERNANCE_EVENT_NAMES)
const GOVERNANCE_OUTCOME_SET = new Set<string>(Object.values(ThinkTankEventOutcome))

interface AdvisoryOperationsUsageQueryDto {
  tenantId?: unknown
  dateFrom?: unknown
  dateTo?: unknown
  workflowType?: unknown
}

interface AdvisoryProviderTelemetryQueryDto extends AdvisoryOperationsUsageQueryDto {
  groupBy?: unknown
}

interface AdvisoryQualityFeedbackQueryDto extends AdvisoryOperationsUsageQueryDto {
  groupBy?: unknown
  recommendationType?: unknown
  timeBucket?: unknown
}

interface AdvisoryGovernanceQueryDto extends AdvisoryOperationsUsageQueryDto {
  groupBy?: unknown
  actorId?: unknown
  eventType?: unknown
  outcome?: unknown
}

@Controller('advisory/admin/operations')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class AdvisoryOperationsController {
  constructor(
    private readonly advisoryOperationsService: AdvisoryOperationsService,
    @Optional()
    private readonly advisoryProviderTelemetryService?: AdvisoryProviderTelemetryService,
    @Optional()
    private readonly advisoryQualityFeedbackService?: AdvisoryQualityFeedbackService,
    @Optional()
    private readonly advisoryGovernanceService?: AdvisoryGovernanceService,
  ) {}

  @Get('usage')
  @Roles(UserRole.ADMIN)
  async getUsage(
    @CurrentUser() actor: AdvisoryOperationsActor,
    @CurrentTenant() currentTenantId: string,
    @Query() query: AdvisoryOperationsUsageQueryDto,
  ) {
    const defaults = this.defaultWindow()
    const requestedTenantId = this.resolveRequestedTenantId(query.tenantId, currentTenantId)
    const dateFrom = this.readOptionalQueryString(query.dateFrom, 'dateFrom') ?? defaults.dateFrom
    const dateTo = this.readOptionalQueryString(query.dateTo, 'dateTo') ?? defaults.dateTo

    return {
      data: await this.advisoryOperationsService.getUsageDashboard({
        actor,
        currentTenantId,
        tenantId: requestedTenantId,
        dateFrom,
        dateTo,
        workflowType: this.readOptionalQueryString(query.workflowType, 'workflowType'),
      }),
    }
  }

  @Get('provider-telemetry')
  @Roles(UserRole.ADMIN)
  async getProviderTelemetry(
    @CurrentUser() actor: AdvisoryOperationsActor,
    @CurrentTenant() currentTenantId: string,
    @Query() query: AdvisoryProviderTelemetryQueryDto,
  ) {
    const providerTelemetryService = this.requireProviderTelemetryService()
    const defaults = this.defaultWindow()
    const requestedTenantId = this.resolveRequestedTenantId(query.tenantId, currentTenantId)
    const dateFrom = this.readOptionalQueryString(query.dateFrom, 'dateFrom') ?? defaults.dateFrom
    const dateTo = this.readOptionalQueryString(query.dateTo, 'dateTo') ?? defaults.dateTo
    this.assertValidDateWindow(dateFrom, dateTo)

    return {
      data: await providerTelemetryService.getProviderTelemetry({
        actor,
        currentTenantId,
        tenantId: requestedTenantId,
        dateFrom,
        dateTo,
        workflowType: this.readOptionalQueryString(query.workflowType, 'workflowType'),
        groupBy: this.parseGroupBy(query.groupBy),
      }),
    }
  }

  @Get('quality-feedback')
  @Roles(UserRole.ADMIN)
  async getQualityFeedback(
    @CurrentUser() actor: AdvisoryOperationsActor,
    @CurrentTenant() currentTenantId: string,
    @Query() query: AdvisoryQualityFeedbackQueryDto,
  ) {
    const qualityFeedbackService = this.requireQualityFeedbackService()
    const defaults = this.defaultWindow()
    const requestedTenantId = this.resolveRequestedTenantId(query.tenantId, currentTenantId)
    const dateFrom = this.readOptionalQueryString(query.dateFrom, 'dateFrom') ?? defaults.dateFrom
    const dateTo = this.readOptionalQueryString(query.dateTo, 'dateTo') ?? defaults.dateTo
    this.assertValidDateWindow(dateFrom, dateTo)

    return {
      data: await qualityFeedbackService.getQualityFeedback({
        actor,
        currentTenantId,
        tenantId: requestedTenantId,
        dateFrom,
        dateTo,
        workflowType: this.readOptionalQueryString(query.workflowType, 'workflowType'),
        recommendationType: this.readOptionalQueryString(
          query.recommendationType,
          'recommendationType',
        ),
        groupBy: this.parseQualityGroupBy(query.groupBy),
        timeBucket: this.parseQualityTimeBucket(query.timeBucket),
      }),
    }
  }

  @Get('governance')
  @Roles(UserRole.ADMIN)
  async getGovernance(
    @CurrentUser() actor: AdvisoryOperationsActor,
    @CurrentTenant() currentTenantId: string,
    @Query() query: AdvisoryGovernanceQueryDto,
  ) {
    const governanceService = this.requireGovernanceService()
    const defaults = this.defaultWindow()
    const requestedTenantId = this.resolveRequestedTenantId(query.tenantId, currentTenantId)
    const dateFrom = this.readOptionalQueryString(query.dateFrom, 'dateFrom') ?? defaults.dateFrom
    const dateTo = this.readOptionalQueryString(query.dateTo, 'dateTo') ?? defaults.dateTo
    this.assertValidDateWindow(dateFrom, dateTo)

    return {
      data: await governanceService.getGovernanceReview({
        actor,
        currentTenantId,
        tenantId: requestedTenantId,
        dateFrom,
        dateTo,
        workflowType: this.readOptionalGovernanceFilter(query.workflowType, 'workflowType'),
        actorId: this.readOptionalGovernanceFilter(query.actorId, 'actorId'),
        eventType: this.readOptionalGovernanceFilter(query.eventType, 'eventType'),
        outcome: this.readOptionalGovernanceFilter(query.outcome, 'outcome'),
        groupBy: this.parseGovernanceGroupBy(query.groupBy),
      }),
    }
  }

  private resolveRequestedTenantId(tenantId: unknown, currentTenantId: string): string {
    const requestedTenantId = this.readOptionalQueryString(tenantId, 'tenantId')
    if (!requestedTenantId || requestedTenantId === 'current') {
      return currentTenantId
    }
    if (requestedTenantId !== currentTenantId) {
      throw new ForbiddenException('当前账号无权查看其他租户的 ThinkTank 运营数据。')
    }
    return requestedTenantId
  }

  private defaultWindow() {
    const dateTo = new Date()
    const dateFrom = new Date(dateTo.getTime() - 30 * 24 * 60 * 60 * 1000)
    return {
      dateFrom: dateFrom.toISOString(),
      dateTo: dateTo.toISOString(),
    }
  }

  private requireProviderTelemetryService(): AdvisoryProviderTelemetryService {
    if (!this.advisoryProviderTelemetryService) {
      throw new Error('AdvisoryProviderTelemetryService is not configured.')
    }
    return this.advisoryProviderTelemetryService
  }

  private requireQualityFeedbackService(): AdvisoryQualityFeedbackService {
    if (!this.advisoryQualityFeedbackService) {
      throw new Error('AdvisoryQualityFeedbackService is not configured.')
    }
    return this.advisoryQualityFeedbackService
  }

  private requireGovernanceService(): AdvisoryGovernanceService {
    if (!this.advisoryGovernanceService) {
      throw new Error('AdvisoryGovernanceService is not configured.')
    }
    return this.advisoryGovernanceService
  }

  private parseGroupBy(value: unknown): AdvisoryProviderTelemetryGroupBy[] {
    const allowed = new Set<AdvisoryProviderTelemetryGroupBy>([
      'workflow',
      'experience',
      'provider',
    ])
    if (value === undefined || value === null || value === '') return []
    if (typeof value !== 'string' && !Array.isArray(value)) {
      throw new BadRequestException('Invalid groupBy filter.')
    }
    const values = Array.isArray(value)
      ? value.map((item) => this.requireQueryString(item, 'groupBy'))
      : [value]
    const parsed = values
      .flatMap((item) => item.split(','))
      .map((item) => item.trim())
      .filter(Boolean)
    const invalid = parsed.filter((item) => !allowed.has(item as AdvisoryProviderTelemetryGroupBy))
    if (invalid.length) {
      throw new BadRequestException('Invalid groupBy filter.')
    }
    return [
      ...new Set(
        parsed.filter((item): item is AdvisoryProviderTelemetryGroupBy =>
          allowed.has(item as AdvisoryProviderTelemetryGroupBy),
        ),
      ),
    ]
  }

  private parseQualityGroupBy(value: unknown): AdvisoryQualityFeedbackGroupBy[] {
    const allowed = new Set<AdvisoryQualityFeedbackGroupBy>([
      'workflow',
      'recommendationType',
      'tenant',
      'time',
    ])
    if (value === undefined || value === null || value === '') return []
    if (typeof value !== 'string' && !Array.isArray(value)) {
      throw new BadRequestException('Invalid groupBy filter.')
    }
    const values = Array.isArray(value)
      ? value.map((item) => this.requireQueryString(item, 'groupBy'))
      : [value]
    const parsed = values
      .flatMap((item) => item.split(','))
      .map((item) => item.trim())
      .filter(Boolean)
    const invalid = parsed.filter((item) => !allowed.has(item as AdvisoryQualityFeedbackGroupBy))
    if (invalid.length) {
      throw new BadRequestException('Invalid groupBy filter.')
    }
    return [
      ...new Set(
        parsed.filter((item): item is AdvisoryQualityFeedbackGroupBy =>
          allowed.has(item as AdvisoryQualityFeedbackGroupBy),
        ),
      ),
    ]
  }

  private parseQualityTimeBucket(value: unknown): AdvisoryQualityFeedbackTimeBucket | undefined {
    const text = this.readOptionalQueryString(value, 'timeBucket')
    if (!text) return undefined
    if (text === 'day' || text === 'week' || text === 'month') return text
    throw new BadRequestException('Invalid timeBucket filter.')
  }

  private parseGovernanceGroupBy(value: unknown): AdvisoryGovernanceGroupBy[] {
    const allowed = new Set<AdvisoryGovernanceGroupBy>([
      'eventType',
      'outcome',
      'actor',
      'workflow',
    ])
    if (value === undefined || value === null || value === '') return []
    if (typeof value !== 'string') {
      throw new BadRequestException('Invalid groupBy filter.')
    }
    const parsed = value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
    const invalid = parsed.filter((item) => !allowed.has(item as AdvisoryGovernanceGroupBy))
    if (invalid.length) {
      throw new BadRequestException('Invalid groupBy filter.')
    }
    return [
      ...new Set(
        parsed.filter((item): item is AdvisoryGovernanceGroupBy =>
          allowed.has(item as AdvisoryGovernanceGroupBy),
        ),
      ),
    ]
  }

  private assertValidDateWindow(dateFrom: string, dateTo: string): void {
    const from = this.parseQueryDate(dateFrom, 'from')
    const to = this.parseQueryDate(dateTo, 'to')
    if (from > to) {
      throw new BadRequestException('dateFrom must be before dateTo.')
    }
    if (to.getTime() - from.getTime() > MAX_PROVIDER_TELEMETRY_WINDOW_DAYS * 24 * 60 * 60 * 1000) {
      throw new BadRequestException(
        `date window must not exceed ${MAX_PROVIDER_TELEMETRY_WINDOW_DAYS} days.`,
      )
    }
  }

  private parseQueryDate(value: string, boundary: 'from' | 'to'): Date {
    const text = this.requireQueryString(value, boundary === 'from' ? 'dateFrom' : 'dateTo')
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(text)
    const parsed = isDateOnly ? this.parseStrictDateOnly(text, boundary) : new Date(text)
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Invalid date filter.')
    }
    return parsed
  }

  private readOptionalQueryString(value: unknown, fieldName: string): string | undefined {
    if (value === undefined || value === null || value === '') return undefined
    return this.requireQueryString(value, fieldName)
  }

  private readOptionalGovernanceFilter(value: unknown, fieldName: string): string | undefined {
    const text = this.readOptionalQueryString(value, fieldName)
    if (!text || text === 'all' || text === 'current') return text
    if (!this.isSafeGovernanceQueryText(text)) {
      throw new BadRequestException(`Invalid ${fieldName} filter.`)
    }
    if (fieldName === 'eventType' && !GOVERNANCE_EVENT_NAME_SET.has(text)) {
      throw new BadRequestException('Invalid eventType filter.')
    }
    if (fieldName === 'outcome' && !GOVERNANCE_OUTCOME_SET.has(text)) {
      throw new BadRequestException('Invalid outcome filter.')
    }
    return text
  }

  private requireQueryString(value: unknown, fieldName: string): string {
    if (Array.isArray(value) || typeof value !== 'string') {
      throw new BadRequestException(`Invalid ${fieldName} filter.`)
    }
    const trimmed = value.trim()
    if (!trimmed) {
      throw new BadRequestException(`Invalid ${fieldName} filter.`)
    }
    return trimmed
  }

  private isSafeGovernanceQueryText(value: string): boolean {
    return Boolean(
      value.length <= 128 &&
      /^[a-z0-9][a-z0-9_.:-]{0,127}$/i.test(value) &&
      !/PRIVATE_|raw[_\s-]*(conversation|content|prompt|report|feedback|provider|payload)|provider[_\s-]*(raw|payload)|cache[_\s-]*key|conversation|prompt|message|report content|feedback/i.test(
        value,
      ),
    )
  }

  private parseStrictDateOnly(value: string, boundary: 'from' | 'to'): Date {
    const [yearText, monthText, dayText] = value.split('-')
    const year = Number(yearText)
    const month = Number(monthText)
    const day = Number(dayText)
    const parsed = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, boundary === 'to' ? 999 : 0))
    if (
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() !== month - 1 ||
      parsed.getUTCDate() !== day
    ) {
      throw new BadRequestException('Invalid date filter.')
    }
    if (boundary === 'to') {
      parsed.setUTCHours(23, 59, 59, 999)
    }
    return parsed
  }
}
