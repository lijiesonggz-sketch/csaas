import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { Logger } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { HealthMonitorService } from './health-monitor.service';
import { SystemHealthLogRepository } from '../../../database/repositories/system-health-log.repository';
import { AlertService } from './alert.service';
import { DashboardService } from './dashboard.service';

/**
 * HealthMonitorService Unit Tests
 *
 * Tests for health monitoring cron jobs and metric recording.
 * Covers recordHeartbeat(), monitorHealth(), and recordHealthMetric().
 *
 * @story 7-1
 */
describe('HealthMonitorService', () => {
  let service: HealthMonitorService;
  let systemHealthLogRepo: SystemHealthLogRepository;
  let alertService: AlertService;
  let dashboardService: DashboardService;
  let httpService: HttpService;

  const mockSystemHealthLogRepo = {
    create: jest.fn(),
    findByMetricType: jest.fn(),
  };

  const mockAlertService = {
    createAlert: jest.fn(),
  };

  const mockDashboardService = {
    calculateAvailability: jest.fn(),
    calculatePushSuccessRate: jest.fn(),
    calculateAICost: jest.fn(),
    calculateCustomerActivity: jest.fn(),
    getTrendData: jest.fn(),
  };

  const mockHttpService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthMonitorService,
        {
          provide: SystemHealthLogRepository,
          useValue: mockSystemHealthLogRepo,
        },
        {
          provide: AlertService,
          useValue: mockAlertService,
        },
        {
          provide: DashboardService,
          useValue: mockDashboardService,
        },
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
      ],
    }).compile();

    service = module.get<HealthMonitorService>(HealthMonitorService);
    systemHealthLogRepo = module.get<SystemHealthLogRepository>(SystemHealthLogRepository);
    alertService = module.get<AlertService>(AlertService);
    dashboardService = module.get<DashboardService>(DashboardService);
    httpService = module.get<HttpService>(HttpService);

    // Mock logger to suppress console output in tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('recordHeartbeat', () => {
    it('[P1] should record uptime when health check succeeds with fast response', async () => {
      // GIVEN: Health check endpoint responds in < 10s
      const mockResponse = { status: 200, data: { status: 'ok' } };
      mockHttpService.get.mockReturnValue(of(mockResponse));
      mockSystemHealthLogRepo.create.mockResolvedValue({});

      // WHEN: Recording heartbeat
      await service.recordHeartbeat();

      // THEN: Uptime is recorded
      expect(mockHttpService.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ timeout: 15000 }),
      );
      expect(mockSystemHealthLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metricType: 'availability',
          metricValue: 1,
          status: 'healthy',
          metadata: expect.objectContaining({
            uptime: true,
            responseTime: expect.any(Number),
          }),
        }),
      );
      expect(mockAlertService.createAlert).not.toHaveBeenCalled();
    });

    it('[P1] should record downtime and create alert when response time > 10s', async () => {
      // GIVEN: Health check endpoint responds slowly (> 10s)
      // We'll test this by mocking Date.now() to simulate a slow response
      const mockResponse = { status: 200, data: { status: 'ok' } };

      // Create a proper observable that resolves immediately
      mockHttpService.get.mockReturnValue(of(mockResponse));

      mockSystemHealthLogRepo.create.mockResolvedValue({});
      mockAlertService.createAlert.mockResolvedValue({});

      // Mock Date.now() to simulate slow response (11 seconds)
      const originalDateNow = Date.now;
      let callCount = 0;
      jest.spyOn(Date, 'now').mockImplementation(() => {
        callCount++;
        if (callCount === 1) return 1000; // Start time
        return 12000; // End time (11s later = slow response)
      });

      // WHEN: Recording heartbeat
      await service.recordHeartbeat();

      // THEN: Downtime is recorded and alert is created
      expect(mockSystemHealthLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metricType: 'availability',
          metricValue: 0,
          status: 'critical',
          metadata: expect.objectContaining({
            downtime: true,
            responseTime: 11000,
            reason: 'slow_response',
          }),
        }),
      );
      expect(mockAlertService.createAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          alertType: 'system_downtime',
          severity: 'high',
          message: expect.stringContaining('exceeded 10 seconds'),
        }),
      );

      // Restore Date.now
      Date.now = originalDateNow;
    });

    it('[P1] should record downtime and create alert when health check fails with 5xx error', async () => {
      // GIVEN: Health check endpoint returns 5xx error
      const error = new Error('Internal Server Error');
      mockHttpService.get.mockReturnValue(throwError(() => error));
      mockSystemHealthLogRepo.create.mockResolvedValue({});
      mockAlertService.createAlert.mockResolvedValue({});

      // WHEN: Recording heartbeat
      await service.recordHeartbeat();

      // THEN: Downtime is recorded and alert is created
      expect(mockSystemHealthLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metricType: 'availability',
          metricValue: 0,
          status: 'critical',
          metadata: expect.objectContaining({
            downtime: true,
            error: 'Internal Server Error',
          }),
        }),
      );
      expect(mockAlertService.createAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          alertType: 'system_downtime',
          severity: 'high',
          message: expect.stringContaining('health check failed'),
        }),
      );
    });

    it('[P2] should handle errors gracefully and log them', async () => {
      // GIVEN: SystemHealthLogRepository throws error
      mockHttpService.get.mockReturnValue(of({ status: 200 }));
      mockSystemHealthLogRepo.create.mockRejectedValue(new Error('DB error'));

      // WHEN: Recording heartbeat
      await service.recordHeartbeat();

      // THEN: Error is logged but doesn't throw
      expect(Logger.prototype.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to record heartbeat'),
      );
    });
  });

  describe('monitorHealth', () => {
    beforeEach(() => {
      // Mock all dashboard calculations
      mockDashboardService.calculateAvailability.mockResolvedValue({
        current: 99.7,
        target: 99.5,
        status: 'healthy',
      });
      mockDashboardService.calculatePushSuccessRate.mockResolvedValue({
        current: 98.5,
        target: 98.0,
        status: 'healthy',
      });
      mockDashboardService.calculateAICost.mockResolvedValue({
        avgPerClient: 450,
        target: 500,
        status: 'healthy',
      });
      mockDashboardService.calculateCustomerActivity.mockResolvedValue({
        activityRate: 75,
        target: 70,
        status: 'healthy',
      });
      mockSystemHealthLogRepo.create.mockResolvedValue({});
      mockAlertService.createAlert.mockResolvedValue({});
    });

    it('[P1] should monitor all health metrics and record them', async () => {
      // GIVEN: All metrics are healthy
      // WHEN: Running health monitoring
      await service.monitorHealth();

      // THEN: All metrics are calculated and recorded
      expect(mockDashboardService.calculateAvailability).toHaveBeenCalled();
      expect(mockDashboardService.calculatePushSuccessRate).toHaveBeenCalled();
      expect(mockDashboardService.calculateAICost).toHaveBeenCalled();
      expect(mockDashboardService.calculateCustomerActivity).toHaveBeenCalled();

      // Verify recordHealthMetric was called for each metric
      expect(mockSystemHealthLogRepo.create).toHaveBeenCalledTimes(4);
      expect(mockSystemHealthLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ metricType: 'availability' }),
      );
      expect(mockSystemHealthLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ metricType: 'push_success_rate' }),
      );
      expect(mockSystemHealthLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ metricType: 'ai_cost' }),
      );
      expect(mockSystemHealthLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ metricType: 'customer_activity' }),
      );
    });

    it('[P1] should create alert when availability is below target', async () => {
      // GIVEN: Availability is below target
      mockDashboardService.calculateAvailability.mockResolvedValue({
        current: 99.0,
        target: 99.5,
        status: 'critical',
      });

      // WHEN: Running health monitoring
      await service.monitorHealth();

      // THEN: Alert is created for low availability
      expect(mockAlertService.createAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          alertType: 'system_downtime',
          severity: 'high',
          message: expect.stringContaining('availability'),
        }),
      );
    });

    it('[P1] should create alert when push success rate is below target', async () => {
      // GIVEN: Push success rate is below target
      mockDashboardService.calculatePushSuccessRate.mockResolvedValue({
        current: 95.0,
        target: 98.0,
        status: 'critical',
      });

      // WHEN: Running health monitoring
      await service.monitorHealth();

      // THEN: Alert is created for low push success rate
      expect(mockAlertService.createAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          alertType: 'push_failure_high',
          severity: 'high',
          message: expect.stringContaining('Push success rate'),
        }),
      );
    });

    it('[P1] should create alert when AI cost exceeds target', async () => {
      // GIVEN: AI cost exceeds target
      mockDashboardService.calculateAICost.mockResolvedValue({
        avgPerClient: 600,
        target: 500,
        status: 'critical',
      });

      // WHEN: Running health monitoring
      await service.monitorHealth();

      // THEN: Alert is created for high AI cost
      expect(mockAlertService.createAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          alertType: 'ai_cost_exceeded',
          severity: 'medium',
          message: expect.stringContaining('AI cost per client'),
        }),
      );
    });

    it('[P1] should create alert when customer activity is below 60%', async () => {
      // GIVEN: Customer activity is below 60%
      mockDashboardService.calculateCustomerActivity.mockResolvedValue({
        activityRate: 55,
        target: 70,
        status: 'critical',
      });

      // WHEN: Running health monitoring
      await service.monitorHealth();

      // THEN: Alert is created for low customer activity
      expect(mockAlertService.createAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          alertType: 'customer_churn_risk',
          severity: 'medium',
          message: expect.stringContaining('Customer activity rate'),
        }),
      );
    });

    it('[P2] should handle errors gracefully and log them', async () => {
      // GIVEN: Dashboard service throws error
      mockDashboardService.calculateAvailability.mockRejectedValue(new Error('Calculation error'));

      // WHEN: Running health monitoring
      await service.monitorHealth();

      // THEN: Error is logged but doesn't throw
      expect(Logger.prototype.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to monitor health'),
      );
    });
  });

  describe('recordHealthMetric', () => {
    it('[P1] should record availability metric with healthy status when above target + 1', async () => {
      // GIVEN: Availability is well above target (target + 1 or more)
      mockSystemHealthLogRepo.create.mockResolvedValue({});

      // WHEN: Recording availability metric (100.6 > 99.5 + 1)
      await service.recordHealthMetric('availability', 100.6, 99.5);

      // THEN: Metric is recorded with healthy status
      expect(mockSystemHealthLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metricType: 'availability',
          metricValue: 100.6,
          targetValue: 99.5,
          status: 'healthy',
        }),
      );
    });

    it('[P1] should record availability metric with critical status when below target', async () => {
      // GIVEN: Availability is below target
      mockSystemHealthLogRepo.create.mockResolvedValue({});

      // WHEN: Recording availability metric
      await service.recordHealthMetric('availability', 99.0, 99.5);

      // THEN: Metric is recorded with critical status
      expect(mockSystemHealthLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metricType: 'availability',
          metricValue: 99.0,
          targetValue: 99.5,
          status: 'critical',
        }),
      );
    });

    it('[P1] should record push_success_rate metric with warning status when slightly below target', async () => {
      // GIVEN: Push success rate is slightly below target
      mockSystemHealthLogRepo.create.mockResolvedValue({});

      // WHEN: Recording push success rate metric
      await service.recordHealthMetric('push_success_rate', 98.5, 98.0);

      // THEN: Metric is recorded with warning status
      expect(mockSystemHealthLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metricType: 'push_success_rate',
          metricValue: 98.5,
          targetValue: 98.0,
          status: 'warning',
        }),
      );
    });

    it('[P1] should record ai_cost metric with critical status when exceeding target', async () => {
      // GIVEN: AI cost exceeds target
      mockSystemHealthLogRepo.create.mockResolvedValue({});

      // WHEN: Recording AI cost metric
      await service.recordHealthMetric('ai_cost', 600, 500);

      // THEN: Metric is recorded with critical status
      expect(mockSystemHealthLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metricType: 'ai_cost',
          metricValue: 600,
          targetValue: 500,
          status: 'critical',
        }),
      );
    });

    it('[P1] should record ai_cost metric with warning status when approaching target', async () => {
      // GIVEN: AI cost is at 90% of target
      mockSystemHealthLogRepo.create.mockResolvedValue({});

      // WHEN: Recording AI cost metric
      await service.recordHealthMetric('ai_cost', 460, 500);

      // THEN: Metric is recorded with warning status
      expect(mockSystemHealthLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metricType: 'ai_cost',
          metricValue: 460,
          targetValue: 500,
          status: 'warning',
        }),
      );
    });

    it('[P1] should record customer_activity metric with critical status when below 60%', async () => {
      // GIVEN: Customer activity is below 60%
      mockSystemHealthLogRepo.create.mockResolvedValue({});

      // WHEN: Recording customer activity metric
      await service.recordHealthMetric('customer_activity', 55, 70);

      // THEN: Metric is recorded with critical status
      expect(mockSystemHealthLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metricType: 'customer_activity',
          metricValue: 55,
          targetValue: 70,
          status: 'critical',
        }),
      );
    });

    it('[P1] should record customer_activity metric with warning status when below target but above 60%', async () => {
      // GIVEN: Customer activity is below target but above 60%
      mockSystemHealthLogRepo.create.mockResolvedValue({});

      // WHEN: Recording customer activity metric
      await service.recordHealthMetric('customer_activity', 65, 70);

      // THEN: Metric is recorded with warning status
      expect(mockSystemHealthLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metricType: 'customer_activity',
          metricValue: 65,
          targetValue: 70,
          status: 'warning',
        }),
      );
    });

    it('[P2] should handle errors gracefully and log them', async () => {
      // GIVEN: Repository throws error
      mockSystemHealthLogRepo.create.mockRejectedValue(new Error('DB error'));

      // WHEN: Recording metric
      await service.recordHealthMetric('availability', 99.7, 99.5);

      // THEN: Error is logged but doesn't throw
      expect(Logger.prototype.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to record health metric'),
      );
    });
  });

  describe('getTrendData', () => {
    it('[P1] should delegate to DashboardService.getTrendData', async () => {
      // GIVEN: Dashboard service returns trend data
      const mockTrendData = {
        metric: 'availability',
        range: '30d',
        data: [
          { date: '2026-01-01', value: 99.5 },
          { date: '2026-01-02', value: 99.7 },
        ],
      };
      mockDashboardService.getTrendData.mockResolvedValue(mockTrendData);

      // WHEN: Getting trend data
      const result = await service.getTrendData('availability', '30d');

      // THEN: Dashboard service is called and result is returned
      expect(mockDashboardService.getTrendData).toHaveBeenCalledWith('availability', '30d');
      expect(result).toEqual(mockTrendData);
    });
  });
});
