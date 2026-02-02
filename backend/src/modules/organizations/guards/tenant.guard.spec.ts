import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { TenantGuard } from './tenant.guard';
import { OrganizationsService } from '../organizations.service';
import { DataSource } from 'typeorm';

describe('TenantGuard', () => {
  let guard: TenantGuard;
  let organizationsService: jest.Mocked<OrganizationsService>;
  let dataSource: jest.Mocked<DataSource>;

  beforeEach(() => {
    organizationsService = {
      findByUserId: jest.fn(),
    } as any;

    dataSource = {
      query: jest.fn(),
    } as any;

    guard = new TenantGuard(organizationsService, dataSource);
  });

  describe('canActivate', () => {
    it('should throw UnauthorizedException if user is not authenticated', async () => {
      const context = createMockExecutionContext({
        user: null,
      });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      await expect(guard.canActivate(context)).rejects.toThrow('User not authenticated');
    });

    it('should throw ForbiddenException if user does not belong to any organization', async () => {
      const context = createMockExecutionContext({
        user: { id: 'user-123' },
      });

      organizationsService.findByUserId.mockResolvedValue(null);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow(
        'User does not belong to any organization',
      );
    });

    it('should inject tenantId and organizationId into request context', async () => {
      const mockRequest = {
        user: { id: 'user-123' },
      };
      const context = createMockExecutionContext(mockRequest);

      const mockOrganization = {
        id: 'org-456',
        tenantId: 'tenant-789',
        name: 'Test Organization',
      };

      organizationsService.findByUserId.mockResolvedValue(mockOrganization as any);
      dataSource.query.mockResolvedValue(undefined);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockRequest['tenantId']).toBe('tenant-789');
      expect(mockRequest['organizationId']).toBe('org-456');
      expect(organizationsService.findByUserId).toHaveBeenCalledWith('user-123');
    });

    it('should not call dataSource.query for RLS (RLS disabled, using app-layer filtering)', async () => {
      // ✅ FIXED: Test updated to match actual implementation
      // Note: RLS was verified ineffective and replaced with app-layer filtering (BaseTenantRepository)
      // TenantGuard now only injects tenantId into request context, does NOT set RLS session variable

      const mockRequest = {
        user: { id: 'user-123' },
      };
      const context = createMockExecutionContext(mockRequest);

      const mockOrganization = {
        id: 'org-456',
        tenantId: 'tenant-789',
        name: 'Test Organization',
      };

      organizationsService.findByUserId.mockResolvedValue(mockOrganization as any);

      await guard.canActivate(context);

      // ✅ Verify tenantId is injected into request context
      expect(mockRequest['tenantId']).toBe('tenant-789');
      expect(mockRequest['organizationId']).toBe('org-456');

      // ✅ Verify dataSource.query is NOT called (RLS is disabled)
      // All tenant filtering is handled by BaseTenantRepository at the application layer
      expect(dataSource.query).not.toHaveBeenCalled();
    });

    it('should handle service errors gracefully', async () => {
      const context = createMockExecutionContext({
        user: { id: 'user-123' },
      });

      organizationsService.findByUserId.mockRejectedValue(new Error('Database error'));

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow('Failed to validate tenant access');
    });
  });
});

/**
 * Helper function to create mock ExecutionContext
 */
function createMockExecutionContext(request: any): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as ExecutionContext;
}
