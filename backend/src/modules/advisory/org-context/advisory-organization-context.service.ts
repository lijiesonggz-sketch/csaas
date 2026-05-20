import { BadRequestException, Injectable } from '@nestjs/common'
import {
  ADVISORY_ORGANIZATION_CONTEXT_ENTERPRISE_BACKGROUND,
  AdvisoryOrganizationContext,
  AdvisoryOrganizationContextCompletenessMetadata,
  AdvisoryOrganizationContextData,
} from '../../../database/entities/advisory-organization-context.entity'
import {
  ORGANIZATION_CONTEXT_NAME_MAX_LENGTH,
  ORGANIZATION_CONTEXT_OPTIONAL_FIELD_MAX_LENGTH,
} from './dto/upsert-organization-context.dto'
import { AdvisoryOrganizationContextRepository } from './advisory-organization-context.repository'
import { AdvisoryAccessService, AdvisoryAccessUser } from '../access/advisory-access.service'

export interface AdvisoryOrganizationContextCompletenessResponse {
  requiredFieldsComplete: boolean
  missingFields: string[]
  updatedAt: string | null
}

export interface AdvisoryOrganizationPromptContext {
  contextId: string
  organizationName: string
  industry: string | null
  size: string | null
  completenessScore: number
  completeness: AdvisoryOrganizationContextCompletenessResponse
}

export interface AdvisoryOrganizationContextResponse extends AdvisoryOrganizationPromptContext {
  id: string
  appliedToPrompts: boolean
}

export interface AdvisoryOrganizationFirstUseResponse {
  context: null
  completenessScore: 0
  completeness: AdvisoryOrganizationContextCompletenessResponse
  appliedToPrompts: false
}

export interface AdvisoryOrganizationContextRequest {
  user: AdvisoryAccessUser
  tenantId: string
}

export interface UpsertAdvisoryOrganizationContextRequest extends AdvisoryOrganizationContextRequest {
  organizationName: unknown
  industry?: unknown
  size?: unknown
}

const CONTEXT_FIELDS = ['organizationName', 'industry', 'size'] as const

@Injectable()
export class AdvisoryOrganizationContextService {
  constructor(
    private readonly repository: AdvisoryOrganizationContextRepository,
    private readonly accessService: AdvisoryAccessService,
  ) {}

  async getOrganizationContext(
    request: AdvisoryOrganizationContextRequest,
  ): Promise<AdvisoryOrganizationContextResponse | AdvisoryOrganizationFirstUseResponse> {
    this.requireTenantAndActor(request)
    await this.accessService.assertThinkTankModuleAvailable(request.user, request.tenantId)
    const context = await this.repository.findEnterpriseBackground(request.tenantId)
    const response = context ? this.toResponse(context) : null

    return response ?? this.buildNoContextResponse()
  }

  async upsertOrganizationContext(
    request: UpsertAdvisoryOrganizationContextRequest,
  ): Promise<AdvisoryOrganizationContextResponse> {
    this.requireTenantAndActor(request)
    await this.accessService.assertThinkTankModuleAvailable(request.user, request.tenantId)
    const contextData = this.normalizeContextData(request)
    const completeness = this.buildCompleteness(contextData)
    const payload = {
      contextType: ADVISORY_ORGANIZATION_CONTEXT_ENTERPRISE_BACKGROUND,
      contextData,
      completenessScore: completeness.score,
      completenessMetadata: completeness.metadata,
    }
    const existing = await this.repository.findEnterpriseBackground(request.tenantId)
    const saved = existing
      ? await this.repository.updateEnterpriseBackground(request.tenantId, existing.id, payload)
      : await this.createOrUpdateAfterConcurrentInsert(request.tenantId, payload)

    if (!saved) {
      throw new BadRequestException('Organization context is not available for update.')
    }

    const response = this.toResponse(saved)
    if (!response) {
      throw new BadRequestException('Organization context is not available after save.')
    }

    return response
  }

  async getPromptContext(tenantId: string): Promise<AdvisoryOrganizationPromptContext | null> {
    this.requireText(tenantId, 'tenantId')
    const context = await this.repository.findEnterpriseBackground(tenantId)

    return context ? this.toPromptContext(context) : null
  }

  private async createOrUpdateAfterConcurrentInsert(
    tenantId: string,
    payload: Partial<AdvisoryOrganizationContext>,
  ): Promise<AdvisoryOrganizationContext | null> {
    try {
      return await this.repository.createEnterpriseBackground(tenantId, payload)
    } catch (error) {
      if (!isUniqueConstraintViolation(error)) {
        throw error
      }

      const existing = await this.repository.findEnterpriseBackground(tenantId)
      return existing
        ? this.repository.updateEnterpriseBackground(tenantId, existing.id, payload)
        : null
    }
  }

