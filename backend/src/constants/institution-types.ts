/**
 * Institution Type Registry
 *
 * Single source of truth for industry classifications and institution types.
 * Supports multi-industry SaaS architecture for banking, securities, insurance, and enterprise sectors.
 */

export const INSTITUTION_TYPE_REGISTRY = {
  banking: {
    displayName: '银行业',
    types: ['城商行', '股份制银行', '互联网银行', '国有大行', '农商行'],
  },
  securities: {
    displayName: '证券业',
    types: ['券商', '基金公司', '期货公司'],
  },
  insurance: {
    displayName: '保险业',
    types: ['寿险公司', '财险公司', '再保险公司'],
  },
  enterprise: {
    displayName: '传统企业',
    types: ['制造业', '零售业', '物流业', '能源企业'],
  },
} as const

export type Industry = keyof typeof INSTITUTION_TYPE_REGISTRY
export type InstitutionType = string

/**
 * Get the display name for an industry
 * @param industry - Industry key
 * @returns Display name in Chinese
 */
export function getIndustryDisplayName(industry: Industry): string {
  return INSTITUTION_TYPE_REGISTRY[industry]?.displayName || industry
}

/**
 * Get all institution types for a specific industry
 * @param industry - Industry key
 * @returns Array of institution type strings
 */
export function getInstitutionTypes(industry: Industry): readonly string[] {
  return INSTITUTION_TYPE_REGISTRY[industry]?.types || []
}

/**
 * Validate if an institution type is valid for a given industry
 * @param industry - Industry key
 * @param type - Institution type to validate
 * @returns True if valid, false otherwise
 */
export function validateInstitutionType(industry: Industry, type: string): boolean {
  const types = getInstitutionTypes(industry)
  return types.includes(type)
}

/**
 * Get all available industries
 * @returns Array of industry keys
 */
export function getAllIndustries(): Industry[] {
  return Object.keys(INSTITUTION_TYPE_REGISTRY) as Industry[]
}

/**
 * Check if a string is a valid industry
 * @param value - String to check
 * @returns True if valid industry, false otherwise
 */
export function isValidIndustry(value: string): value is Industry {
  return value in INSTITUTION_TYPE_REGISTRY
}
