import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { AuditInterceptor } from './audit.interceptor';
import { Queue } from 'bullmq';
import { AuditAction } from '../../database/entities/audit-log.entity';

describe('AuditInterceptor', () => {
  let interceptor: AuditInterceptor;
  let mockQueue: jest.Mocked<Queue>;

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn().mockResolvedValue({}),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditInterceptor,
        {
          provide: 'BullQueue_audit-log',
          useValue: mockQueue,
        },
      ],
    }).compile();

    interceptor = module.get<AuditInterceptor>(AuditInterceptor);
  });

  describe('intercept', () => {
    it('should log audit entry on successful request', async () => {
      const mockRequest = {
        user: { id: 'user-123' },
        tenantId: 'tenant-456',
        method: 'POST',
        url: '/api/radar/radar-push',
        body: { title: 'New Push' },
        ip: '192.168.1.1',
        headers: { 'user-agent': 'Mozilla/5.0' },
      };

      const mockResponse = { id: 'push-789', title: 'New Push' };
      const context = createMockExecutionContext(mockRequest);
      const next = createMockCallHandler(mockResponse);

      await interceptor.intercept(context, next).toPromise();

      expect(mockQueue.add).toHaveBeenCalledWith('log', {
        userId: 'user-123',
        tenantId: 'tenant-456',
        action: AuditAction.CREATE,
        entityType: 'radar.radar-push',
        entityId: 'push-789',
        changes: { title: 'New Push' },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      });
    });

    it('should map HTTP methods to audit actions correctly', async () => {
      const testCases = [
        { method: 'POST', expectedAction: AuditAction.CREATE },
        { method: 'PUT', expectedAction: AuditAction.UPDATE },
        { method: 'PATCH', expectedAction: AuditAction.UPDATE },
        { method: 'DELETE', expectedAction: AuditAction.DELETE },
        { method: 'GET', expectedAction: AuditAction.READ },
      ];

      for (const { method, expectedAction } of testCases) {
        mockQueue.add.mockClear();

        const mockRequest = {
          user: { id: 'user-123' },
          tenantId: 'tenant-456',
          method,
          url: '/api/radar/radar-push',
          body: {},
          ip: '192.168.1.1',
          headers: { 'user-agent': 'Mozilla/5.0' },
        };

        const context = createMockExecutionContext(mockRequest);
        const next = createMockCallHandler({ id: 'resource-123' });

        await interceptor.intercept(context, next).toPromise();

        expect(mockQueue.add).toHaveBeenCalledWith(
          'log',
          expect.objectContaining({ action: expectedAction }),
        );
      }
    });

    it('should extract resource name from URL correctly', async () => {
      // ✅ UPDATED: Test cases updated to match improved resource extraction logic
      const testCases = [
        { url: '/api/radar/radar-push', expectedResource: 'radar.radar-push' },
        { url: '/api/radar/watched-topics', expectedResource: 'radar.watched-topics' },
        { url: '/api/radar/watched-peers/123', expectedResource: 'radar.watched-peers' },
        { url: '/api/organizations/create', expectedResource: 'organizations.create' },
        { url: '/api/audit/logs', expectedResource: 'audit.logs' },
        { url: '/unknown', expectedResource: 'unknown' },
      ];

      for (const { url, expectedResource } of testCases) {
        mockQueue.add.mockClear();

        const mockRequest = {
          user: { id: 'user-123' },
          tenantId: 'tenant-456',
          method: 'GET',
          url,
          body: {},
          ip: '192.168.1.1',
          headers: { 'user-agent': 'Mozilla/5.0' },
        };

        const context = createMockExecutionContext(mockRequest);
        const next = createMockCallHandler({ id: 'resource-123' });

        await interceptor.intercept(context, next).toPromise();

        expect(mockQueue.add).toHaveBeenCalledWith(
          'log',
          expect.objectContaining({ entityType: expectedResource }),
        );
      }
    });

    it('should log audit entry even when request fails', async () => {
      const mockRequest = {
        user: { id: 'user-123' },
        tenantId: 'tenant-456',
        method: 'POST',
        url: '/api/radar/radar-push',
        body: { title: 'New Push' },
        ip: '192.168.1.1',
        headers: { 'user-agent': 'Mozilla/5.0' },
      };

      const context = createMockExecutionContext(mockRequest);
      const next = createMockCallHandler(null, new Error('Request failed'));

      try {
        await interceptor.intercept(context, next).toPromise();
      } catch (error) {
        // Expected to throw
      }

      expect(mockQueue.add).toHaveBeenCalledWith(
        'log',
        expect.objectContaining({
          userId: 'user-123',
          tenantId: 'tenant-456',
          action: AuditAction.CREATE,
          entityType: 'radar.radar-push',
          entityId: null,
          changes: expect.objectContaining({
            error: 'Request failed',
            body: { title: 'New Push' },
          }),
        }),
      );
    });

    it('should handle missing user gracefully', async () => {
      const mockRequest = {
        user: null,
        tenantId: 'tenant-456',
        method: 'GET',
        url: '/api/radar/radar-push',
        body: {},
        ip: '192.168.1.1',
        headers: { 'user-agent': 'Mozilla/5.0' },
      };

      const context = createMockExecutionContext(mockRequest);
      const next = createMockCallHandler({ id: 'push-789' });

      await interceptor.intercept(context, next).toPromise();

      expect(mockQueue.add).toHaveBeenCalledWith(
        'log',
        expect.objectContaining({
          userId: undefined,
          tenantId: 'tenant-456',
        }),
      );
    });

    it('should not block main request if audit logging fails', async () => {
      mockQueue.add.mockRejectedValue(new Error('Queue failed'));

      const mockRequest = {
        user: { id: 'user-123' },
        tenantId: 'tenant-456',
        method: 'POST',
        url: '/api/radar/radar-push',
        body: { title: 'New Push' },
        ip: '192.168.1.1',
        headers: { 'user-agent': 'Mozilla/5.0' },
      };

      const mockResponse = { id: 'push-789', title: 'New Push' };
      const context = createMockExecutionContext(mockRequest);
      const next = createMockCallHandler(mockResponse);

      // Should not throw even if queue fails
      const result = await interceptor.intercept(context, next).toPromise();

      expect(result).toEqual(mockResponse);
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

/**
 * Helper function to create mock CallHandler
 */
function createMockCallHandler(response: any, error?: Error): CallHandler {
  return {
    handle: () => (error ? throwError(() => error) : of(response)),
  } as CallHandler;
}
