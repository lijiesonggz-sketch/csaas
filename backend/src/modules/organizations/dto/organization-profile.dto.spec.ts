import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { UpsertOrganizationProfileDto } from './organization-profile.dto'

describe('UpsertOrganizationProfileDto', () => {
  const validPayload = {
    industry: 'bank',
    legalPersonType: 'legal_person',
    assetBucket: 'large',
    hasPersonalInfo: true,
    crossBorderData: false,
    importantDataStatus: 'unknown',
    ciioStatus: 'no',
    hasDatacenter: true,
    usesCloud: true,
    outsourcingLevel: 'medium',
    criticalSystemLevel: 'high',
    hasOnlineTrading: true,
    hasAiServices: false,
    publicServiceScope: 'public_users',
    regulatoryAttentionLevel: 'medium',
    recentMajorIncident: false,
  }

  it('should validate a complete valid payload', async () => {
    const dto = plainToInstance(UpsertOrganizationProfileDto, validPayload)

    const errors = await validate(dto as object)

    expect(errors).toHaveLength(0)
  })

  it('should fail when required fields are missing', async () => {
    const dto = plainToInstance(UpsertOrganizationProfileDto, {
      industry: 'bank',
    })

    const errors = await validate(dto as object)
    const properties = errors.map((error) => error.property)

    expect(properties).toContain('legalPersonType')
    expect(properties).toContain('assetBucket')
    expect(properties).toContain('hasPersonalInfo')
  })

  it('should fail when enum-like fields use unsupported values', async () => {
    const dto = plainToInstance(UpsertOrganizationProfileDto, {
      ...validPayload,
      industry: 'crypto-bank',
      outsourcingLevel: 'extreme',
    })

    const errors = await validate(dto as object)
    const properties = errors.map((error) => error.property)

    expect(properties).toContain('industry')
    expect(properties).toContain('outsourcingLevel')
  })

  it('should fail when boolean fields use invalid types', async () => {
    const dto = plainToInstance(UpsertOrganizationProfileDto, {
      ...validPayload,
      hasPersonalInfo: 'true',
      usesCloud: 1,
      recentMajorIncident: 'no',
    })

    const errors = await validate(dto as object)
    const properties = errors.map((error) => error.property)

    expect(properties).toContain('hasPersonalInfo')
    expect(properties).toContain('usesCloud')
    expect(properties).toContain('recentMajorIncident')
  })
})
