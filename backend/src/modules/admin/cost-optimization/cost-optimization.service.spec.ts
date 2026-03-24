import { Test, TestingModule } from '@nestjs/testing';
import { CostOptimizationService } from './cost-optimization.service';
import { AIUsageLogRepository } from '@/database/repositories/ai-usage-log.repository';
import { OrganizationRepository } from '@/database/repositories/organization.repository';
import { AlertRepository } from '@/database/repositories/alert.repository';
import { AuditLogRepository } from '@/database/repositories/audit-log.repository';
import { EmailService } from '../clients/email.service';
import { ConfigService } from '@nestjs/config';
import { AIUsageTaskType } from '@/database/entities/ai-usage-log.entity';

describe('CostOptimizationService', () => {
  let service: CostOptimizationService;
  let aiUsageLogRepository: jest.Mocked<AIUsageLogRepository>;
  let organizationRepository: jest.Mocked<OrganizationRepository>;
  let alertRepository: jest.Mocked<AlertRepository>;
  let auditLogRepository: jest.Mocked<AuditLogRepository>;
  let emailService: jest.Mocked<EmailService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const mockAIUsageLogRepository = {
      getTotalCost: jest.fn(),
      getCostBreakdown: jest.fn(),
      getDailyCostTrend: jest.fn(),
      getTopCostOrganizations: jest.fn(),
    };

    const mockOrganizationRepository = {
      findByIdPlatform: jest.fn(),
      findAllPlatform: jest.fn(),
    };

    const mockAlertRepository = {
      create: jest.fn(),
      findWithFilters: jest.fn(),
    };

    const mockAuditLogRepository = {
      create: jest.fn(),
      save: jest.fn(),
    };

    const mockEmailService = {
      sendCostExceededAlert: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        if (key === 'ADMIN_EMAIL') return 'admin@example.com';
        return defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CostOptimizationService,
        {
          provide: AIUsageLogRepository,
          useValue: mockAIUsageLogRepository,
        },
        {
          provide: OrganizationRepository,
          useValue: mockOrganizationRepository,
        },
        {
          provide: AlertRepository,
          useValue: mockAlertRepository,
        },
        {
          provide: AuditLogRepository,
          useValue: mockAuditLogRepository,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<CostOptimizationService>(CostOptimizationService);
    aiUsageLogRepository = module.get(AIUsageLogRepository);
    organizationRepository = module.get(OrganizationRepository);
    alertRepository = module.get(AlertRepository);
    auditLogRepository = module.get(AuditLogRepository);
    emailService = module.get(EmailService);
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCostMetrics', () => {
    it('should return cost metrics overview', async () => {
      // GIVEN: AI usage data for current month
      const now = new Date('2026-02-15');
      jest.useFakeTimers().setSystemTime(now);

      aiUsageLogRepository.getTotalCost.mockResolvedValue(1500);
      aiUsageLogRepository.getTopCostOrganizations.mockResolvedValue([
        { organizationId: 'org-1', cost: 600, count: 100 },
        { organizationId: 'org-2', cost: 500, count: 80 },
        { organizationId: 'org-3', cost: 400, count: 60 },
      ]);

      organizationRepository.findByIdPlatform
        .mockResolvedValueOnce({ id: 'org-1', name: 'Org 1' } as any)
        .mockResolvedValueOnce({ id: 'org-2', name: 'Org 2' } as any)
        .mockResolvedValueOnce({ id: 'org-3', name: 'Org 3' } as any);

      // WHEN: getting cost metrics
      const metrics = await service.getCostMetrics();

      // THEN: should return overview metrics
      expect(metrics).toEqual({
        totalCost: 1500,
        averageCostPerOrganization: 500,
        topCostOrganizations: [
          { organizationId: 'org-1', organizationName: 'Org 1', cost: 600, count: 100 },
          { organizationId: 'org-2', organizationName: 'Org 2', cost: 500, count: 80 },
          { organizationId: 'org-3', organizationName: 'Org 3', cost: 400, count: 60 },
        ],
        period: {
          startDate: expect.any(Date),
          endDate: expect.any(Date),
        },
      });

      jest.useRealTimers();
    });

    it('should handle zero organizations', async () => {
      aiUsageLogRepository.getTotalCost.mockResolvedValue(0);
      aiUsageLogRepository.getTopCostOrganizations.mockResolvedValue([]);

      const metrics = await service.getCostMetrics();

      expect(metrics.totalCost).toBe(0);
      expect(metrics.averageCostPerOrganization).toBe(0);
      expect(metrics.topCostOrganizations).toEqual([]);
    });
  });

  describe('getOrganizationCostDetails', () => {
    it('should return detailed cost information for organization', async () => {
      // GIVEN: organization with AI usage
      const organizationId = 'org-123';
      const now = new Date('2026-02-15');
      jest.useFakeTimers().setSystemTime(now);

      aiUsageLogRepository.getTotalCost.mockResolvedValue(450);
      aiUsageLogRepository.getCostBreakdown.mockResolvedValue([
        { taskType: AIUsageTaskType.TECH_ANALYSIS, cost: 200, count: 50 },
        { taskType: AIUsageTaskType.INDUSTRY_ANALYSIS, cost: 150, count: 30 },
        { taskType: AIUsageTaskType.ROI_CALCULATION, cost: 100, count: 20 },
      ]);

      organizationRepository.findByIdPlatform.mockResolvedValue({
        id: organizationId,
        name: 'Test Org',
      } as any);

      // WHEN: getting organization cost details
      const details = await service.getOrganizationCostDetails(organizationId);

      // THEN: should return detailed cost information
      expect(details).toEqual({
        organizationId,
        organizationName: 'Test Org',
        totalCost: 450,
        costBreakdown: [
          { taskType: AIUsageTaskType.TECH_ANALYSIS, cost: 200, count: 50, percentage: 44.44 },
          { taskType: AIUsageTaskType.INDUSTRY_ANALYSIS, cost: 150, count: 30, percentage: 33.33 },
          { taskType: AIUsageTaskType.ROI_CALCULATION, cost: 100, count: 20, percentage: 22.22 },
        ],
        isExceeded: false,
        threshold: 500,
        period: {
          startDate: expect.any(Date),
          endDate: expect.any(Date),
        },
      });

      jest.useRealTimers();
    });

    it('should mark as exceeded when cost > 500', async () => {
      const organizationId = 'org-123';

      aiUsageLogRepository.getTotalCost.mockResolvedValue(600);
      aiUsageLogRepository.getCostBreakdown.mockResolvedValue([]);
      organizationRepository.findByIdPlatform.mockResolvedValue({
        id: organizationId,
        name: 'Test Org',
      } as any);

      const details = await service.getOrganizationCostDetails(organizationId);

      expect(details.isExceeded).toBe(true);
      expect(details.totalCost).toBe(600);
    });

    it('should throw error if organization not found', async () => {
      organizationRepository.findByIdPlatform.mockResolvedValue(null);

      await expect(service.getOrganizationCostDetails('invalid-id')).rejects.toThrow(
        'Organization not found',
      );
    });
  });

  describe('getCostTrends', () => {
    it('should return daily cost trends', async () => {
      // GIVEN: cost data for last 30 days
      const mockTrends = [
        { date: '2026-01-16', cost: 50, count: 10 },
        { date: '2026-01-17', cost: 60, count: 12 },
        { date: '2026-01-18', cost: 55, count: 11 },
      ];

      aiUsageLogRepository.getDailyCostTrend.mockResolvedValue(mockTrends);

      // WHEN: getting cost trends
      const trends = await service.getCostTrends(30);

      // THEN: should return daily trends
      expect(trends).toEqual({
        trends: mockTrends,
        period: {
          startDate: expect.any(Date),
          endDate: expect.any(Date),
        },
      });

      // Verify date range (30 days)
      const call = aiUsageLogRepository.getDailyCostTrend.mock.calls[0];
      const startDate = call[0] as Date;
      const endDate = call[1] as Date;
      const daysDiff = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      expect(daysDiff).toBe(30);
    });

    it('should default to 30 days if no days specified', async () => {
      aiUsageLogRepository.getDailyCostTrend.mockResolvedValue([]);

      await service.getCostTrends();

      const call = aiUsageLogRepository.getDailyCostTrend.mock.calls[0];
      const startDate = call[0] as Date;
      const endDate = call[1] as Date;
      const daysDiff = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      expect(daysDiff).toBe(30);
    });
  });

  describe('checkCostExceeded', () => {
    it('should create alert and send email when cost exceeds threshold', async () => {
      // GIVEN: organization with cost > 500
      const organizationId = 'org-123';
      const now = new Date('2026-02-15');
      jest.useFakeTimers().setSystemTime(now);

      aiUsageLogRepository.getTotalCost.mockResolvedValue(600);
      organizationRepository.findByIdPlatform.mockResolvedValue({
        id: organizationId,
        name: 'Test Org',
      } as any);

      // No existing alert this month
      alertRepository.findWithFilters.mockResolvedValue({
        data: [],
        total: 0,
      });

      const mockAlert = {
        id: 'alert-123',
        alertType: 'ai_cost_exceeded',
        severity: 'high',
        message: 'AI cost exceeded threshold for organization Test Org',
        status: 'unresolved',
        metadata: { organizationId, cost: 600, threshold: 500 },
      };

      alertRepository.create.mockResolvedValue(mockAlert as any);

      // WHEN: checking cost exceeded
      const result = await service.checkCostExceeded(organizationId);

      // THEN: should create alert and send email
      expect(result).toBe(true);
      expect(alertRepository.create).toHaveBeenCalledWith({
        alertType: 'ai_cost_exceeded',
        severity: 'high',
        message: 'AI cost exceeded threshold for organization Test Org',
        status: 'unresolved',
        metadata: {
          organizationId,
          organizationName: 'Test Org',
          cost: 600,
          threshold: 500,
          month: expect.any(String),
        },
      });

      expect(emailService.sendCostExceededAlert).toHaveBeenCalledWith({
        to: 'admin@example.com',
        organizationName: 'Test Org',
        cost: 600,
        threshold: 500,
      });

      jest.useRealTimers();
    });

    it('should not create duplicate alert if one exists this month', async () => {
      // GIVEN: organization with cost > 500 and existing alert
      const organizationId = 'org-123';
      const now = new Date('2026-02-15');
      jest.useFakeTimers().setSystemTime(now);

      aiUsageLogRepository.getTotalCost.mockResolvedValue(600);
      organizationRepository.findByIdPlatform.mockResolvedValue({
        id: organizationId,
        name: 'Test Org',
      } as any);

      // Existing alert this month
      alertRepository.findWithFilters.mockResolvedValue({
        data: [
          {
            id: 'alert-existing',
            alertType: 'ai_cost_exceeded',
            metadata: { organizationId, month: '2026-02' },
          },
        ],
        total: 1,
      } as any);

      // WHEN: checking cost exceeded
      const result = await service.checkCostExceeded(organizationId);

      // THEN: should not create new alert
      expect(result).toBe(false);
      expect(alertRepository.create).not.toHaveBeenCalled();
      expect(emailService.sendCostExceededAlert).not.toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('should return false when cost is below threshold', async () => {
      // GIVEN: organization with cost < 500
      const organizationId = 'org-123';

      aiUsageLogRepository.getTotalCost.mockResolvedValue(400);
      organizationRepository.findByIdPlatform.mockResolvedValue({
        id: organizationId,
        name: 'Test Org',
      } as any);

      // WHEN: checking cost exceeded
      const result = await service.checkCostExceeded(organizationId);

      // THEN: should return false without creating alert
      expect(result).toBe(false);
      expect(alertRepository.create).not.toHaveBeenCalled();
      expect(emailService.sendCostExceededAlert).not.toHaveBeenCalled();
    });
  });

  describe('checkAllOrganizationsCost', () => {
    it('should check cost for all organizations', async () => {
      // GIVEN: multiple organizations
      const organizations = [
        { id: 'org-1', name: 'Org 1' },
        { id: 'org-2', name: 'Org 2' },
        { id: 'org-3', name: 'Org 3' },
      ];

      organizationRepository.findAllPlatform.mockResolvedValue(organizations as any);

      // Mock checkCostExceeded to return true for org-1 and org-3
      jest.spyOn(service, 'checkCostExceeded')
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      // WHEN: checking all organizations
      const result = await service.checkAllOrganizationsCost();

      // THEN: should check all organizations and return count
      expect(result).toEqual({
        totalChecked: 3,
        alertsCreated: 2,
      });

      expect(service.checkCostExceeded).toHaveBeenCalledTimes(3);
      expect(service.checkCostExceeded).toHaveBeenCalledWith('org-1');
      expect(service.checkCostExceeded).toHaveBeenCalledWith('org-2');
      expect(service.checkCostExceeded).toHaveBeenCalledWith('org-3');
    });

    it('should handle errors gracefully', async () => {
      const organizations = [
        { id: 'org-1', name: 'Org 1' },
        { id: 'org-2', name: 'Org 2' },
      ];

      organizationRepository.findAllPlatform.mockResolvedValue(organizations as any);

      // Mock checkCostExceeded to throw error for org-1
      jest.spyOn(service, 'checkCostExceeded')
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValueOnce(true);

      // WHEN: checking all organizations
      const result = await service.checkAllOrganizationsCost();

      // THEN: should continue checking other organizations
      expect(result).toEqual({
        totalChecked: 2,
        alertsCreated: 1,
      });
    });
  });
});
