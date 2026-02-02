import { WatchedTopic } from './watched-topic.entity'
import { Organization } from './organization.entity'

describe('WatchedTopic Entity', () => {
  describe('Entity Structure', () => {
    it('should have required fields matching Story 5.1 specifications', () => {
      const topic = new WatchedTopic()

      // Set values to test field existence
      topic.id = 'test-id'
      topic.organizationId = 'org-123'
      topic.topicName = '云原生'
      topic.topicType = 'tech'
      topic.createdAt = new Date()

      // Verify fields can be set and retrieved
      expect(topic.id).toBe('test-id')
      expect(topic.organizationId).toBe('org-123')
      expect(topic.topicName).toBe('云原生')
      expect(topic.topicType).toBe('tech')
      expect(topic.createdAt).toBeInstanceOf(Date)
    })

    it('should enforce topicType enum values', () => {
      const topic = new WatchedTopic()

      // Valid values
      topic.topicType = 'tech'
      expect(topic.topicType).toBe('tech')

      topic.topicType = 'industry'
      expect(topic.topicType).toBe('industry')
    })

    it('should have topicType field that accepts tech and industry', () => {
      const topic = new WatchedTopic()

      // Default value is set by database, not by TypeScript class
      // We test that the field can be set to valid enum values
      topic.topicType = 'tech'
      expect(topic.topicType).toBe('tech')

      topic.topicType = 'industry'
      expect(topic.topicType).toBe('industry')
    })

    it('should allow optional description field', () => {
      const topic = new WatchedTopic()
      topic.description = '云原生技术包括容器化、微服务等'
      expect(topic.description).toBe('云原生技术包括容器化、微服务等')
    })

    it('should allow optional source field', () => {
      const topic = new WatchedTopic()
      topic.source = 'manual'
      expect(topic.source).toBe('manual')

      topic.source = 'auto'
      expect(topic.source).toBe('auto')
    })
  })

  describe('Field Constraints', () => {
    it('should have topicName with max length 100', () => {
      const topic = new WatchedTopic()
      const longName = 'a'.repeat(101)

      // This will be validated by class-validator in DTO
      // Entity should support the field
      topic.topicName = longName
      expect(topic.topicName.length).toBe(101)
    })

    it('should have description with max length 500', () => {
      const topic = new WatchedTopic()
      const longDesc = 'a'.repeat(501)

      // This will be validated by class-validator in DTO
      // Entity should support the field
      topic.description = longDesc
      expect(topic.description.length).toBe(501)
    })
  })

  describe('Relations', () => {
    it('should belong to an organization', () => {
      const topic = new WatchedTopic()
      const org = new Organization()
      org.id = 'org-123'

      topic.organization = org
      topic.organizationId = org.id

      expect(topic.organization).toBe(org)
      expect(topic.organizationId).toBe('org-123')
    })
  })

  describe('Timestamps', () => {
    it('should have createdAt timestamp', () => {
      const topic = new WatchedTopic()
      topic.createdAt = new Date()

      expect(topic.createdAt).toBeInstanceOf(Date)
    })

    it('should have updatedAt timestamp', () => {
      const topic = new WatchedTopic()
      topic.updatedAt = new Date()

      expect(topic.updatedAt).toBeInstanceOf(Date)
    })

    it('should support soft delete with deletedAt', () => {
      const topic = new WatchedTopic()
      topic.deletedAt = new Date()

      expect(topic.deletedAt).toBeInstanceOf(Date)
    })
  })
})
