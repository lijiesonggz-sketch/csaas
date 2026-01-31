import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { WatchedTopicService } from './watched-topic.service';
import { WatchedTopic } from '../../../database/entities/watched-topic.entity';
import { CreateWatchedTopicDto } from '../dto/watched-topic.dto';

describe('WatchedTopicService', () => {
  let service: WatchedTopicService;
  let repository: Repository<WatchedTopic>;

  const mockRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WatchedTopicService,
        {
          provide: getRepositoryToken(WatchedTopic),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<WatchedTopicService>(WatchedTopicService);
    repository = module.get<Repository<WatchedTopic>>(
      getRepositoryToken(WatchedTopic),
    );

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should successfully create a watched topic', async () => {
      const dto: CreateWatchedTopicDto = {
        topicName: '云原生',
        topicType: 'tech',
      };
      const organizationId = 'org-1';

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue({
        ...dto,
        organizationId,
        source: 'manual',
      });
      mockRepository.save.mockResolvedValue({
        id: 'topic-1',
        ...dto,
        organizationId,
        source: 'manual',
        createdAt: new Date(),
      });

      const result = await service.create(organizationId, dto);

      expect(result.topicName).toBe('云原生');
      expect(result.organizationId).toBe('org-1');
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: {
          organizationId: 'org-1',
          topicName: '云原生',
          topicType: 'tech',
        },
      });
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should reject duplicate watched topic', async () => {
      const dto: CreateWatchedTopicDto = {
        topicName: '云原生',
        topicType: 'tech',
      };
      const organizationId = 'org-1';

      mockRepository.findOne.mockResolvedValue({
        id: 'existing-topic',
        topicName: '云原生',
        topicType: 'tech',
        organizationId: 'org-1',
      });

      await expect(service.create(organizationId, dto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.create(organizationId, dto)).rejects.toThrow(
        '该领域已在关注列表中',
      );
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should set source to manual by default', async () => {
      const dto: CreateWatchedTopicDto = {
        topicName: '云原生',
        topicType: 'tech',
      };
      const organizationId = 'org-1';

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue({
        ...dto,
        organizationId,
        source: 'manual',
      });
      mockRepository.save.mockResolvedValue({
        id: 'topic-1',
        ...dto,
        organizationId,
        source: 'manual',
        createdAt: new Date(),
      });

      await service.create(organizationId, dto);

      expect(mockRepository.create).toHaveBeenCalledWith({
        ...dto,
        organizationId,
        source: 'manual',
      });
    });
  });

  describe('findAll', () => {
    it('should return all watched topics for an organization', async () => {
      const organizationId = 'org-1';
      const mockTopics = [
        {
          id: 'topic-1',
          topicName: '云原生',
          topicType: 'tech' as const,
          organizationId: 'org-1',
          createdAt: new Date('2026-01-31'),
        },
        {
          id: 'topic-2',
          topicName: 'AI应用',
          topicType: 'tech' as const,
          organizationId: 'org-1',
          createdAt: new Date('2026-01-30'),
        },
      ];

      mockRepository.find.mockResolvedValue(mockTopics);

      const result = await service.findAll(organizationId);

      expect(result).toHaveLength(2);
      expect(result[0].topicName).toBe('云原生');
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { organizationId: 'org-1' },
        order: { createdAt: 'DESC' },
      });
    });

    it('should return topics ordered by creation date (newest first)', async () => {
      const organizationId = 'org-1';
      const mockTopics = [
        {
          id: 'topic-2',
          topicName: 'B',
          topicType: 'tech' as const,
          organizationId: 'org-1',
          createdAt: new Date('2026-01-31'),
        },
        {
          id: 'topic-1',
          topicName: 'A',
          topicType: 'tech' as const,
          organizationId: 'org-1',
          createdAt: new Date('2026-01-30'),
        },
      ];

      mockRepository.find.mockResolvedValue(mockTopics);

      const result = await service.findAll(organizationId);

      expect(result[0].topicName).toBe('B'); // Newest first
      expect(result[1].topicName).toBe('A');
    });

    it('should isolate data by organization', async () => {
      const organizationId = 'org-1';
      const mockTopics = [
        {
          id: 'topic-1',
          topicName: '云原生',
          topicType: 'tech' as const,
          organizationId: 'org-1',
          createdAt: new Date(),
        },
      ];

      mockRepository.find.mockResolvedValue(mockTopics);

      const result = await service.findAll(organizationId);

      expect(result).toHaveLength(1);
      expect(result[0].topicName).toBe('云原生');
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { organizationId: 'org-1' },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('delete', () => {
    it('should successfully delete a watched topic', async () => {
      const topicId = 'topic-1';
      const organizationId = 'org-1';

      mockRepository.delete.mockResolvedValue({ affected: 1 });

      await service.delete(topicId, organizationId);

      expect(mockRepository.delete).toHaveBeenCalledWith({
        id: topicId,
        organizationId,
      });
    });

    it('should throw NotFoundException when topic does not exist', async () => {
      const topicId = 'non-existent';
      const organizationId = 'org-1';

      mockRepository.delete.mockResolvedValue({ affected: 0 });

      await expect(service.delete(topicId, organizationId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.delete(topicId, organizationId)).rejects.toThrow(
        '关注领域不存在',
      );
    });

    it('should prevent deleting topics from other organizations', async () => {
      const topicId = 'topic-1';
      const organizationId = 'org-2';

      mockRepository.delete.mockResolvedValue({ affected: 0 });

      await expect(service.delete(topicId, organizationId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getRelatedPushCount', () => {
    it('should return 0 in MVP phase', async () => {
      const topicId = 'topic-1';

      const result = await service.getRelatedPushCount(topicId);

      expect(result).toBe(0);
    });
  });
});
