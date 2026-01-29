/**
 * Content Constants
 * Story 3.1: Industry Radar Configuration
 *
 * Constants for content field lengths and limits
 */

/**
 * Maximum length for contentType field
 */
export const MAX_CONTENT_TYPE_LENGTH = 50

/**
 * Maximum length for peerName field
 */
export const MAX_PEER_NAME_LENGTH = 255

/**
 * Maximum number of tech keywords to extract
 */
export const MAX_TECH_KEYWORDS = 20

/**
 * Maximum length for a single tech keyword
 */
export const MAX_TECH_KEYWORD_LENGTH = 50

/**
 * Minimum length for a valid tech keyword
 */
export const MIN_TECH_KEYWORD_LENGTH = 2

/**
 * Maximum length for technical effect description
 */
export const MAX_EFFECT_DESCRIPTION_LENGTH = 100

/**
 * Valid content types
 */
export const VALID_CONTENT_TYPES = ['article', 'recruitment', 'conference'] as const

export type ContentType = (typeof VALID_CONTENT_TYPES)[number]
