import { Test, TestingModule } from '@nestjs/testing';
import { AIUsageService } from './ai-usage.service';
import { AIUsageLogRepository } from '@/database/repositories/ai-usage-log.repository';
import { AIUsageTaskType } from '@/database/entities/ai-usage-log.entity';

describe('AIUsageService', () => {
  let service: AIUsageService;
  let repository: jest.Mocked<AIUsageLogRepository>;

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIUsageService,
        {
          provide: AIUsageLogRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<AIUsageService>(AIUsageService);
    repository = module.get(AIUsageLogRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateCost', () => {
    it('should calculate cost correctly for Qwen pricing', () => {
      // GIVEN: 1000 input tokens and 500 output tokens
      const inputTokens = 1000;
      const outputTokens = 500;

      // WHEN: calculating cost
      const cost = service['calculateCost'](inputTokens, outputTokens);

      // THEN: cost should be (1000 * 0.008/1000) + (500 * 0.02/1000) = 0.008 + 0.01 = 0.018
      expect(cost).toBe(0.02); // Rounded to 2 decimal places
    });

    it('should handle zero tokens', () => {
      const cost = service['calculateCost'](0, 0);
      expect(cost).toBe(0);
    });

    it('should round to 2 decimal places', () => {
      // GIVEN: tokens that result in fractional cost
      const inputTokens = 123;
      const outputTokens = 456;

      // WHEN: calculating cost
      const cost = service['calculateCost'](inputTokens, outputTokens);

      // THEN: cost should be rounded to 2 decimal places
      expect(cost).toBeCloseTo(0.01, 2);
    });
  });

  describe('logAIUsage', () => {
    it('should create and save AI usage log with calculated cost', async () => {
      // GIVEN: AI usage parameters
      const params = {
        organizationId: 'org-123',
        taskType: AIUsageTaskType.TECH_ANALYSIS,
        inputTokens: 1000,
        outputTokens: 500,
        modelName: 'qwen-plus',
        requestId: 'req-123',
      };

      const mockLog = { id: 'log-123', ...params, cost: 0.02 };
      repository.create.mockReturnValue(mockLog as any);
      repository.save.mockResolvedValue(mockLog as any);

      // WHEN: logging AI usage
      await service.logAIUsage(params);

      // THEN: should create log with calculated cost
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: params.organizationId,
          taskType: params.taskType,
          inputTokens: params.inputTokens,
          outputTokens: params.outputTokens,
          cost: expect.any(Number),
          modelName: params.modelName,
          requestId: params.requestId,
        }),
      );
      expect(repository.save).toHaveBeenCalledWith(mockLog);
    });

    it('should use default model name if not provided', async () => {
      const params = {
        organizationId: 'org-123',
        taskType: AIUsageTaskType.TECH_ANALYSIS,
        inputTokens: 1000,
        outputTokens: 500,
      };

      repository.create.mockReturnValue({} as any);
      repository.save.mockResolvedValue({} as any);

      await service.logAIUsage(params);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          modelName: 'qwen-max',
        }),
      );
    });
  });

  describe('getOrganizationMonthlyCost', () => {
    it('should return total cost for organization in current month', async () => {
      // GIVEN: organization with AI usage logs
      const organizationId = 'org-123';
      const mockResult = { totalCost: '123.45' };

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue(mockResult),
      };

      repository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      // WHEN: getting monthly cost
      const cost = await service.getOrganizationMonthlyCost(organizationId);

      // THEN: should return parsed cost
      expect(cost).toBe(123.45);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'log.organizationId = :organizationId',
        { organizationId },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'log.createdAt >= :startOfMonth',
        expect.objectContaining({ startOfMonth: expect.any(Date) }),
      );
    });

    it('should return 0 if no usage logs found', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ totalCost: null }),
      };

      repository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const cost = await service.getOrganizationMonthlyCost('org-123');

      expect(cost).toBe(0);
    });
  });

  describe('getCostBreakdown', () => {
    it('should return cost breakdown by task type with percentages', async () => {
      // GIVEN: organization with multiple task types
      const organizationId = 'org-123';
      const mockResults = [
        { taskType: AIUsageTaskType.TECH_ANALYSIS, cost: '60' },
        { taskType: AIUsageTaskType.INDUSTRY_ANALYSIS, cost: '30' },
        { taskType: AIUsageTaskType.ROI_CALCULATION, cost: '10' },
      ];

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(mockResults),
      };

      repository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      // WHEN: getting cost breakdown
      const breakdown = await service.getCostBreakdown(organizationId);

      // THEN: should return breakdown with percentages
      expect(breakdown).toHaveLength(3);
      expect(breakdown[0]).toEqual({
        taskType: AIUsageTaskType.TECH_ANALYSIS,
        cost: 60,
        percentage: 60, // 60/100 * 100
      });
      expect(breakdown[1]).toEqual({
        taskType: AIUsageTaskType.INDUSTRY_ANALYSIS,
        cost: 30,
        percentage: 30,
      });
      expect(breakdown[2]).toEqual({
        taskType: AIUsageTaskType.ROI_CALCULATION,
        cost: 10,
        percentage: 10,
      });
    });

    it('should handle zero total cost', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };

      repository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const breakdown = await service.getCostBreakdown('org-123');

      expect(breakdown).toEqual([]);
    });
  });

  describe('getTopCostOrganizations', () => {
    it('should return top N organizations by cost', async () => {
      // GIVEN: multiple organizations with costs
      const mockResults = [
        { organizationId: 'org-1', cost: '500' },
        { organizationId: 'org-2', cost: '300' },
        { organizationId: 'org-3', cost: '100' },
      ];

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(mockResults),
      };

      repository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      // WHEN: getting top cost organizations
      const topOrgs = await service.getTopCostOrganizations(10);

      // THEN: should return organizations sorted by cost
      expect(topOrgs).toHaveLength(3);
      expect(topOrgs[0]).toEqual({
        organizationId: 'org-1',
        cost: 500,
      });
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('cost', 'DESC');
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(10);
    });
  });
});
