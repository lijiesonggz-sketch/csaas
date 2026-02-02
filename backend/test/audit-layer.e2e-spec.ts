import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Tenant } from '../src/database/entities/tenant.entity';
import { Organization } from '../src/database/entities/organization.entity';
import { User } from '../src/database/entities/user.entity';
import { OrganizationMember } from '../src/database/entities/organization-member.entity';
import { AuditLog, AuditAction } from '../src/database/entities/audit-log.entity';
import { WatchedTopic } from '../src/database/entities/watched-topic.entity';
import { createTestUser, getAuthToken } from './helpers/auth.helper';

/**
 * Audit Layer E2E Tests
 *
 * Tests the complete audit layer (Layer 4):
 * - Audit logs are recorded for all sensitive operations
 * - Audit logs cannot be modified or deleted (database triggers)
 * - Audit log writes do not block main requests (async processing)
 * - Audit logs include all required fields (userId, tenantId, action, etc.)
 *
 * @story Story 6.1B - Database Layer RLS and Audit Layer
 * @phase Phase 2: Audit Layer Implementation
 */
describe('Audit Layer (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let tenant: Tenant;
  let organization: Organization;
  let user: User;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = app.get(DataSource);

    // 创建测试租户
    const tenantRepo = dataSource.getRepository(Tenant);
    tenant = await tenantRepo.save({
      name: 'Audit Test Tenant',
      subscriptionTier: 'pro',
      isActive: true,
    });

    // 创建测试组织
    const orgRepo = dataSource.getRepository(Organization);
    organization = await orgRepo.save({
      name: 'Audit Test Organization',
      tenantId: tenant.id,
      radarActivated: true,
    });

    // 创建测试用户
    user = await createTestUser(dataSource, {
      email: 'audit-test@example.com',
      password: 'Test123!',
      name: 'Audit Test User',
    });

    // 关联用户到组织
    const memberRepo = dataSource.getRepository(OrganizationMember);
    await memberRepo.save({
      userId: user.id,
      organizationId: organization.id,
      role: 'admin',
    });

    // 获取认证token
    authToken = await getAuthToken(app, user.email, 'Test123!');
  });

  afterAll(async () => {
    // 清理测试数据
    await dataSource.query(`DELETE FROM organization_members WHERE user_id = $1`, [user.id]);
    await dataSource.query(`DELETE FROM users WHERE email = $1`, ['audit-test@example.com']);
    await dataSource.query(`DELETE FROM organizations WHERE id = $1`, [organization.id]);
    await dataSource.query(`DELETE FROM tenants WHERE id = $1`, [tenant.id]);
    await dataSource.query(`DELETE FROM audit_logs WHERE tenant_id = $1`, [tenant.id]);
    await app.close();
  });

  describe('[P1] Audit Log Recording', () => {
    it('should record audit log when creating a WatchedTopic', async () => {
      // GIVEN: User is authenticated
      // WHEN: User creates a WatchedTopic
      const response = await request(app.getHttpServer())
        .post('/api/radar/watched-topics')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          keyword: 'Test Keyword',
          category: 'technical',
          priority: 'high',
        })
        .expect(201);

      const createdTopicId = response.body.id;

      // THEN: Audit log should be created
      await new Promise((resolve) => setTimeout(resolve, 500)); // Wait for async audit log

      const auditLogRepo = dataSource.getRepository(AuditLog);
      const auditLogs = await auditLogRepo.find({
        where: {
          tenantId: tenant.id,
          entityType: 'WatchedTopic',
          entityId: createdTopicId,
          action: AuditAction.CREATE,
        },
      });

      expect(auditLogs.length).toBeGreaterThan(0);
      const auditLog = auditLogs[0];
      expect(auditLog.userId).toBe(user.id);
      expect(auditLog.tenantId).toBe(tenant.id);
      expect(auditLog.action).toBe(AuditAction.CREATE);
      expect(auditLog.entityType).toBe('WatchedTopic');
      expect(auditLog.entityId).toBe(createdTopicId);
      expect(auditLog.changes).toBeDefined();
      expect(auditLog.ipAddress).toBeDefined();

      // 清理
      await dataSource.query(`DELETE FROM watched_topics WHERE id = $1`, [createdTopicId]);
    });

    it('should record audit log when updating a WatchedTopic', async () => {
      // GIVEN: WatchedTopic exists
      const topicRepo = dataSource.getRepository(WatchedTopic);
      const topic = await topicRepo.save({
        tenantId: tenant.id,
        organizationId: organization.id,
        keyword: 'Original Keyword',
        category: 'technical',
        priority: 'medium',
      });

      // WHEN: User updates the WatchedTopic
      await request(app.getHttpServer())
        .patch(`/api/radar/watched-topics/${topic.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          keyword: 'Updated Keyword',
          priority: 'high',
        })
        .expect(200);

      // THEN: Audit log should be created
      await new Promise((resolve) => setTimeout(resolve, 500)); // Wait for async audit log

      const auditLogRepo = dataSource.getRepository(AuditLog);
      const auditLogs = await auditLogRepo.find({
        where: {
          tenantId: tenant.id,
          entityType: 'WatchedTopic',
          entityId: topic.id,
          action: AuditAction.UPDATE,
        },
      });

      expect(auditLogs.length).toBeGreaterThan(0);
      const auditLog = auditLogs[0];
      expect(auditLog.action).toBe(AuditAction.UPDATE);
      expect(auditLog.changes).toBeDefined();
      expect(auditLog.changes.keyword).toBe('Updated Keyword');

      // 清理
      await topicRepo.delete(topic.id);
    });

    it('should record audit log when deleting a WatchedTopic', async () => {
      // GIVEN: WatchedTopic exists
      const topicRepo = dataSource.getRepository(WatchedTopic);
      const topic = await topicRepo.save({
        tenantId: tenant.id,
        organizationId: organization.id,
        keyword: 'To Be Deleted',
        category: 'technical',
        priority: 'low',
      });

      // WHEN: User deletes the WatchedTopic
      await request(app.getHttpServer())
        .delete(`/api/radar/watched-topics/${topic.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // THEN: Audit log should be created
      await new Promise((resolve) => setTimeout(resolve, 500)); // Wait for async audit log

      const auditLogRepo = dataSource.getRepository(AuditLog);
      const auditLogs = await auditLogRepo.find({
        where: {
          tenantId: tenant.id,
          entityType: 'WatchedTopic',
          entityId: topic.id,
          action: AuditAction.DELETE,
        },
      });

      expect(auditLogs.length).toBeGreaterThan(0);
      const auditLog = auditLogs[0];
      expect(auditLog.action).toBe(AuditAction.DELETE);
    });
  });

  describe('[P1] Audit Log Immutability', () => {
    it('should prevent updating audit logs (database trigger)', async () => {
      // GIVEN: Audit log exists
      const auditLogRepo = dataSource.getRepository(AuditLog);
      const auditLog = await auditLogRepo.save({
        userId: user.id,
        tenantId: tenant.id,
        action: AuditAction.CREATE,
        entityType: 'TestEntity',
        entityId: 'test-123',
        changes: { test: 'data' },
      });

      // WHEN: Attempting to update audit log
      // THEN: Should throw error (database trigger prevents modification)
      await expect(
        dataSource.query(`UPDATE audit_logs SET action = $1 WHERE id = $2`, [
          AuditAction.DELETE,
          auditLog.id,
        ]),
      ).rejects.toThrow();
    });

    it('should prevent deleting audit logs (database trigger)', async () => {
      // GIVEN: Audit log exists
      const auditLogRepo = dataSource.getRepository(AuditLog);
      const auditLog = await auditLogRepo.save({
        userId: user.id,
        tenantId: tenant.id,
        action: AuditAction.CREATE,
        entityType: 'TestEntity',
        entityId: 'test-456',
        changes: { test: 'data' },
      });

      // WHEN: Attempting to delete audit log
      // THEN: Should throw error (database trigger prevents deletion)
      await expect(
        dataSource.query(`DELETE FROM audit_logs WHERE id = $1`, [auditLog.id]),
      ).rejects.toThrow();
    });
  });

  describe('[P2] Audit Log Async Processing', () => {
    it('should not block main request when audit log write fails', async () => {
      // GIVEN: User is authenticated
      // WHEN: User creates a WatchedTopic (even if audit log fails, request should succeed)
      const startTime = Date.now();

      const response = await request(app.getHttpServer())
        .post('/api/radar/watched-topics')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          keyword: 'Async Test Keyword',
          category: 'technical',
          priority: 'medium',
        })
        .expect(201);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // THEN: Request should complete quickly (not blocked by audit log)
      expect(responseTime).toBeLessThan(2000); // Should complete within 2 seconds
      expect(response.body.id).toBeDefined();

      // 清理
      await dataSource.query(`DELETE FROM watched_topics WHERE id = $1`, [response.body.id]);
    });

    it('should record audit log asynchronously without blocking', async () => {
      // GIVEN: User is authenticated
      // WHEN: User creates multiple WatchedTopics rapidly
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          request(app.getHttpServer())
            .post('/api/radar/watched-topics')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              keyword: `Concurrent Test ${i}`,
              category: 'technical',
              priority: 'low',
            }),
        );
      }

      const responses = await Promise.all(promises);

      // THEN: All requests should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(201);
        expect(response.body.id).toBeDefined();
      });

      // Wait for async audit logs
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Verify audit logs were created
      const auditLogRepo = dataSource.getRepository(AuditLog);
      const auditLogs = await auditLogRepo.find({
        where: {
          tenantId: tenant.id,
          entityType: 'WatchedTopic',
          action: AuditAction.CREATE,
        },
      });

      expect(auditLogs.length).toBeGreaterThanOrEqual(5);

      // 清理
      const topicIds = responses.map((r) => r.body.id);
      await dataSource.query(`DELETE FROM watched_topics WHERE id = ANY($1)`, [topicIds]);
    });
  });

  describe('[P2] Audit Log Query', () => {
    it('should retrieve audit logs for a specific tenant', async () => {
      // GIVEN: Audit logs exist for tenant
      const auditLogRepo = dataSource.getRepository(AuditLog);
      await auditLogRepo.save([
        {
          userId: user.id,
          tenantId: tenant.id,
          action: AuditAction.CREATE,
          entityType: 'TestEntity',
          entityId: 'test-1',
        },
        {
          userId: user.id,
          tenantId: tenant.id,
          action: AuditAction.UPDATE,
          entityType: 'TestEntity',
          entityId: 'test-2',
        },
      ]);

      // WHEN: Querying audit logs
      const logs = await auditLogRepo.find({
        where: { tenantId: tenant.id },
        order: { createdAt: 'DESC' },
        take: 10,
      });

      // THEN: Should return audit logs for tenant
      expect(logs.length).toBeGreaterThan(0);
      logs.forEach((log) => {
        expect(log.tenantId).toBe(tenant.id);
      });
    });

    it('should retrieve audit logs for a specific resource', async () => {
      // GIVEN: Audit logs exist for specific resource
      const resourceId = 'specific-resource-123';
      const auditLogRepo = dataSource.getRepository(AuditLog);
      await auditLogRepo.save({
        userId: user.id,
        tenantId: tenant.id,
        action: AuditAction.CREATE,
        entityType: 'WatchedTopic',
        entityId: resourceId,
      });

      // WHEN: Querying audit logs for specific resource
      const logs = await auditLogRepo.find({
        where: {
          tenantId: tenant.id,
          entityType: 'WatchedTopic',
          entityId: resourceId,
        },
      });

      // THEN: Should return audit logs for resource
      expect(logs.length).toBeGreaterThan(0);
      logs.forEach((log) => {
        expect(log.entityId).toBe(resourceId);
        expect(log.entityType).toBe('WatchedTopic');
      });
    });
  });
});
