import { describe, it, expect } from '@jest/globals'
import {
  WeaknessCategory,
  WEAKNESS_CATEGORY_DISPLAY,
  isValidWeaknessCategory,
  getCategoryDisplayName,
  parseDisplayNameToCategory,
  WEAKNESS_CATEGORY_DESCRIPTIONS,
} from '../constants/categories'

describe('WeaknessCategory', () => {
  describe('Enum values', () => {
    it('should have 8 category values', () => {
      const categories = Object.values(WeaknessCategory)
      expect(categories).toHaveLength(8)

      // Verify all categories have corresponding display names
      categories.forEach((category) => {
        expect(WEAKNESS_CATEGORY_DISPLAY[category]).toBeDefined()
      })
    })

    it('should use snake_case values', () => {
      expect(WeaknessCategory.DATA_SECURITY).toBe('data_security')
      expect(WeaknessCategory.CLOUD_NATIVE).toBe('cloud_native')
      expect(WeaknessCategory.AI_APPLICATION).toBe('ai_application')
      expect(WeaknessCategory.MOBILE_FINANCIAL).toBe('mobile_financial')
      expect(WeaknessCategory.DEVOPS).toBe('devops')
      expect(WeaknessCategory.COST_OPTIMIZATION).toBe('cost_optimization')
      expect(WeaknessCategory.COMPLIANCE).toBe('compliance')
    })
  })

  describe('WEAKNESS_CATEGORY_DISPLAY', () => {
    it('should provide Chinese display names for all categories', () => {
      expect(WEAKNESS_CATEGORY_DISPLAY[WeaknessCategory.DATA_SECURITY]).toBe('数据安全')
      expect(WEAKNESS_CATEGORY_DISPLAY[WeaknessCategory.NETWORK_SECURITY]).toBe('网络安全')
      expect(WEAKNESS_CATEGORY_DISPLAY[WeaknessCategory.CLOUD_NATIVE]).toBe('云原生')
      expect(WEAKNESS_CATEGORY_DISPLAY[WeaknessCategory.AI_APPLICATION]).toBe('AI应用')
      expect(WEAKNESS_CATEGORY_DISPLAY[WeaknessCategory.MOBILE_FINANCIAL]).toBe('移动金融安全')
      expect(WEAKNESS_CATEGORY_DISPLAY[WeaknessCategory.DEVOPS]).toBe('DevOps')
      expect(WEAKNESS_CATEGORY_DISPLAY[WeaknessCategory.COST_OPTIMIZATION]).toBe('成本优化')
      expect(WEAKNESS_CATEGORY_DISPLAY[WeaknessCategory.COMPLIANCE]).toBe('合规管理')
    })

    it('should have display names for all enum values', () => {
      const categories = Object.values(WeaknessCategory)
      categories.forEach((category) => {
        expect(WEAKNESS_CATEGORY_DISPLAY[category]).toBeDefined()
        expect(WEAKNESS_CATEGORY_DISPLAY[category]).not.toBe('')
      })
    })
  })

  describe('isValidWeaknessCategory', () => {
    it('should return true for valid category values', () => {
      expect(isValidWeaknessCategory('data_security')).toBe(true)
      expect(isValidWeaknessCategory('cloud_native')).toBe(true)
      expect(isValidWeaknessCategory('ai_application')).toBe(true)
      expect(isValidWeaknessCategory('compliance')).toBe(true)
    })

    it('should return false for invalid category values', () => {
      expect(isValidWeaknessCategory('invalid_category')).toBe(false)
      expect(isValidWeaknessCategory('')).toBe(false)
      expect(isValidWeaknessCategory('Data_Security')).toBe(false) // Not snake_case
    })
  })

  describe('getCategoryDisplayName', () => {
    it('should return Chinese display name for valid categories', () => {
      expect(getCategoryDisplayName(WeaknessCategory.DATA_SECURITY)).toBe('数据安全')
      expect(getCategoryDisplayName(WeaknessCategory.COMPLIANCE)).toBe('合规管理')
    })

    it('should return original value if category not found', () => {
      expect(getCategoryDisplayName('invalid' as any)).toBe('invalid')
    })
  })

  describe('parseDisplayNameToCategory', () => {
    it('should parse Chinese display names to category enums', () => {
      expect(parseDisplayNameToCategory('数据安全')).toBe(WeaknessCategory.DATA_SECURITY)
      expect(parseDisplayNameToCategory('合规管理')).toBe(WeaknessCategory.COMPLIANCE)
      expect(parseDisplayNameToCategory('DevOps')).toBe(WeaknessCategory.DEVOPS)
    })

    it('should return undefined for unknown display names', () => {
      expect(parseDisplayNameToCategory('unknown')).toBeUndefined()
    })
  })

  describe('WEAKNESS_CATEGORY_DESCRIPTIONS', () => {
    it('should provide descriptions for all categories', () => {
      const categories = Object.values(WeaknessCategory)
      categories.forEach((category) => {
        expect(WEAKNESS_CATEGORY_DESCRIPTIONS[category]).toBeDefined()
        expect(WEAKNESS_CATEGORY_DESCRIPTIONS[category]).not.toBe('')
      })
    })

    it('should have descriptions with reasonable length', () => {
      const descriptions = Object.values(WEAKNESS_CATEGORY_DESCRIPTIONS)
      descriptions.forEach((desc) => {
        expect(desc.length).toBeGreaterThan(10)
        expect(desc.length).toBeLessThan(200)
      })
    })
  })
})