  private normalizeContextData(
    request: UpsertAdvisoryOrganizationContextRequest,
  ): AdvisoryOrganizationContextData {
    return {
      organizationName: this.requireOrganizationName(request.organizationName),
      industry: this.normalizeOptionalField(request.industry, 'industry'),
      size: this.normalizeOptionalField(request.size, 'size'),
    }
  }

  private buildCompleteness(contextData: AdvisoryOrganizationContextData): {
    score: number
    metadata: AdvisoryOrganizationContextCompletenessMetadata
  } {
    const suppliedFields = CONTEXT_FIELDS.filter((field) => {
      const value = contextData[field]
      return typeof value === 'string' && value.trim().length > 0
    })
    const missingFields = CONTEXT_FIELDS.filter((field) => !suppliedFields.includes(field))

    return {
      score: Math.round((suppliedFields.length / CONTEXT_FIELDS.length) * 100),
      metadata: {
        requiredFieldsComplete: true,
        suppliedFields: [...suppliedFields],
        missingFields: [...missingFields],
        updatedAt: new Date().toISOString(),
      },
    }
  }

  private toResponse(
    context: AdvisoryOrganizationContext,
  ): AdvisoryOrganizationContextResponse | null {
    const promptContext = this.toPromptContext(context)
    if (!promptContext) return null

    return {
      ...promptContext,
      id: context.id,
      appliedToPrompts: false,
    }
  }

  private toPromptContext(
    context: AdvisoryOrganizationContext,
  ): AdvisoryOrganizationPromptContext | null {
    const contextData = context.contextData ?? {
      organizationName: '',
      industry: null,
      size: null,
    }
    const organizationName =
      typeof contextData.organizationName === 'string' ? contextData.organizationName.trim() : ''
    if (!organizationName || !hasVisibleText(organizationName)) {
      return null
    }

    return {
      contextId: context.id,
      organizationName,
      industry: this.normalizeOptionalField(contextData.industry, 'industry'),
      size: this.normalizeOptionalField(contextData.size, 'size'),
      completenessScore: context.completenessScore,
      completeness: {
        requiredFieldsComplete: context.completenessMetadata?.requiredFieldsComplete === true,
        missingFields: Array.isArray(context.completenessMetadata?.missingFields)
          ? context.completenessMetadata.missingFields
          : [],
        updatedAt: this.toIsoDate(context.updatedAt),
      },
    }
  }

  private requireOrganizationName(value: unknown): string {
    const organizationName = this.normalizeOptionalText(value)
    if (!organizationName || !hasVisibleText(organizationName)) {
      throw new BadRequestException('organizationName is required.')
    }
    if (organizationName.length > ORGANIZATION_CONTEXT_NAME_MAX_LENGTH) {
      throw new BadRequestException(
        `organizationName must be ${ORGANIZATION_CONTEXT_NAME_MAX_LENGTH} characters or fewer.`,
      )
    }

    return organizationName
  }

  private normalizeOptionalField(value: unknown, fieldName: 'industry' | 'size'): string | null {
    const text = this.normalizeOptionalText(value)
    if (!text || !hasVisibleText(text)) return null
    if (text.length > ORGANIZATION_CONTEXT_OPTIONAL_FIELD_MAX_LENGTH) {
      throw new BadRequestException(
        `${fieldName} must be ${ORGANIZATION_CONTEXT_OPTIONAL_FIELD_MAX_LENGTH} characters or fewer.`,
      )
    }

    return text
  }

  private buildNoContextResponse(): AdvisoryOrganizationFirstUseResponse {
    return {
      context: null,
      completenessScore: 0,
      completeness: {
        requiredFieldsComplete: false,
        missingFields: [...CONTEXT_FIELDS],
        updatedAt: null,
      },
      appliedToPrompts: false,
    }
  }

  private requireTenantAndActor(request: AdvisoryOrganizationContextRequest): void {
    this.requireText(request.tenantId, 'tenantId')
    this.requireText(request.user?.id, 'actorId')
  }

  private requireText(value: unknown, fieldName: string): string {
    const text = this.normalizeOptionalText(value)
    if (!text) {
      throw new BadRequestException(`${fieldName} is required.`)
    }

    return text
  }

  private normalizeOptionalText(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined
    const text = normalizeOrganizationContextText(value)
    return text.length > 0 ? text : undefined
  }

  private toIsoDate(value: Date | string | undefined | null): string | null {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toISOString()
    }
    if (typeof value === 'string' && value.trim().length > 0) {
      return value
    }

    return null
  }
}

function hasVisibleText(value: string): boolean {
  return normalizeOrganizationContextText(value).length > 0
}

function normalizeOrganizationContextText(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/\p{C}+/gu, '')
    .trim()
}

function isUniqueConstraintViolation(error: unknown): boolean {
  const record = error as {
    code?: unknown
    driverError?: { code?: unknown }
  }
  return record?.code === '23505' || record?.driverError?.code === '23505'
}
