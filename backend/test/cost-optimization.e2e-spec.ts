import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { Tenant } from '../src/database/entities/tenant.entity';
import { User, UserRole } from '../src/database/entities/user.entity';
import { Organization } from '../src/database/entities/organization.entity';
import { AIUsageLog, AIUsageTaskType } from '../src/database/entities/ai-usage-log.entity';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';

/**
 * Cost Optimization E2E Tests
 *
 * Tests for AI cost optimization endpoints.
 *
 * @story 7-4
 * @module backend/test
 */
describe('[Story 7.4] Cost Optimization (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  let testTenant: Tenant;
  let adminUser: User;
  let adminToken: string;
  let nonAdminUser: User;
  let nonAdminToken: string;
  let testOrganization: Organization;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);

    // Create test tenant
    testTenant = await dataSource.getRepository(Tenant).save({
      name: `Test Tenant ${Date.now()}`,
    });

    // Create admin user
    const passwordHash = await bcrypt.hash('admin123', 10);
    adminUser = await dataSource.getRepository(User).save({
      name: 'Admin User',
      email: `admin-${Date.now()}@example.com`,
      passwordHash,
      role: UserRole.ADMIN,
      tenantId: testTenant.id,
    });

    // Create non-admin user
    nonAdminUser = await dataSource.getRepository(User).save({
      name: 'Regular User',
      email: `user-${Date.now()}@example.com`,
      passwordHash,
      role: UserRole.CLIENT_PM,
      tenantId: testTenant.id,
    });

    // Generate JWT tokens
    adminToken = jwt.sign(
      {
        userId: adminUser.id,
        email: adminUser.email,
        role: adminUser.role,
        tenantId: testTenant.id,
      },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' },
    );

    nonAdminToken = jwt.sign(
      {
        userId: nonAdminUser.id,
        email: nonAdminUser.email,
        role: nonAdminUser.role,
        tenantId: testTenant.id,
      },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' },
    );

    // Create test organization
    testOrganization = await dataSource.getRepository(Organization).save({
      name: 'Test Organization',
      tenantId: testTenant.id,
    });

    // Create AI usage logs
    await dataSource.getRepository(AIUsageLog).save([
      {
        organizationId: testOrganization.id,
        taskType: AIUsageTaskType.TECH_ANALYSIS,
        inputTokens: 1000,
        outputTokens: 500,
        cost: 18,
        modelName: 'qwen-max',
      },
      {
        organizationId: testOrganization.id,
        taskType: AIUsageTaskType.INDUSTRY_ANALYSIS,
        inputTokens: 800,
        outputTokens: 400,
        cost: 14.4,
        modelName: 'qwen-max',
      },
    ]);
  });

  afterAll(async () => {
    // Cleanup
    if (dataSource && dataSource.isInitialized) {
      await dataSource.getRepository(AIUsageLog).delete({ organizationId: testOrganization.id });
      await dataSource.getRepository(Organization).delete({ id: testOrganization.id });
      await dataSource.getRepository(User).delete({ id: adminUser.id });
      await dataSource.getRepository(User).delete({ id: nonAdminUser.id });
      await dataSource.getRepository(Tenant).delete({ id: testTenant.id });
    }
    await app.close();
  });

  describe('GET /api/v1/admin/cost-optimization/metrics', () => {
    it('should return cost metrics overview for admin', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/cost-optimization/metrics')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        totalCost: expect.any(Number),
        averageCostPerOrganization: expect.any(Number),
        topCostOrganizations: expect.any(Array),
        period: {
          startDate: expect.any(String),
          endDate: expect.any(String),
        },
      });

      expect(response.body.topCostOrganizations[0]).toMatchObject({
        organizationId: expect.any(String),
        organizationName: expect.any(String),
        cost: expect.any(Number),
        count: expect.any(Number),
      });
    });

    it('should return 403 for non-admin users', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/cost-optimization/metrics')
        .set('Authorization', `Bearer ${nonAdminToken}`)
        .expect(403);
    });

    it('should return 401 for unauthenticated requests', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/cost-optimization/metrics')
        .expect(401);
    });
  });

  describe('GET /api/v1/admin/cost-optimization/organizations/:organizationId/cost', () => {
    it('should return organization cost details for admin', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/admin/cost-optimization/organizations/${testOrganization.id}/cost`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        organizationId: testOrganization.id,
        organizationName: 'Test Organization',
        totalCost: expect.any(Number),
        costBreakdown: expect.any(Array),
        isExceeded: expect.any(Boolean),
        threshold: 500,
        period: {
          startDate: expect.any(String),
          endDate: expect.any(String),
        },
      });

      expect(response.body.costBreakdown[0]).toMatchObject({
        taskType: expect.any(String),
        cost: expect.any(Number),
        count: expect.any(Number),
        percentage: expect.any(Number),
      });
    });

    it('should return 404 for non-existent organization', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/cost-optimization/organizations/00000000-0000-0000-0000-000000000000/cost')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should return 403 for non-admin users', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/admin/cost-optimization/organizations/${testOrganization.id}/cost`)
        .set('Authorization', `Bearer ${nonAdminToken}`)
        .expect(403);
    });
  });

  describe('GET /api/v1/admin/cost-optimization/trends', () => {
    it('should return cost trends with default 30 days', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/cost-optimization/trends')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        trends: expect.any(Array),
        period: {
          startDate: expect.any(String),
          endDate: expect.any(String),
        },
      });
    });

    it('should return cost trends with custom days', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/cost-optimization/trends?days=7')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        trends: expect.any(Array),
        period: {
          startDate: expect.any(String),
          endDate: expect.any(String),
        },
      });
    });

    it('should validate days parameter', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/cost-optimization/trends?days=0')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      await request(app.getHttpServer())
        .get('/api/v1/admin/cost-optimization/trends?days=400')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should return 403 for non-admin users', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/cost-optimization/trends')
        .set('Authorization', `Bearer ${nonAdminToken}`)
        .expect(403);
    });
  });
});
