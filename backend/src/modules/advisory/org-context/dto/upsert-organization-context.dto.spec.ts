import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import {
  ORGANIZATION_CONTEXT_NAME_MAX_LENGTH,
  ORGANIZATION_CONTEXT_OPTIONAL_FIELD_MAX_LENGTH,
  UpsertOrganizationContextDto,
} from './upsert-organization-context.dto'

describe('UpsertOrganizationContextDto', () => {
  it('trims string fields before max-length validation', async () => {
    const dto = plainToInstance(UpsertOrganizationContextDto, {
      organizationName: `  ${'A'.repeat(ORGANIZATION_CONTEXT_NAME_MAX_LENGTH)}  `,
      industry: `  ${'B'.repeat(ORGANIZATION_CONTEXT_OPTIONAL_FIELD_MAX_LENGTH)}  `,
      size: `  ${'C'.repeat(ORGANIZATION_CONTEXT_OPTIONAL_FIELD_MAX_LENGTH)}  `,
    })

    await expect(validate(dto)).resolves.toEqual([])
    expect(dto.organizationName).toBe('A'.repeat(ORGANIZATION_CONTEXT_NAME_MAX_LENGTH))
    expect(dto.industry).toBe('B'.repeat(ORGANIZATION_CONTEXT_OPTIONAL_FIELD_MAX_LENGTH))
    expect(dto.size).toBe('C'.repeat(ORGANIZATION_CONTEXT_OPTIONAL_FIELD_MAX_LENGTH))
  })

  it('normalizes internal whitespace and control-only formatting before validation', async () => {
    const dto = plainToInstance(UpsertOrganizationContextDto, {
      organizationName: '  Tenant\nA\u200b Security\tGroup  ',
      industry: '  Data\nsecurity  ',
      size: '\u200b201-500\u200c',
    })

    await expect(validate(dto)).resolves.toEqual([])
    expect(dto.organizationName).toBe('Tenant A Security Group')
    expect(dto.industry).toBe('Data security')
    expect(dto.size).toBe('201-500')
  })
})
