import { validate } from 'class-validator'
import { plainToClass } from 'class-transformer'
import { CreateWatchedTopicDto, WatchedTopicResponseDto } from './watched-topic.dto'

describe('WatchedTopic DTOs', () => {
  describe('CreateWatchedTopicDto', () => {
    it('should pass validation with valid data', async () => {
      const dto = plainToClass(CreateWatchedTopicDto, {
        topicName: '云原生',
        topicType: 'tech',
        description: '云原生技术包括容器化、微服务等',
      })

      const errors = await validate(dto)
      expect(errors.length).toBe(0)
    })

    it('should fail validation when topicName is empty', async () => {
      const dto = plainToClass(CreateWatchedTopicDto, {
        topicName: '',
        topicType: 'tech',
      })

      const errors = await validate(dto)
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0].property).toBe('topicName')
    })

    it('should fail validation when topicName exceeds 100 characters', async () => {
      const dto = plainToClass(CreateWatchedTopicDto, {
        topicName: 'a'.repeat(101),
        topicType: 'tech',
      })

      const errors = await validate(dto)
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0].property).toBe('topicName')
    })

    it('should fail validation when topicType is invalid', async () => {
      const dto = plainToClass(CreateWatchedTopicDto, {
        topicName: '云原生',
        topicType: 'invalid' as any,
      })

      const errors = await validate(dto)
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0].property).toBe('topicType')
    })

    it('should default topicType to tech when not provided', () => {
      const dto = plainToClass(CreateWatchedTopicDto, {
        topicName: '云原生',
      })

      expect(dto.topicType).toBe('tech')
    })

    it('should allow optional description field', async () => {
      const dto = plainToClass(CreateWatchedTopicDto, {
        topicName: '云原生',
        topicType: 'tech',
        description: '云原生技术',
      })

      const errors = await validate(dto)
      expect(errors.length).toBe(0)
      expect(dto.description).toBe('云原生技术')
    })

    it('should fail validation when description exceeds 500 characters', async () => {
      const dto = plainToClass(CreateWatchedTopicDto, {
        topicName: '云原生',
        topicType: 'tech',
        description: 'a'.repeat(501),
      })

      const errors = await validate(dto)
      expect(errors.length).toBeGreaterThan(0)
      const descError = errors.find((e) => e.property === 'description')
      expect(descError).toBeDefined()
    })
  })

  describe('WatchedTopicResponseDto', () => {
    it('should have all required fields', () => {
      const dto: WatchedTopicResponseDto = {
        id: 'uuid-123',
        organizationId: 'org-456',
        topicName: '云原生',
        topicType: 'tech',
        createdAt: '2026-01-31T00:00:00Z',
      }

      expect(dto.id).toBe('uuid-123')
      expect(dto.organizationId).toBe('org-456')
      expect(dto.topicName).toBe('云原生')
      expect(dto.topicType).toBe('tech')
      expect(dto.createdAt).toBe('2026-01-31T00:00:00Z')
    })

    it('should allow optional description field', () => {
      const dto: WatchedTopicResponseDto = {
        id: 'uuid-123',
        organizationId: 'org-456',
        topicName: '云原生',
        topicType: 'tech',
        description: '云原生技术',
        createdAt: '2026-01-31T00:00:00Z',
      }

      expect(dto.description).toBe('云原生技术')
    })

    it('should allow optional relatedPushCount field', () => {
      const dto: WatchedTopicResponseDto = {
        id: 'uuid-123',
        organizationId: 'org-456',
        topicName: '云原生',
        topicType: 'tech',
        createdAt: '2026-01-31T00:00:00Z',
        relatedPushCount: 15,
      }

      expect(dto.relatedPushCount).toBe(15)
    })
  })
})
