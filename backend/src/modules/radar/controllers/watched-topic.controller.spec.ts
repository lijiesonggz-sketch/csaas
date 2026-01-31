import { Test, TestingModule } from '@nestjs/testing';
import { WatchedTopicController } from './watched-topic.controller';
import { WatchedTopicService } from '../services/watched-topic.service';
import { CreateWatchedTopicDto } from '../dto/watched-topic.dto';
import { OrganizationGuard } from '../../organizations/guards/organization.guard';

describe('WatchedTopicController', () => {
  let controller: WatchedTopicController;
  let service: WatchedTopicService;

  const mockService = {
    create: jest.fn(),
    findAll: jest.fn(),
    delete: jest.fn(),
  };

  const mockGuard = {
    canActivate: jest.fn(() => true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WatchedTopicController],
      providers: [
        {
          provide: WatchedTopicService,
          useValue: mockService,
        },
      ],
    })
      .overrideGuard(OrganizationGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<WatchedTopicController>(WatchedTopicController);
    service = module.get<WatchedTopicService>(WatchedTopicService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a watched topic and return response DTO', async () => {
      const dto: CreateWatchedTopicDto = {
        topicName: '云原生',
        topicType: 'tech',
      };
      const orgId = 'org-1';
      const mockTopic = {
        id: 'topic-1',
        organizationId: orgId,
        topicName: '云原生',
        topicType: 'tech' as const,
        createdAt: new Date('2026-01-31'),
      };

      mockService.create.mockResolvedValue(mockTopic);

      const result = await controller.create(orgId, dto);

      expect(result.id).toBe('topic-1');
      expect(result.topicName).toBe('云原生');
      expect(result.organizationId).toBe('org-1');
      expect(result.relatedPushCount).toBe(0);
      expect(mockService.create).toHaveBeenCalledWith(orgId, dto);
    });
  });

  describe('findAll', () => {
    it('should return all watched topics as response DTOs', async () => {
      const orgId = 'org-1';
      const mockTopics = [
        {
          id: 'topic-1',
          organizationId: orgId,
          topicName: '云原生',
          topicType: 'tech' as const,
          createdAt: new Date('2026-01-31'),
        },
        {
          id: 'topic-2',
          organizationId: orgId,
          topicName: 'AI应用',
          topicType: 'tech' as const,
          createdAt: new Date('2026-01-30'),
        },
      ];

      mockService.findAll.mockResolvedValue(mockTopics);

      const result = await controller.findAll(orgId);

      expect(result).toHaveLength(2);
      expect(result[0].topicName).toBe('云原生');
      expect(result[1].topicName).toBe('AI应用');
      expect(result[0].relatedPushCount).toBe(0);
      expect(mockService.findAll).toHaveBeenCalledWith(orgId);
    });
  });

  describe('delete', () => {
    it('should delete a watched topic and return success message', async () => {
      const topicId = 'topic-1';
      const orgId = 'org-1';

      mockService.delete.mockResolvedValue(undefined);

      const result = await controller.delete(topicId, orgId);

      expect(result.message).toBe('已取消关注');
      expect(mockService.delete).toHaveBeenCalledWith(topicId, orgId);
    });
  });
});
