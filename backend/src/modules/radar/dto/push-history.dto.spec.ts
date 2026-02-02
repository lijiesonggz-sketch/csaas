import 'reflect-metadata'
import { validate } from 'class-validator'
import { plainToClass } from 'class-transformer'
import { QueryPushHistoryDto } from './push-history.dto'

describe('QueryPushHistoryDto', () => {
  describe('radarType validation', () => {
    it('should accept valid radar types', async () => {
      const validTypes = ['tech', 'industry', 'compliance']

      for (const type of validTypes) {
        const dto = plainToClass(QueryPushHistoryDto, { radarType: type })
        const errors = await validate(dto)
        expect(errors.length).toBe(0)
      }
    })

    it('should reject invalid radar types', async () => {
      const dto = plainToClass(QueryPushHistoryDto, { radarType: 'invalid' })
      const errors = await validate(dto)
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0].property).toBe('radarType')
    })

    it('should allow radarType to be optional', async () => {
      const dto = plainToClass(QueryPushHistoryDto, {})
      const errors = await validate(dto)
      const radarTypeErrors = errors.filter((e) => e.property === 'radarType')
      expect(radarTypeErrors.length).toBe(0)
    })
  })

  describe('timeRange validation', () => {
    it('should accept valid time ranges', async () => {
      const validRanges = ['7d', '30d', '90d', 'all']

      for (const range of validRanges) {
        const dto = plainToClass(QueryPushHistoryDto, { timeRange: range })
        const errors = await validate(dto)
        expect(errors.length).toBe(0)
      }
    })

    it('should reject invalid time ranges', async () => {
      const dto = plainToClass(QueryPushHistoryDto, { timeRange: 'invalid' })
      const errors = await validate(dto)
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0].property).toBe('timeRange')
    })

    it('should allow timeRange to be optional', async () => {
      const dto = plainToClass(QueryPushHistoryDto, {})
      const errors = await validate(dto)
      const timeRangeErrors = errors.filter((e) => e.property === 'timeRange')
      expect(timeRangeErrors.length).toBe(0)
    })
  })

  describe('date validation', () => {
    it('should accept valid ISO date strings', async () => {
      const dto = plainToClass(QueryPushHistoryDto, {
        startDate: '2024-01-01T00:00:00.000Z',
        endDate: '2024-12-31T23:59:59.999Z',
      })
      const errors = await validate(dto)
      expect(errors.length).toBe(0)
    })

    it('should reject invalid date strings', async () => {
      const dto = plainToClass(QueryPushHistoryDto, {
        startDate: 'not-a-date',
      })
      const errors = await validate(dto)
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0].property).toBe('startDate')
    })

    it('should allow dates to be optional', async () => {
      const dto = plainToClass(QueryPushHistoryDto, {})
      const errors = await validate(dto)
      const dateErrors = errors.filter((e) => ['startDate', 'endDate'].includes(e.property))
      expect(dateErrors.length).toBe(0)
    })
  })

  describe('relevance validation', () => {
    it('should accept valid relevance levels', async () => {
      const validLevels = ['high', 'medium', 'low', 'all']

      for (const level of validLevels) {
        const dto = plainToClass(QueryPushHistoryDto, { relevance: level })
        const errors = await validate(dto)
        expect(errors.length).toBe(0)
      }
    })

    it('should reject invalid relevance levels', async () => {
      const dto = plainToClass(QueryPushHistoryDto, { relevance: 'invalid' })
      const errors = await validate(dto)
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0].property).toBe('relevance')
    })

    it('should allow relevance to be optional', async () => {
      const dto = plainToClass(QueryPushHistoryDto, {})
      const errors = await validate(dto)
      const relevanceErrors = errors.filter((e) => e.property === 'relevance')
      expect(relevanceErrors.length).toBe(0)
    })
  })

  describe('pagination validation', () => {
    it('should accept valid page and limit', async () => {
      const dto = plainToClass(QueryPushHistoryDto, {
        page: '1',
        limit: '20',
      })
      const errors = await validate(dto)
      expect(errors.length).toBe(0)
      expect(dto.page).toBe(1)
      expect(dto.limit).toBe(20)
    })

    it('should reject page less than 1', async () => {
      const dto = plainToClass(QueryPushHistoryDto, { page: '0' })
      const errors = await validate(dto)
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0].property).toBe('page')
    })

    it('should reject limit less than 1', async () => {
      const dto = plainToClass(QueryPushHistoryDto, { limit: '0' })
      const errors = await validate(dto)
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0].property).toBe('limit')
    })

    it('should reject limit greater than 50', async () => {
      const dto = plainToClass(QueryPushHistoryDto, { limit: '51' })
      const errors = await validate(dto)
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0].property).toBe('limit')
    })

    it('should use default values when not provided', async () => {
      const dto = plainToClass(QueryPushHistoryDto, {})
      expect(dto.page).toBe(1)
      expect(dto.limit).toBe(20)
    })
  })

  describe('keyword validation', () => {
    it('should accept valid keywords', async () => {
      const dto = plainToClass(QueryPushHistoryDto, { keyword: 'test search' })
      const errors = await validate(dto)
      expect(errors.length).toBe(0)
    })

    it('should reject keywords longer than 100 characters', async () => {
      const longKeyword = 'a'.repeat(101)
      const dto = plainToClass(QueryPushHistoryDto, { keyword: longKeyword })
      const errors = await validate(dto)
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0].property).toBe('keyword')
    })

    it('should allow keyword to be optional', async () => {
      const dto = plainToClass(QueryPushHistoryDto, {})
      const errors = await validate(dto)
      const keywordErrors = errors.filter((e) => e.property === 'keyword')
      expect(keywordErrors.length).toBe(0)
    })
  })

  describe('complete DTO validation', () => {
    it('should validate a complete valid DTO', async () => {
      const dto = plainToClass(QueryPushHistoryDto, {
        radarType: 'tech',
        timeRange: '30d',
        relevance: 'high',
        page: '1',
        limit: '20',
        keyword: 'cloud native',
      })
      const errors = await validate(dto)
      expect(errors.length).toBe(0)
    })

    it('should validate DTO with custom date range', async () => {
      const dto = plainToClass(QueryPushHistoryDto, {
        startDate: '2024-01-01T00:00:00.000Z',
        endDate: '2024-12-31T23:59:59.999Z',
        page: '1',
        limit: '20',
      })
      const errors = await validate(dto)
      expect(errors.length).toBe(0)
    })
  })
})
