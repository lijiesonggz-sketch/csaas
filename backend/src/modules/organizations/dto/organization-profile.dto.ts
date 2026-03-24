import { IsBoolean, IsIn, IsOptional, IsObject } from 'class-validator'
import {
  ORG_PROFILE_ASSET_BUCKETS,
  ORG_PROFILE_CIIO_STATUSES,
  ORG_PROFILE_CRITICAL_SYSTEM_LEVELS,
  ORG_PROFILE_IMPORTANT_DATA_STATUSES,
  ORG_PROFILE_INDUSTRIES,
  ORG_PROFILE_LEGAL_PERSON_TYPES,
  ORG_PROFILE_OUTSOURCING_LEVELS,
  ORG_PROFILE_PUBLIC_SERVICE_SCOPES,
  ORG_PROFILE_REGULATORY_ATTENTION_LEVELS,
} from '../../../constants/org-profile-enums'

export class UpsertOrganizationProfileDto {
  @IsIn(ORG_PROFILE_INDUSTRIES)
  industry: (typeof ORG_PROFILE_INDUSTRIES)[number]

  @IsIn(ORG_PROFILE_LEGAL_PERSON_TYPES)
  legalPersonType: (typeof ORG_PROFILE_LEGAL_PERSON_TYPES)[number]

  @IsIn(ORG_PROFILE_ASSET_BUCKETS)
  assetBucket: (typeof ORG_PROFILE_ASSET_BUCKETS)[number]

  @IsBoolean()
  hasPersonalInfo: boolean

  @IsBoolean()
  crossBorderData: boolean

  @IsIn(ORG_PROFILE_IMPORTANT_DATA_STATUSES)
  importantDataStatus: (typeof ORG_PROFILE_IMPORTANT_DATA_STATUSES)[number]

  @IsIn(ORG_PROFILE_CIIO_STATUSES)
  ciioStatus: (typeof ORG_PROFILE_CIIO_STATUSES)[number]

  @IsBoolean()
  hasDatacenter: boolean

  @IsBoolean()
  usesCloud: boolean

  @IsIn(ORG_PROFILE_OUTSOURCING_LEVELS)
  outsourcingLevel: (typeof ORG_PROFILE_OUTSOURCING_LEVELS)[number]

  @IsIn(ORG_PROFILE_CRITICAL_SYSTEM_LEVELS)
  criticalSystemLevel: (typeof ORG_PROFILE_CRITICAL_SYSTEM_LEVELS)[number]

  @IsBoolean()
  hasOnlineTrading: boolean

  @IsBoolean()
  hasAiServices: boolean

  @IsIn(ORG_PROFILE_PUBLIC_SERVICE_SCOPES)
  publicServiceScope: (typeof ORG_PROFILE_PUBLIC_SERVICE_SCOPES)[number]

  @IsIn(ORG_PROFILE_REGULATORY_ATTENTION_LEVELS)
  regulatoryAttentionLevel: (typeof ORG_PROFILE_REGULATORY_ATTENTION_LEVELS)[number]

  @IsBoolean()
  recentMajorIncident: boolean

  @IsOptional()
  @IsObject()
  extendedProfile?: Record<string, unknown>
}
