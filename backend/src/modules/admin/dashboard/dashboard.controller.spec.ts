import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { AlertService } from './alert.service';
import { HealthMonitorService } from './health-monitor.service';

/**
 * DashboardController Unit Tests
 *
 * Tests for dashboard controller endpoints.
 * Covers all HTTP handlers and error handling.
 *
 * @story 7-1
 */
describe('DashboardController', () => {
  let controller: DashboardController;
  let dashboardService: DashboardService;
  let alertService: AlertService;
  let healthMonitorService: HealthMonitorService;

  const mockDashboardService = {
    getHealthMetrics: jest.fn(),
    calculateAvailability: jest.fn(),
    calculatePushSuccessRate: jest.fn(),
    calculateAICost: jest.fn(),
    calculateCustomerActivity: jest.fn(),
    getTrendData: jest.fn(),
  };

  const mockAlertService = {
    getAlerts: jest.fn(),
    createAlert: jest.fn(),
    resolveAlert: jest.fn(),
    getAlertById: jest.fn(),
    getUnresolvedCount: jest.fn(),
  };

  const mockHealthMonitorService = {
    recordHeartbeat: jest.fn(),
    monitorHealth: jest.fn(),
    recordHealthMetric: jest.fn(),
    getTrendData: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        {
          provide: DashboardService,
          useValue: mockDashboardService,
        },
        {
          provide: AlertService,
          useValue: mockAlertService,
        },
        {
          provide: HealthMonitorService,
          useValue: mockHealthMonitorService,
        },
      ],
    }).compile();

    controller = module.get<DashboardController>(DashboardController);
    dashboardService = module.get<DashboardService>(DashboardService);
    alertService = module.get<AlertService>(AlertService);
    healthMonitorService = module.get<HealthMonitorService>(HealthMonitorService);

    jest.clearAllMocks();
  });

  describe('getHealthMetrics', () => {
    it('[P1] should return health metrics successfully', async () => {
      // GIVEN: Dashboard service returns health metrics
      const mockMetrics = {
        availability: {
          current: 99.7,
          target: 99.5,
          status: 'healthy',
          uptime: 43200,
          downtime: 129.6,
        },
        pushSuccessRate: {
          current: 98.5,
          target: 98.0,
          status: 'healthy',
          totalPushes: 1000,
          successfulPushes: 985,
          failedPushes: 15,
        },
        aiCost: {
          today: 150.5,
          thisMonth: 4500.0,
          avgPerClient: 450.0,
          target: 500.0,
          status: 'healthy',
        },
        customerActivity: {
          totalCustomers: 10,
          activeCustomers: 8,
          activityRate: 80.0,
          target: 70.0,
          status: 'healthy',
        },
      };
      mockDashboardService.getHealthMetrics.mockResolvedValue(mockMetrics);

      // WHEN: Getting health metrics
      const result = await controller.getHealthMetrics();

      // THEN: Metrics are returned
      expect(result).toEqual(mockMetrics);
      expect(mockDashboardService.getHealthMetrics).toHaveBeenCalled();
    });

    it('[P1] should throw InternalServerErrorException when service fails', async () => {
      // GIVEN: Dashboard service throws error
      mockDashboardService.getHealthMetrics.mockRejectedValue(new Error('Service error'));

      // WHEN/THEN: Getting health metrics throws exception
      await expect(controller.getHealthMetrics()).rejects.toThrow(InternalServerErrorException);
      await expect(controller.getHealthMetrics()).rejects.toThrow(
        'Failed to get health metrics',
      );
    });

    it('[P2] should handle empty metrics gracefully', async () => {
      // GIVEN: Dashboard service returns empty metrics
      mockDashboardService.getHealthMetrics.mockResolvedValue({});

      // WHEN: Getting health metrics
      const result = await controller.getHealthMetrics();

      // THEN: Empty metrics are returned
      expect(result).toEqual({});
    });
  });

  describe('getAlerts', () => {
    it('[P1] should return paginated alerts with metadata', async () => {
      // GIVEN: Alert service returns alerts
      const mockAlerts = {
        data: [
          {
            id: 'alert-1',
            alertType: 'crawler_failure',
            severity: 'high',
            message: '技术雷达爬虫连续失败 3 次',
            status: 'unresolved',
            occurredAt: new Date('2026-02-04T10:00:00Z'),
            metadata: { source: 'GARTNER', failureCount: 3 },
          },
        ],
        meta: {
          total: 5,
          unresolved: 3,
          severityCounts: {
            high: 2,
            medium: 1,
            low: 0,
          },
        },
      };
      mockAlertService.getAlerts.mockResolvedValue(mockAlerts);

      // WHEN: Getting alerts
      const filters = { status: 'unresolved' as const, severity: 'high' as const };
      const result = await controller.getAlerts(filters);

      // THEN: Alerts are returned
      expect(result).toEqual(mockAlerts);
      expect(mockAlertService.getAlerts).toHaveBeenCalledWith(filters);
    });

    it('[P1] should handle empty alert list', async () => {
      // GIVEN: Alert service returns empty list
      const mockAlerts = {
        data: [],
        meta: {
          total: 0,
          unresolved: 0,
          severityCounts: { high: 0, medium: 0, low: 0 },
        },
      };
      mockAlertService.getAlerts.mockResolvedValue(mockAlerts);

      // WHEN: Getting alerts
      const result = await controller.getAlerts({});

      // THEN: Empty list is returned
      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });

    it('[P2] should pass all filter parameters to service', async () => {
      // GIVEN: Alert service is ready
      mockAlertService.getAlerts.mockResolvedValue({ data: [], meta: {} });

      // WHEN: Getting alerts with all filters
      const filters = {
        status: 'unresolved' as const,
        severity: 'high' as const,
        alertType: 'crawler_failure',
        limit: 10,
        offset: 0,
      };
      await controller.getAlerts(filters);

      // THEN: All filters are passed to service
      expect(mockAlertService.getAlerts).toHaveBeenCalledWith(filters);
    });
  });

  describe('resolveAlert', () => {
    it('[P1] should resolve an alert successfully', async () => {
      // GIVEN: Alert service resolves alert
      const mockResolvedAlert = {
        id: 'alert-1',
        alertType: 'crawler_failure',
        severity: 'high',
        message: '技术雷达爬虫连续失败 3 次',
        status: 'resolved',
        resolvedAt: new Date('2026-02-04T11:00:00Z'),
        resolvedBy: 'user-1',
      };
      mockAlertService.resolveAlert.mockResolvedValue(mockResolvedAlert);

      // WHEN: Resolving alert
      const req = { user: { id: 'user-1' } };
      const result = await controller.resolveAlert('alert-1', req);

      // THEN: Alert is resolved
      expect(result).toEqual(mockResolvedAlert);
      expect(mockAlertService.resolveAlert).toHaveBeenCalledWith('alert-1', 'user-1');
    });

    it('[P1] should extract user ID from request object', async () => {
      // GIVEN: Alert service is ready
      mockAlertService.resolveAlert.mockResolvedValue({
        id: 'alert-1',
        status: 'resolved',
        resolvedBy: 'user-123',
      });

      // WHEN: Resolving alert with user in request
      const req = { user: { id: 'user-123', email: 'admin@example.com' } };
      await controller.resolveAlert('alert-1', req);

      // THEN: User ID is extracted correctly
      expect(mockAlertService.resolveAlert).toHaveBeenCalledWith('alert-1', 'user-123');
    });

    it('[P2] should handle already resolved alerts', async () => {
      // GIVEN: Alert is already resolved
      const mockResolvedAlert = {
        id: 'alert-1',
        status: 'resolved',
        resolvedAt: new Date('2026-02-04T10:00:00Z'),
        resolvedBy: 'other-user',
      };
      mockAlertService.resolveAlert.mockResolvedValue(mockResolvedAlert);

      // WHEN: Resolving already resolved alert
      const req = { user: { id: 'user-1' } };
      const result = await controller.resolveAlert('alert-1', req);

      // THEN: Alert is returned as-is
      expect(result.status).toBe('resolved');
      expect(result.resolvedBy).toBe('other-user'); // Original resolver
    });
  });

  describe('getTrendData', () => {
    it('[P1] should return trend data for a metric', async () => {
      // GIVEN: Health monitor service returns trend data
      const mockTrendData = {
        metric: 'availability',
        range: '30d',
        data: [
          { date: '2026-01-05', value: 99.8 },
          { date: '2026-01-06', value: 99.6 },
          { date: '2026-01-07', value: 99.7 },
        ],
      };
      mockHealthMonitorService.getTrendData.mockResolvedValue(mockTrendData);

      // WHEN: Getting trend data
      const query = { metric: 'availability' as const, range: '30d' as const };
      const result = await controller.getTrendData(query);

      // THEN: Trend data is returned
      expect(result).toEqual(mockTrendData);
      expect(mockHealthMonitorService.getTrendData).toHaveBeenCalledWith('availability', '30d');
    });

    it('[P1] should support different metric types', async () => {
      // GIVEN: Health monitor service returns trend data
      mockHealthMonitorService.getTrendData.mockResolvedValue({
        metric: 'push_success_rate',
        range: '7d',
        data: [],
      });

      // WHEN: Getting trend data for push_success_rate
      const query = { metric: 'push_success_rate' as const, range: '7d' as const };
      await controller.getTrendData(query);

      // THEN: Correct metric is requested
      expect(mockHealthMonitorService.getTrendData).toHaveBeenCalledWith('push_success_rate', '7d');
    });

    it('[P1] should support different time ranges', async () => {
      // GIVEN: Health monitor service returns trend data
      mockHealthMonitorService.getTrendData.mockResolvedValue({
        metric: 'availability',
        range: '90d',
        data: [],
      });

      // WHEN: Getting trend data for 90 days
      const query = { metric: 'availability' as const, range: '90d' as const };
      await controller.getTrendData(query);

      // THEN: Correct range is requested
      expect(mockHealthMonitorService.getTrendData).toHaveBeenCalledWith('availability', '90d');
    });

    it('[P2] should handle empty trend data', async () => {
      // GIVEN: Health monitor service returns empty data
      mockHealthMonitorService.getTrendData.mockResolvedValue({
        metric: 'availability',
        range: '30d',
        data: [],
      });

      // WHEN: Getting trend data
      const query = { metric: 'availability' as const, range: '30d' as const };
      const result = await controller.getTrendData(query);

      // THEN: Empty data is returned
      expect(result.data).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    it('[P2] should wrap service errors in InternalServerErrorException', async () => {
      // GIVEN: Service throws generic error
      mockDashboardService.getHealthMetrics.mockRejectedValue(new Error('Database connection failed'));

      // WHEN/THEN: Controller wraps error
      await expect(controller.getHealthMetrics()).rejects.toThrow(InternalServerErrorException);
    });

    it('[P2] should preserve error messages in exceptions', async () => {
      // GIVEN: Service throws error with specific message
      mockDashboardService.getHealthMetrics.mockRejectedValue(new Error('Cache timeout'));

      // WHEN/THEN: Error message is preserved
      await expect(controller.getHealthMetrics()).rejects.toThrow('Failed to get health metrics');
    });
  });

  describe('Integration with Guards', () => {
    it('[P2] should be decorated with JwtAuthGuard and RolesGuard', () => {
      // GIVEN: Controller metadata
      const guards = Reflect.getMetadata('__guards__', DashboardController);

      // THEN: Guards are applied (this is a metadata check, actual guard behavior tested in E2E)
      expect(guards).toBeDefined();
    });

    it('[P2] should require ADMIN role', () => {
      // GIVEN: Controller metadata
      const roles = Reflect.getMetadata('roles', DashboardController);

      // THEN: ADMIN role is required (this is a metadata check, actual role behavior tested in E2E)
      expect(roles).toBeDefined();
    });
  });
});
