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
 * Valid content types
 */
export const VALID_CONTENT_TYPES = ['article', 'recruitment', 'conference'] as const

export type ContentType = (typeof VALID_CONTENT_TYPES)[number]
