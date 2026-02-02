import { Test, TestingModule } from '@nestjs/testing';
import { WatchedTopicController } from './watched-topic.controller';
import { WatchedTopicService } from '../services/watched-topic.service';
import { CreateWatchedTopicDto } from '../dto/watched-topic.dto';
import { OrganizationGuard } from '../../organizations/guards/organization.guard';
import { TenantGuard } from '../../organizations/guards/tenant.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AuditInterceptor } from '../../../common/interceptors/audit.interceptor';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';

describe('WatchedTopicController', () => {
  let controller: WatchedTopicController;
  let service: WatchedTopicService;

  const mockTenantId = 'tenant-123';
  const mockOrgId = 'org-1';

  const mockService = {
    create: jest.fn(),
    findAll: jest.fn(),
    delete: jest.fn(),
  };

  const mockGuard = {
    canActivate: jest.fn(() => true),
  };

  const mockInterceptor = {
    intercept: jest.fn((context: ExecutionContext, next: CallHandler) => next.handle()),
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
      .overrideGuard(JwtAuthGuard)
      .useValue(mockGuard)
      .overrideGuard(TenantGuard)
      .useValue(mockGuard)
      .overrideGuard(OrganizationGuard)
      .useValue(mockGuard)
      .overrideInterceptor(AuditInterceptor)
      .useValue(mockInterceptor)
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
      const mockTopic = {
        id: 'topic-1',
        tenantId: mockTenantId,
        organizationId: mockOrgId,
        topicName: '云原生',
        topicType: 'tech' as const,
        createdAt: new Date('2026-01-31'),
      };

      mockService.create.mockResolvedValue(mockTopic);

      const result = await controller.create(mockTenantId, mockOrgId, dto);

      expect(result.id).toBe('topic-1');
      expect(result.topicName).toBe('云原生');
      expect(result.organizationId).toBe(mockOrgId);
      expect(result.relatedPushCount).toBe(0);
      expect(mockService.create).toHaveBeenCalledWith(mockTenantId, mockOrgId, dto);
    });
  });

  describe('findAll', () => {
    it('should return all watched topics as response DTOs', async () => {
      const mockTopics = [
        {
          id: 'topic-1',
          tenantId: mockTenantId,
          organizationId: mockOrgId,
          topicName: '云原生',
          topicType: 'tech' as const,
          createdAt: new Date('2026-01-31'),
        },
        {
          id: 'topic-2',
          tenantId: mockTenantId,
          organizationId: mockOrgId,
          topicName: 'AI应用',
          topicType: 'tech' as const,
          createdAt: new Date('2026-01-30'),
        },
      ];

      mockService.findAll.mockResolvedValue(mockTopics);

      const result = await controller.findAll(mockTenantId, mockOrgId);

      expect(result).toHaveLength(2);
      expect(result[0].topicName).toBe('云原生');
      expect(result[1].topicName).toBe('AI应用');
      expect(result[0].relatedPushCount).toBe(0);
      expect(mockService.findAll).toHaveBeenCalledWith(mockTenantId, mockOrgId);
    });
  });

  describe('delete', () => {
    it('should delete a watched topic and return success message', async () => {
      const topicId = 'topic-1';

      mockService.delete.mockResolvedValue(undefined);

      const result = await controller.delete(topicId, mockTenantId, mockOrgId);

      expect(result.message).toBe('已取消关注');
      expect(mockService.delete).toHaveBeenCalledWith(topicId, mockTenantId, mockOrgId);
    });
  });
});
