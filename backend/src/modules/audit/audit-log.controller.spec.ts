import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogController } from './audit-log.controller';
import { AuditLogService } from './audit-log.service';
import { AuditLog, AuditAction } from '../../database/entities/audit-log.entity';

/**
 * AuditLogController Unit Tests
 *
 * Tests the audit log query API endpoints.
 * Guards are tested separately in integration tests.
 *
 * @story 6-1B
 * @phase Phase 2: Audit Layer Implementation - Task 2.5
 */
describe('AuditLogController', () => {
  let controller: AuditLogController;
  let service: AuditLogService;

  const mockAuditLogService = {
    findAll: jest.fn(),
    findByResource: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditLogController],
      providers: [
        {
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
      ],
    })
      .overrideGuard(require('../auth/guards/jwt-auth.guard').JwtAuthGuard || class {})
      .useValue({ canActivate: () => true })
      .overrideGuard(require('../organizations/guards/tenant.guard').TenantGuard || class {})
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuditLogController>(AuditLogController);
    service = module.get<AuditLogService>(AuditLogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return audit logs for a tenant', async () => {
      const tenantId = 'tenant-123';
      const query = { limit: 50, offset: 0 };
      const mockLogs: Partial<AuditLog>[] = [
        {
          id: 'log-1',
          userId: 'user-1',
          tenantId,
          action: AuditAction.CREATE,
          entityType: 'RadarPush',
          entityId: 'push-1',
        },
      ];

      mockAuditLogService.findAll.mockResolvedValue(mockLogs);

      const result = await controller.findAll(tenantId, query);

      expect(result).toEqual(mockLogs);
      expect(service.findAll).toHaveBeenCalledWith(tenantId, query);
    });

    it('should pass query parameters to service', async () => {
      const tenantId = 'tenant-456';
      const query = { limit: 100, offset: 50 };

      mockAuditLogService.findAll.mockResolvedValue([]);

      await controller.findAll(tenantId, query);

      expect(service.findAll).toHaveBeenCalledWith(tenantId, query);
    });
  });

  describe('findByResource', () => {
    it('should return audit logs for a specific resource', async () => {
      const tenantId = 'tenant-123';
      const resourceId = 'push-1';
      const resource = 'RadarPush';
      const mockLogs: Partial<AuditLog>[] = [
        {
          id: 'log-1',
          userId: 'user-1',
          tenantId,
          action: AuditAction.UPDATE,
          entityType: resource,
          entityId: resourceId,
        },
      ];

      mockAuditLogService.findByResource.mockResolvedValue(mockLogs);

      const result = await controller.findByResource(tenantId, resourceId, resource);

      expect(result).toEqual(mockLogs);
      expect(service.findByResource).toHaveBeenCalledWith(tenantId, resource, resourceId);
    });

    it('should filter by tenantId to ensure multi-tenant isolation', async () => {
      const tenantId = 'tenant-789';
      const resourceId = 'org-1';
      const resource = 'Organization';

      mockAuditLogService.findByResource.mockResolvedValue([]);

      await controller.findByResource(tenantId, resourceId, resource);

      // Verify tenantId is passed to service (Layer 2 defense)
      expect(service.findByResource).toHaveBeenCalledWith(tenantId, resource, resourceId);
    });
  });
});
