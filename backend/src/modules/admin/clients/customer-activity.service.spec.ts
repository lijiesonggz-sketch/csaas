import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomerActivityService } from './customer-activity.service';
import { CustomerActivityLogRepository } from '../../../database/repositories/customer-activity-log.repository';
import { OrganizationRepository } from '../../../database/repositories/organization.repository';
import { AlertService } from '../dashboard/alert.service';
import { EmailService } from './email.service';
import { PushFeedbackRepository } from '../../../database/repositories/push-feedback.repository';
import { RadarPushRepository } from '../../../database/repositories/radar-push.repository';
import { CustomerInterventionRepository } from '../../../database/repositories/customer-intervention.repository';
import { Organization } from '../../../database/entities/organization.entity';

/**
 * CustomerActivityService Unit Tests
 *
 * Story 7.3: 客户管理与流失风险预警
 */
describe('CustomerActivityService', () => {
  let service: CustomerActivityService;
  let activityLogRepo: jest.Mocked<CustomerActivityLogRepository>;
  let organizationRepo: jest.Mocked<OrganizationRepository>;
  let alertService: jest.Mocked<AlertService>;
  let emailService: jest.Mocked<EmailService>;
  let pushFeedbackRepo: jest.Mocked<PushFeedbackRepository>;
  let radarPushRepo: jest.Mocked<RadarPushRepository>;
  let interventionRepo: jest.Mocked<CustomerInterventionRepository>;
  let rawOrgRepo: jest.Mocked<Repository<Organization>>;

  const mockOrganization: Organization = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Test Organization',
    tenantId: '550e8400-e29b-41d4-a716-446655440001',
    radarActivated: true,
    contactEmail: 'test@example.com',
    contactPerson: 'Test Person',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Organization;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerActivityService,
        {
          provide: CustomerActivityLogRepository,
          useValue: {
            upsertActivity: jest.fn(),
            getActivitySummary: jest.fn(),
            getActivityTrend: jest.fn(),
            getRecentActivityCount: jest.fn(),
            findByOrganization: jest.fn(),
          },
        },
        {
          provide: OrganizationRepository,
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: AlertService,
          useValue: {
            createAlert: jest.fn(),
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendChurnRiskAlert: jest.fn(),
          },
        },
        {
          provide: PushFeedbackRepository,
          useValue: {
            findRecentByOrganization: jest.fn(),
          },
        },
        {
          provide: RadarPushRepository,
          useValue: {
            findRecentByOrganization: jest.fn(),
          },
        },
        {
          provide: CustomerInterventionRepository,
          useValue: {
            findByOrganization: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Organization),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            update: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CustomerActivityService>(CustomerActivityService);
    activityLogRepo = module.get(CustomerActivityLogRepository);
    organizationRepo = module.get(OrganizationRepository);
    alertService = module.get(AlertService);
    emailService = module.get(EmailService);
    pushFeedbackRepo = module.get(PushFeedbackRepository);
    radarPushRepo = module.get(RadarPushRepository);
    interventionRepo = module.get(CustomerInterventionRepository);
    rawOrgRepo = module.get(getRepositoryToken(Organization));
  });

  describe('recordActivity', () => {
    it('should record activity and update lastActiveAt', async () => {
      // Arrange
      const orgId = '550e8400-e29b-41d4-a716-446655440000';
      const activityType = 'login' as const;
      const metadata = { userId: 'user-123' };

      activityLogRepo.upsertActivity.mockResolvedValue({} as any);
      rawOrgRepo.update.mockResolvedValue({} as any);

      // Act
      await service.recordActivity(orgId, activityType, metadata);

      // Assert
      expect(activityLogRepo.upsertActivity).toHaveBeenCalledWith(
        orgId,
        activityType,
        expect.any(String),
        metadata,
      );
      expect(rawOrgRepo.update).toHaveBeenCalledWith(orgId, {
        lastActiveAt: expect.any(Date),
      });
    });

    it('should not throw if activity tracking fails', async () => {
      // Arrange
      activityLogRepo.upsertActivity.mockRejectedValue(new Error('DB Error'));

      // Act & Assert
      await expect(
        service.recordActivity('550e8400-e29b-41d4-a716-446655440000', 'login'),
      ).resolves.not.toThrow();
    });

    it('should throw BadRequestException for invalid UUID', async () => {
      // Act & Assert
      await expect(
        service.recordActivity('invalid-uuid', 'login'),
      ).rejects.toThrow('organizationId must be a valid UUID');
    });
  });

  describe('calculateMonthlyActivityRate', () => {
    it('should calculate activity rate correctly for high active', async () => {
      // Arrange
      const orgId = '550e8400-e29b-41d4-a716-446655440000';
      activityLogRepo.getActivitySummary.mockResolvedValue({
        loginDays: 25,
        pushViewDays: 20,
        feedbackDays: 10,
        settingsDays: 5,
        totalActiveDays: 28,
      });
      rawOrgRepo.update.mockResolvedValue({} as any);

      // Act
      const result = await service.calculateMonthlyActivityRate(orgId);

      // Assert
      expect(result.monthlyRate).toBeCloseTo(93.33, 1);
      expect(result.loginRate).toBeCloseTo(83.33, 1);
      expect(result.status).toBe('high_active');
    });

    it('should calculate activity rate correctly for churn risk', async () => {
      // Arrange
      const orgId = '550e8400-e29b-41d4-a716-446655440000';
      activityLogRepo.getActivitySummary.mockResolvedValue({
        loginDays: 10,
        pushViewDays: 5,
        feedbackDays: 2,
        settingsDays: 1,
        totalActiveDays: 12,
      });
      rawOrgRepo.findOne.mockResolvedValue(mockOrganization);
      rawOrgRepo.update.mockResolvedValue({} as any);
      alertService.createAlert.mockResolvedValue({} as any);
      emailService.sendChurnRiskAlert.mockResolvedValue();

      // Act
      const result = await service.calculateMonthlyActivityRate(orgId);

      // Assert
      expect(result.monthlyRate).toBe(40);
      expect(result.status).toBe('churn_risk');
      expect(alertService.createAlert).toHaveBeenCalled();
      expect(emailService.sendChurnRiskAlert).toHaveBeenCalled();
    });

    it('should calculate activity rate correctly for medium active', async () => {
      // Arrange
      const orgId = '550e8400-e29b-41d4-a716-446655440000';
      activityLogRepo.getActivitySummary.mockResolvedValue({
        loginDays: 20,
        pushViewDays: 15,
        feedbackDays: 8,
        settingsDays: 3,
        totalActiveDays: 22,
      });
      rawOrgRepo.update.mockResolvedValue({} as any);

      // Act
      const result = await service.calculateMonthlyActivityRate(orgId);

      // Assert
      expect(result.monthlyRate).toBeCloseTo(73.33, 1);
      expect(result.status).toBe('medium_active');
    });

    it('should calculate activity rate correctly for low active', async () => {
      // Arrange
      const orgId = '550e8400-e29b-41d4-a716-446655440000';
      activityLogRepo.getActivitySummary.mockResolvedValue({
        loginDays: 15,
        pushViewDays: 10,
        feedbackDays: 5,
        settingsDays: 2,
        totalActiveDays: 18,
      });
      rawOrgRepo.update.mockResolvedValue({} as any);

      // Act
      const result = await service.calculateMonthlyActivityRate(orgId);

      // Assert
      // 18/30 = 60%, which falls in low_active range (>= 60 && < 70)
      expect(result.monthlyRate).toBe(60);
      expect(result.status).toBe('low_active');
    });

    it('should calculate activity rate correctly for medium active (75%)', async () => {
      // Arrange
      const orgId = '550e8400-e29b-41d4-a716-446655440000';
      activityLogRepo.getActivitySummary.mockResolvedValue({
        loginDays: 20,
        pushViewDays: 15,
        feedbackDays: 8,
        settingsDays: 3,
        totalActiveDays: 22,
      });
      rawOrgRepo.update.mockResolvedValue({} as any);

      // Act
      const result = await service.calculateMonthlyActivityRate(orgId);

      // Assert
      // 22/30 = 73.33%, which falls in medium_active range (>= 70 && < 85)
      expect(result.monthlyRate).toBeCloseTo(73.33, 1);
      expect(result.status).toBe('medium_active');
    });
  });

  describe('getChurnRiskFactors', () => {
    it('should identify low feedback scores as risk factor', async () => {
      // Arrange
      const orgId = '550e8400-e29b-41d4-a716-446655440000';
      pushFeedbackRepo.findRecentByOrganization.mockResolvedValue([
        { rating: 2 },
        { rating: 2 },
        { rating: 3 },
      ] as any);
      radarPushRepo.findRecentByOrganization.mockResolvedValue([]);
      activityLogRepo.getRecentActivityCount.mockResolvedValue(0);
      activityLogRepo.getActivitySummary.mockResolvedValue({
        loginDays: 3,
        pushViewDays: 5,
        feedbackDays: 2,
        settingsDays: 0,
        totalActiveDays: 8,
      });

      // Act
      const factors = await service.getChurnRiskFactors(orgId);

      // Assert
      expect(factors).toContain('推送内容不相关');
      expect(factors).toContain('功能不满足需求');
      expect(factors).toContain('登录频率过低');
    });

    it('should identify high unread pushes as risk factor', async () => {
      // Arrange
      const orgId = '550e8400-e29b-41d4-a716-446655440000';
      pushFeedbackRepo.findRecentByOrganization.mockResolvedValue([
        { rating: 4 },
        { rating: 5 },
      ] as any);
      radarPushRepo.findRecentByOrganization.mockResolvedValue(
        Array(25).fill({ id: 'push-1' }),
      );
      activityLogRepo.getRecentActivityCount.mockResolvedValue(0);
      activityLogRepo.getActivitySummary.mockResolvedValue({
        loginDays: 15,
        pushViewDays: 5,
        feedbackDays: 2,
        settingsDays: 0,
        totalActiveDays: 18,
      });

      // Act
      const factors = await service.getChurnRiskFactors(orgId);

      // Assert
      expect(factors).toContain('推送频率过高');
    });
  });

  describe('getClientSegmentation', () => {
    it('should return correct segmentation statistics', async () => {
      // Arrange
      rawOrgRepo.find.mockResolvedValue([
        { id: '1', monthlyActivityRate: 90 },
        { id: '2', monthlyActivityRate: 85 },
        { id: '3', monthlyActivityRate: 70 },
        { id: '4', monthlyActivityRate: 50 },
        { id: '5', monthlyActivityRate: 40 },
      ] as any);

      // Act
      const result = await service.getClientSegmentation();

      // Assert
      expect(result.totalCustomers).toBe(5);
      expect(result.segments).toHaveLength(3);
      expect(result.segments[0].name).toBe('high_active');
      expect(result.segments[0].count).toBe(2);
      expect(result.segments[2].name).toBe('low_active');
      expect(result.segments[2].count).toBe(2);
    });

    it('should handle empty organization list', async () => {
      // Arrange
      rawOrgRepo.find.mockResolvedValue([]);

      // Act
      const result = await service.getClientSegmentation();

      // Assert
      expect(result.totalCustomers).toBe(0);
      expect(result.averageActivityRate).toBe(0);
    });
  });

  describe('getClientActivityList', () => {
    it('should return filtered activity list', async () => {
      // Arrange
      rawOrgRepo.find.mockResolvedValue([
        { ...mockOrganization, monthlyActivityRate: 45, activityStatus: 'churn_risk' },
      ] as any);
      activityLogRepo.getActivitySummary.mockResolvedValue({
        loginDays: 10,
        pushViewDays: 8,
        feedbackDays: 3,
        settingsDays: 1,
        totalActiveDays: 12,
      });
      jest.spyOn(service, 'getChurnRiskFactors').mockResolvedValue(['推送内容不相关']);

      // Act
      const result = await service.getClientActivityList({
        status: 'churn_risk',
        sort: 'monthlyActivityRate',
        order: 'asc',
      });

      // Assert
      expect(result.data).toHaveLength(1);
      expect(result.data[0].activityStatus).toBe('churn_risk');
      expect(result.meta.total).toBe(1);
    });
  });

  describe('batchUpdateActivityRates', () => {
    it('should update all organizations and return counts', async () => {
      // Arrange
      rawOrgRepo.find.mockResolvedValue([
        { id: '550e8400-e29b-41d4-a716-446655440001' },
        { id: '550e8400-e29b-41d4-a716-446655440002' },
        { id: '550e8400-e29b-41d4-a716-446655440003' },
      ] as any);
      activityLogRepo.getActivitySummary.mockResolvedValue({
        loginDays: 10,
        pushViewDays: 8,
        feedbackDays: 3,
        settingsDays: 1,
        totalActiveDays: 12,
      });
      rawOrgRepo.update.mockResolvedValue({} as any);
      rawOrgRepo.findOne.mockResolvedValue(mockOrganization);
      alertService.createAlert.mockResolvedValue({} as any);
      emailService.sendChurnRiskAlert.mockResolvedValue();

      // Act
      const result = await service.batchUpdateActivityRates();

      // Assert
      expect(result.updated).toBe(3);
      expect(result.churnRisks).toBe(3); // All have 40% activity rate
    });
  });
});
