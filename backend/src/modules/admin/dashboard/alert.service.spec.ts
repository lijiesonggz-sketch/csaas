import { Test, TestingModule } from '@nestjs/testing';
import { AlertService } from './alert.service';
import { AlertRepository } from '../../../database/repositories/alert.repository';
import { NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';

describe('AlertService', () => {
  let service: AlertService;
  let alertRepo: AlertRepository;

  const mockAlertRepo = {
    findWithFilters: jest.fn(),
    countUnresolved: jest.fn(),
    countBySeverity: jest.fn(),
    findRecentDuplicate: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
    resolve: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertService,
        {
          provide: AlertRepository,
          useValue: mockAlertRepo,
        },
      ],
    }).compile();

    service = module.get<AlertService>(AlertService);
    alertRepo = module.get<AlertRepository>(AlertRepository);

    jest.clearAllMocks();
  });

  describe('getAlerts', () => {
    it('should return alerts with metadata', async () => {
      const mockAlerts = [
        {
          id: 'alert-1',
          alertType: 'crawler_failure',
          severity: 'high',
          message: 'Test alert',
          status: 'unresolved',
        },
      ];

      mockAlertRepo.findWithFilters.mockResolvedValue({
        data: mockAlerts,
        total: 1,
      });
      mockAlertRepo.countUnresolved.mockResolvedValue(1);
      mockAlertRepo.countBySeverity.mockResolvedValue({
        high: 1,
        medium: 0,
        low: 0,
      });

      const result = await service.getAlerts({ status: 'unresolved' });

      expect(result.data).toEqual(mockAlerts);
      expect(result.meta.total).toBe(1);
      expect(result.meta.unresolved).toBe(1);
      expect(result.meta.severityCounts).toEqual({ high: 1, medium: 0, low: 0 });
    });

    it('should throw BadRequestException for invalid status filter', async () => {
      await expect(
        service.getAlerts({ status: 'invalid' as any }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid severity filter', async () => {
      await expect(
        service.getAlerts({ severity: 'invalid' as any }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw InternalServerErrorException on repository error', async () => {
      mockAlertRepo.findWithFilters.mockRejectedValue(new Error('DB error'));

      await expect(service.getAlerts({})).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('createAlert', () => {
    it('should create a new alert', async () => {
      const alertData = {
        alertType: 'crawler_failure' as const,
        severity: 'high' as const,
        message: 'Test alert',
        metadata: { source: 'GARTNER' },
      };

      mockAlertRepo.findRecentDuplicate.mockResolvedValue(null);
      mockAlertRepo.create.mockResolvedValue({
        id: 'alert-1',
        ...alertData,
        status: 'unresolved',
        occurredAt: new Date(),
      });

      const result = await service.createAlert(alertData);

      expect(result.id).toBe('alert-1');
      expect(result.alertType).toBe('crawler_failure');
      expect(mockAlertRepo.findRecentDuplicate).toHaveBeenCalledWith('crawler_failure', 1);
      expect(mockAlertRepo.create).toHaveBeenCalled();
    });

    it('should return existing alert if duplicate found within 1 hour', async () => {
      const alertData = {
        alertType: 'crawler_failure' as const,
        severity: 'high' as const,
        message: 'Test alert',
      };

      const existingAlert = {
        id: 'alert-1',
        ...alertData,
        status: 'unresolved',
        occurredAt: new Date(),
      };

      mockAlertRepo.findRecentDuplicate.mockResolvedValue(existingAlert);

      const result = await service.createAlert(alertData);

      expect(result).toEqual(existingAlert);
      expect(mockAlertRepo.create).not.toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException on error', async () => {
      const alertData = {
        alertType: 'crawler_failure' as const,
        severity: 'high' as const,
        message: 'Test alert',
      };

      mockAlertRepo.findRecentDuplicate.mockRejectedValue(new Error('DB error'));

      await expect(service.createAlert(alertData)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('resolveAlert', () => {
    it('should resolve an alert', async () => {
      const alertId = 'alert-1';
      const userId = 'user-1';

      const unresolvedAlert = {
        id: alertId,
        status: 'unresolved',
        alertType: 'crawler_failure',
        severity: 'high',
        message: 'Test alert',
      };

      const resolvedAlert = {
        ...unresolvedAlert,
        status: 'resolved',
        resolvedAt: new Date(),
        resolvedBy: userId,
      };

      mockAlertRepo.findById.mockResolvedValue(unresolvedAlert);
      mockAlertRepo.resolve.mockResolvedValue(resolvedAlert);

      const result = await service.resolveAlert(alertId, userId);

      expect(result.status).toBe('resolved');
      expect(result.resolvedBy).toBe(userId);
      expect(mockAlertRepo.resolve).toHaveBeenCalledWith(alertId, userId);
    });

    it('should throw NotFoundException if alert not found', async () => {
      mockAlertRepo.findById.mockResolvedValue(null);

      await expect(service.resolveAlert('invalid-id', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('should return alert as-is if already resolved', async () => {
      const alertId = 'alert-1';
      const userId = 'user-1';

      const resolvedAlert = {
        id: alertId,
        status: 'resolved',
        alertType: 'crawler_failure',
        severity: 'high',
        message: 'Test alert',
        resolvedAt: new Date(),
        resolvedBy: 'other-user',
      };

      mockAlertRepo.findById.mockResolvedValue(resolvedAlert);

      const result = await service.resolveAlert(alertId, userId);

      expect(result).toEqual(resolvedAlert);
      expect(mockAlertRepo.resolve).not.toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException on error', async () => {
      mockAlertRepo.findById.mockRejectedValue(new Error('DB error'));

      await expect(service.resolveAlert('alert-1', 'user-1')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('getAlertById', () => {
    it('should return alert by ID', async () => {
      const alert = {
        id: 'alert-1',
        alertType: 'crawler_failure',
        severity: 'high',
        message: 'Test alert',
        status: 'unresolved',
      };

      mockAlertRepo.findById.mockResolvedValue(alert);

      const result = await service.getAlertById('alert-1');

      expect(result).toEqual(alert);
    });

    it('should throw NotFoundException if alert not found', async () => {
      mockAlertRepo.findById.mockResolvedValue(null);

      await expect(service.getAlertById('invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUnresolvedCount', () => {
    it('should return unresolved alert count', async () => {
      mockAlertRepo.countUnresolved.mockResolvedValue(5);

      const result = await service.getUnresolvedCount();

      expect(result).toBe(5);
    });
  });
});
