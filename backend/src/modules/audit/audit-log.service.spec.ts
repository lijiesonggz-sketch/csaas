import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogService } from './audit-log.service';
import { AuditLog, AuditAction } from '../../database/entities/audit-log.entity';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let repository: jest.Mocked<Repository<AuditLog>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuditLogService>(AuditLogService);
    repository = module.get(getRepositoryToken(AuditLog));
  });

  describe('log', () => {
    it('should successfully create and save an audit log', async () => {
      const logData = {
        userId: 'user-123',
        tenantId: 'tenant-456',
        action: AuditAction.CREATE,
        entityType: 'RadarPush',
        entityId: 'push-789',
        changes: { title: 'New Push' },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      const mockAuditLog = { id: 'log-001', ...logData };
      repository.create.mockReturnValue(mockAuditLog as any);
      repository.save.mockResolvedValue(mockAuditLog as any);

      await service.log(logData);

      expect(repository.create).toHaveBeenCalledWith(logData);
      expect(repository.save).toHaveBeenCalledWith(mockAuditLog);
    });

    it('should not throw error if save fails (fail silently)', async () => {
      const logData = {
        userId: 'user-123',
        tenantId: 'tenant-456',
        action: AuditAction.CREATE,
        entityType: 'RadarPush',
        entityId: 'push-789',
      };

      repository.create.mockReturnValue(logData as any);
      repository.save.mockRejectedValue(new Error('Database error'));

      // Should not throw
      await expect(service.log(logData)).resolves.toBeUndefined();
    });

    it('should handle missing optional fields', async () => {
      const logData = {
        userId: 'user-123',
        action: AuditAction.READ,
        entityType: 'Organization',
      };

      const mockAuditLog = { id: 'log-002', ...logData };
      repository.create.mockReturnValue(mockAuditLog as any);
      repository.save.mockResolvedValue(mockAuditLog as any);

      await service.log(logData);

      expect(repository.create).toHaveBeenCalledWith(logData);
      expect(repository.save).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return audit logs for a specific tenant', async () => {
      const tenantId = 'tenant-456';
      const mockLogs = [
        { id: 'log-001', tenantId, action: AuditAction.CREATE },
        { id: 'log-002', tenantId, action: AuditAction.UPDATE },
      ];

      repository.find.mockResolvedValue(mockLogs as any);

      const result = await service.findAll(tenantId, { limit: 100, offset: 0 });

      expect(result).toEqual(mockLogs);
      expect(repository.find).toHaveBeenCalledWith({
        where: { tenantId },
        order: { createdAt: 'DESC' },
        take: 100,
        skip: 0,
      });
    });

    it('should apply pagination correctly', async () => {
      const tenantId = 'tenant-456';
      repository.find.mockResolvedValue([]);

      await service.findAll(tenantId, { limit: 50, offset: 100 });

      expect(repository.find).toHaveBeenCalledWith({
        where: { tenantId },
        order: { createdAt: 'DESC' },
        take: 50,
        skip: 100,
      });
    });

    it('should use default pagination if not provided', async () => {
      const tenantId = 'tenant-456';
      repository.find.mockResolvedValue([]);

      await service.findAll(tenantId, {});

      expect(repository.find).toHaveBeenCalledWith({
        where: { tenantId },
        order: { createdAt: 'DESC' },
        take: 100,
        skip: 0,
      });
    });
  });

  describe('findByResource', () => {
    it('should return audit logs for a specific resource', async () => {
      const tenantId = 'tenant-456';
      const resource = 'RadarPush';
      const resourceId = 'push-789';
      const mockLogs = [
        { id: 'log-001', tenantId, entityType: resource, entityId: resourceId },
      ];

      repository.find.mockResolvedValue(mockLogs as any);

      const result = await service.findByResource(tenantId, resource, resourceId);

      expect(result).toEqual(mockLogs);
      expect(repository.find).toHaveBeenCalledWith({
        where: { tenantId, entityType: resource, entityId: resourceId },
        order: { createdAt: 'DESC' },
      });
    });
  });
});
