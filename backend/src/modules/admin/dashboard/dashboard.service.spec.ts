import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { DataSource } from 'typeorm';
import { DashboardService } from './dashboard.service';
import { SystemHealthLogRepository } from '../../../database/repositories/system-health-log.repository';
import { AlertRepository } from '../../../database/repositories/alert.repository';
import { RadarPushRepository } from '../../../database/repositories/radar-push.repository';
import { OrganizationRepository } from '../../../database/repositories/organization.repository';
import { InternalServerErrorException } from '@nestjs/common';

describe('DashboardService', () => {
  let service: DashboardService;
  let systemHealthLogRepo: SystemHealthLogRepository;
  let alertRepo: AlertRepository;
  let radarPushRepo: RadarPushRepository;
  let organizationRepo: OrganizationRepository;
  let dataSource: DataSource;
  let cacheManager: any;

  const mockSystemHealthLogRepo = {
    findByMetricType: jest.fn(),
    create: jest.fn(),
    getLatestByMetricType: jest.fn(),
  };

  const mockAlertRepo = {
    findWithFilters: jest.fn(),
    countUnresolved: jest.fn(),
    countBySeverity: jest.fn(),
  };

  const mockRadarPushRepo = {};

  const mockOrganizationRepo = {};

  const mockDataSource = {
    query: jest.fn(),
  };

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: SystemHealthLogRepository,
          useValue: mockSystemHealthLogRepo,
        },
        {
          provide: AlertRepository,
          useValue: mockAlertRepo,
        },
        {
          provide: RadarPushRepository,
          useValue: mockRadarPushRepo,
        },
        {
          provide: OrganizationRepository,
          useValue: mockOrganizationRepo,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    systemHealthLogRepo = module.get<SystemHealthLogRepository>(SystemHealthLogRepository);
    alertRepo = module.get<AlertRepository>(AlertRepository);
    radarPushRepo = module.get<RadarPushRepository>(RadarPushRepository);
    organizationRepo = module.get<OrganizationRepository>(OrganizationRepository);
    dataSource = module.get<DataSource>(DataSource);
    cacheManager = module.get(CACHE_MANAGER);

    jest.clearAllMocks();
  });

  describe('getHealthMetrics', () => {
    it('should return cached metrics if available', async () => {
      const cachedMetrics = {
        availability: { current: 99.7, target: 99.5, status: 'healthy' },
        pushSuccessRate: { current: 98.5, target: 98.0, status: 'healthy' },
        aiCost: { today: 150, thisMonth: 4500, avgPerClient: 450, target: 500, status: 'healthy' },
        customerActivity: { totalCustomers: 10, activeCustomers: 8, activityRate: 80, target: 70, status: 'healthy' },
      };

      mockCacheManager.get.mockResolvedValue(cachedMetrics);

      const result = await service.getHealthMetrics();

      expect(result).toEqual(cachedMetrics);
      expect(mockCacheManager.get).toHaveBeenCalledWith('dashboard:health');
      expect(mockCacheManager.set).not.toHaveBeenCalled();
    });

    it('should calculate and cache metrics if not cached', async () => {
      mockCacheManager.get.mockResolvedValue(null);

      // Mock calculateAvailability
      mockSystemHealthLogRepo.findByMetricType.mockResolvedValue([
        { metricValue: 1 },
        { metricValue: 1 },
        { metricValue: 0 },
      ]);

      // Mock calculatePushSuccessRate
      mockDataSource.query.mockResolvedValueOnce([
        { total: '100', successful: '98', failed: '2' },
      ]);

      // Mock calculateAICost
      mockDataSource.query.mockResolvedValueOnce([
        { today: '150', this_month: '4500' },
      ]);
      mockDataSource.query.mockResolvedValueOnce([{ count: '10' }]);

      // Mock calculateCustomerActivity
      mockDataSource.query.mockResolvedValueOnce([{ count: '10' }]);
      mockDataSource.query.mockResolvedValueOnce([{ count: '8' }]);

      const result = await service.getHealthMetrics();

      expect(result).toHaveProperty('availability');
      expect(result).toHaveProperty('pushSuccessRate');
      expect(result).toHaveProperty('aiCost');
      expect(result).toHaveProperty('customerActivity');
      expect(mockCacheManager.set).toHaveBeenCalledWith('dashboard:health', result, 300000);
    });

    it('should throw InternalServerErrorException on error', async () => {
      mockCacheManager.get.mockRejectedValue(new Error('Cache error'));

      await expect(service.getHealthMetrics()).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('calculateAvailability', () => {
    it('should calculate availability from logs', async () => {
      const logs = [
        { metricValue: 1 },
        { metricValue: 1 },
        { metricValue: 1 },
        { metricValue: 0 },
      ];

      mockSystemHealthLogRepo.findByMetricType.mockResolvedValue(logs);

      const result = await service.calculateAvailability();

      expect(result.current).toBe(75.0); // 3/4 * 100
      expect(result.target).toBe(99.5);
      expect(result.status).toBe('critical'); // < 99.5%
    });

    it('should return 100% availability when no logs exist', async () => {
      mockSystemHealthLogRepo.findByMetricType.mockResolvedValue([]);

      const result = await service.calculateAvailability();

      expect(result.current).toBe(100.0);
      expect(result.target).toBe(99.5);
      expect(result.status).toBe('healthy');
      expect(result.uptime).toBe(86400); // 24 hours in seconds
      expect(result.downtime).toBe(0);
    });

    it('should throw InternalServerErrorException on error', async () => {
      mockSystemHealthLogRepo.findByMetricType.mockRejectedValue(new Error('DB error'));

      await expect(service.calculateAvailability()).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('calculatePushSuccessRate', () => {
    it('should calculate push success rate', async () => {
      mockDataSource.query.mockResolvedValue([
        { total: '100', successful: '98', failed: '2' },
      ]);

      const result = await service.calculatePushSuccessRate();

      expect(result.current).toBe(98.0);
      expect(result.target).toBe(98.0);
      expect(result.status).toBe('healthy');
      expect(result.totalPushes).toBe(100);
      expect(result.successfulPushes).toBe(98);
      expect(result.failedPushes).toBe(2);
    });

    it('should return 100% when no pushes exist', async () => {
      mockDataSource.query.mockResolvedValue([
        { total: '0', successful: '0', failed: '0' },
      ]);

      const result = await service.calculatePushSuccessRate();

      expect(result.current).toBe(100.0);
      expect(result.totalPushes).toBe(0);
    });

    it('should mark as critical when below target', async () => {
      mockDataSource.query.mockResolvedValue([
        { total: '100', successful: '95', failed: '5' },
      ]);

      const result = await service.calculatePushSuccessRate();

      expect(result.current).toBe(95.0);
      expect(result.status).toBe('critical'); // < 98%
    });
  });

  describe('calculateAICost', () => {
    it('should calculate AI cost metrics', async () => {
      mockDataSource.query.mockResolvedValueOnce([
        { today: '150', this_month: '4500' },
      ]);
      mockDataSource.query.mockResolvedValueOnce([{ count: '10' }]);

      const result = await service.calculateAICost();

      expect(result.today).toBe(150.0);
      expect(result.thisMonth).toBe(4500.0);
      expect(result.avgPerClient).toBe(450.0); // 4500 / 10
      expect(result.target).toBe(500.0);
      expect(result.status).toBe('healthy');
    });

    it('should return mock data when table is empty', async () => {
      mockDataSource.query.mockRejectedValue(new Error('Table does not exist'));

      const result = await service.calculateAICost();

      expect(result.today).toBe(0);
      expect(result.thisMonth).toBe(0);
      expect(result.avgPerClient).toBe(0);
      expect(result.status).toBe('healthy');
    });

    it('should mark as critical when exceeding target', async () => {
      mockDataSource.query.mockResolvedValueOnce([
        { today: '200', this_month: '6000' },
      ]);
      mockDataSource.query.mockResolvedValueOnce([{ count: '10' }]);

      const result = await service.calculateAICost();

      expect(result.avgPerClient).toBe(600.0); // 6000 / 10
      expect(result.status).toBe('critical'); // > 500
    });
  });

  describe('calculateCustomerActivity', () => {
    it('should calculate customer activity rate', async () => {
      mockDataSource.query.mockResolvedValueOnce([{ count: '10' }]); // total
      mockDataSource.query.mockResolvedValueOnce([{ count: '8' }]); // active

      const result = await service.calculateCustomerActivity();

      expect(result.totalCustomers).toBe(10);
      expect(result.activeCustomers).toBe(8);
      expect(result.activityRate).toBe(80.0);
      expect(result.target).toBe(70.0);
      expect(result.status).toBe('healthy');
    });

    it('should return 0 when no customers exist', async () => {
      mockDataSource.query.mockResolvedValueOnce([{ count: '0' }]);

      const result = await service.calculateCustomerActivity();

      expect(result.totalCustomers).toBe(0);
      expect(result.activeCustomers).toBe(0);
      expect(result.activityRate).toBe(0);
    });

    it('should mark as warning when below target', async () => {
      mockDataSource.query.mockResolvedValueOnce([{ count: '10' }]);
      mockDataSource.query.mockResolvedValueOnce([{ count: '6' }]);

      const result = await service.calculateCustomerActivity();

      expect(result.activityRate).toBe(60.0);
      expect(result.status).toBe('warning'); // < 70%
    });
  });

  describe('getTrendData', () => {
    it('should return trend data for a metric', async () => {
      const logs = [
        { recordedAt: new Date('2026-01-01'), metricValue: 99.5 },
        { recordedAt: new Date('2026-01-02'), metricValue: 99.7 },
        { recordedAt: new Date('2026-01-03'), metricValue: 99.6 },
      ];

      mockSystemHealthLogRepo.findByMetricType.mockResolvedValue(logs);

      const result = await service.getTrendData('availability', '7d');

      expect(result.metric).toBe('availability');
      expect(result.range).toBe('7d');
      expect(result.data).toBeInstanceOf(Array);
      expect(result.data.length).toBeGreaterThan(0);
    });

    it('should throw InternalServerErrorException on error', async () => {
      mockSystemHealthLogRepo.findByMetricType.mockRejectedValue(new Error('DB error'));

      await expect(service.getTrendData('availability', '7d')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
