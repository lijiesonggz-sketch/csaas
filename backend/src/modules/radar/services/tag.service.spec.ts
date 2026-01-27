import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { TagService } from './tag.service'
import { Tag } from '../../../database/entities/tag.entity'

describe('TagService', () => {
  let service: TagService
  let repository: Repository<Tag>

  const mockTag: Partial<Tag> = {
    id: 'tag-1',
    name: '云原生',
    tagType: 'tech',
    category: '基础设施',
    usageCount: 0,
    watchCount: 0,
    isActive: true,
    isVerified: false,
    isOfficial: false,
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TagService,
        {
          provide: getRepositoryToken(Tag),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            increment: jest.fn(),
            createQueryBuilder: jest.fn(),
            findByIds: jest.fn(),
          },
        },
      ],
    }).compile()

    service = module.get<TagService>(TagService)
    repository = module.get<Repository<Tag>>(getRepositoryToken(Tag))

    jest.clearAllMocks()
  })

  describe('findByName', () => {
    it('应该通过名称查找标签', async () => {
      // Arrange
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockTag as Tag)

      // Act
      const result = await service.findByName('云原生')

      // Assert
      expect(result).toBeDefined()
      expect(result?.name).toBe('云原生')
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { name: '云原生' },
      })
    })

    it('标签不存在时应该返回null', async () => {
      // Arrange
      jest.spyOn(repository, 'findOne').mockResolvedValue(null)

      // Act
      const result = await service.findByName('不存在的标签')

      // Assert
      expect(result).toBeNull()
    })
  })

  describe('findOrCreate', () => {
    it('标签存在时应该返回现有标签', async () => {
      // Arrange
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockTag as Tag)

      // Act
      const result = await service.findOrCreate('云原生', 'tech')

      // Assert
      expect(result).toBeDefined()
      expect(result.name).toBe('云原生')
      expect(repository.create).not.toHaveBeenCalled()
      expect(repository.save).not.toHaveBeenCalled()
    })

    it('标签不存在时应该创建新标签', async () => {
      // Arrange
      jest.spyOn(repository, 'findOne').mockResolvedValue(null)
      jest.spyOn(repository, 'create').mockReturnValue(mockTag as Tag)
      jest.spyOn(repository, 'save').mockResolvedValue(mockTag as Tag)

      // Act
      const result = await service.findOrCreate('云原生', 'tech', '基础设施')

      // Assert
      expect(result).toBeDefined()
      expect(repository.create).toHaveBeenCalledWith({
        name: '云原生',
        tagType: 'tech',
        category: '基础设施',
        usageCount: 0,
        watchCount: 0,
        isActive: true,
        isVerified: false,
        isOfficial: false,
      })
      expect(repository.save).toHaveBeenCalled()
    })

    it('应该支持不同的标签类型', async () => {
      // Arrange
      jest.spyOn(repository, 'findOne').mockResolvedValue(null)
      jest.spyOn(repository, 'create').mockReturnValue(mockTag as Tag)
      jest.spyOn(repository, 'save').mockResolvedValue(mockTag as Tag)

      // Act
      await service.findOrCreate('工商银行', 'peer')
      await service.findOrCreate('ISO27001', 'compliance')
      await service.findOrCreate('华为', 'vendor')

      // Assert
      expect(repository.create).toHaveBeenCalledTimes(3)
      expect(repository.create).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ tagType: 'peer' }),
      )
      expect(repository.create).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ tagType: 'compliance' }),
      )
      expect(repository.create).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({ tagType: 'vendor' }),
      )
    })
  })

  describe('findOrCreateMany', () => {
    it('应该批量创建或查找标签', async () => {
      // Arrange
      const tags = [
        { name: '云原生', tagType: 'tech' as const },
        { name: 'Kubernetes', tagType: 'tech' as const },
        { name: '零信任', tagType: 'tech' as const },
      ]

      jest.spyOn(repository, 'findOne').mockResolvedValue(null)
      jest.spyOn(repository, 'create').mockReturnValue(mockTag as Tag)
      jest.spyOn(repository, 'save').mockResolvedValue(mockTag as Tag)

      // Act
      const results = await service.findOrCreateMany(tags)

      // Assert
      expect(results).toHaveLength(3)
      expect(repository.create).toHaveBeenCalledTimes(3)
      expect(repository.save).toHaveBeenCalledTimes(3)
    })
  })

  describe('incrementUsageCount', () => {
    it('应该增加标签使用计数', async () => {
      // Arrange
      jest.spyOn(repository, 'increment').mockResolvedValue(undefined as any)

      // Act
      await service.incrementUsageCount('tag-1')

      // Assert
      expect(repository.increment).toHaveBeenCalledWith(
        { id: 'tag-1' },
        'usageCount',
        1,
      )
    })
  })

  describe('incrementUsageCountBatch', () => {
    it('应该批量增加标签使用计数', async () => {
      // Arrange
      const tagIds = ['tag-1', 'tag-2', 'tag-3']
      jest.spyOn(repository, 'increment').mockResolvedValue(undefined as any)

      // Act
      await service.incrementUsageCountBatch(tagIds)

      // Assert
      expect(repository.increment).toHaveBeenCalledTimes(3)
    })
  })

  describe('getPopularTags', () => {
    it('应该返回热门标签', async () => {
      // Arrange
      const popularTags = [
        { ...mockTag, usageCount: 100 },
        { ...mockTag, id: 'tag-2', name: 'Kubernetes', usageCount: 80 },
        { ...mockTag, id: 'tag-3', name: '零信任', usageCount: 60 },
      ]

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(popularTags),
      }

      jest
        .spyOn(repository, 'createQueryBuilder')
        .mockReturnValue(mockQueryBuilder as any)

      // Act
      const results = await service.getPopularTags(20)

      // Assert
      expect(results).toHaveLength(3)
      expect(results[0].usageCount).toBe(100)
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'tag.isActive = :isActive',
        { isActive: true },
      )
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        'tag.usageCount',
        'DESC',
      )
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(20)
    })

    it('应该支持按标签类型筛选', async () => {
      // Arrange
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      }

      jest
        .spyOn(repository, 'createQueryBuilder')
        .mockReturnValue(mockQueryBuilder as any)

      // Act
      await service.getPopularTags(20, 'tech')

      // Assert
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'tag.tagType = :tagType',
        { tagType: 'tech' },
      )
    })
  })

  describe('findById', () => {
    it('应该通过ID查找标签', async () => {
      // Arrange
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockTag as Tag)

      // Act
      const result = await service.findById('tag-1')

      // Assert
      expect(result).toBeDefined()
      expect(result?.id).toBe('tag-1')
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 'tag-1' },
      })
    })
  })

  describe('findByIds', () => {
    it('应该批量通过ID查找标签', async () => {
      // Arrange
      const tags = [
        { ...mockTag, id: 'tag-1' },
        { ...mockTag, id: 'tag-2' },
        { ...mockTag, id: 'tag-3' },
      ]
      jest.spyOn(repository, 'findByIds').mockResolvedValue(tags as Tag[])

      // Act
      const results = await service.findByIds(['tag-1', 'tag-2', 'tag-3'])

      // Assert
      expect(results).toHaveLength(3)
      expect(repository.findByIds).toHaveBeenCalledWith([
        'tag-1',
        'tag-2',
        'tag-3',
      ])
    })
  })
})
