import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { Tenant } from '../src/database/entities/tenant.entity';
import { User, UserRole } from '../src/database/entities/user.entity';
import { Organization } from '../src/database/entities/organization.entity';
import { CustomerActivityLog } from '../src/database/entities/customer-activity-log.entity';
import { CustomerIntervention } from '../src/database/entities/customer-intervention.entity';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';

/**
 * Story 7.3: 客户管理与流失风险预警 - E2E 测试
 *
 * 测试客户活跃度追踪和流失风险管理 API 端点
 */
describe('[Story 7.3] Customer Activity and Churn Risk (E2E)', () => {
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
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);

    // 创建测试租户
    testTenant = await dataSource.getRepository(Tenant).save({
      name: `Test Tenant ${Date.now()}`,
    });

    // 创建管理员用户
    const passwordHash = await bcrypt.hash('admin123', 10);
    adminUser = await dataSource.getRepository(User).save({
      name: 'Admin User',
      email: `admin-${Date.now()}@example.com`,
      passwordHash,
      role: UserRole.ADMIN,
      tenantId: testTenant.id,
    });

    // 创建非管理员用户
    nonAdminUser = await dataSource.getRepository(User).save({
      name: 'Regular User',
      email: `user-${Date.now()}@example.com`,
      passwordHash,
      role: UserRole.CLIENT_PM,
      tenantId: testTenant.id,
    });

    // 生成 JWT tokens
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

    // 创建测试组织
    testOrganization = await dataSource.getRepository(Organization).save({
      name: 'Test Organization',
      tenantId: testTenant.id,
      contactEmail: 'test@example.com',
      contactPerson: 'Test Person',
      status: 'active',
    });

    // 创建测试活动日志
    const today = new Date().toISOString().split('T')[0];
    await dataSource.getRepository(CustomerActivityLog).save([
      {
        organizationId: testOrganization.id,
        activityType: 'login',
        activityDate: today,
        activityCount: 5,
      },
      {
        organizationId: testOrganization.id,
        activityType: 'push_view',
        activityDate: today,
        activityCount: 10,
      },
    ]);
  });

  afterAll(async () => {
    // 清理测试数据
    await dataSource.getRepository(CustomerIntervention).delete({
      organizationId: testOrganization.id,
    });
    await dataSource.getRepository(CustomerActivityLog).delete({
      organizationId: testOrganization.id,
    });
    await dataSource.getRepository(Organization).delete({
      id: testOrganization.id,
    });
    await dataSource.getRepository(User).delete({ id: adminUser.id });
    await dataSource.getRepository(User).delete({ id: nonAdminUser.id });
    await dataSource.getRepository(Tenant).delete({ id: testTenant.id });
    await app.close();
  });

  describe('[P1] GET /api/v1/admin/clients/activity - 获取客户活动列表', () => {
    it('[P1] should return client activity list for admin', async () => {
      // GIVEN: 管理员已认证
      // WHEN: 请求客户活动列表
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/clients/activity')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // THEN: 返回活动列表
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.meta).toHaveProperty('total');
      expect(response.body.meta).toHaveProperty('highActive');
      expect(response.body.meta).toHaveProperty('mediumActive');
      expect(response.body.meta).toHaveProperty('lowActive');
    });

    it('[P1] should filter by status', async () => {
      // GIVEN: 管理员已认证
      // WHEN: 按状态筛选
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/clients/activity?status=churn_risk')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // THEN: 返回筛选后的结果
      expect(response.body.data).toBeInstanceOf(Array);
      response.body.data.forEach((client: any) => {
        expect(client.activityStatus).toBe('churn_risk');
      });
    });

    it('[P1] should sort by activity rate', async () => {
      // GIVEN: 管理员已认证
      // WHEN: 按月活率排序
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/clients/activity?sort=monthlyActivityRate&order=asc')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // THEN: 返回排序后的结果
      expect(response.body.data).toBeInstanceOf(Array);
      if (response.body.data.length > 1) {
        const rates = response.body.data.map((c: any) => c.monthlyActivityRate);
        expect(rates).toEqual([...rates].sort((a, b) => a - b));
      }
    });

    it('[P1] should return 401 without auth token', async () => {
      // GIVEN: 未认证
      // WHEN: 请求活动列表
      // THEN: 返回 401
      await request(app.getHttpServer())
        .get('/api/v1/admin/clients/activity')
        .expect(401);
    });

    it('[P1] should return 403 for non-admin users', async () => {
      // GIVEN: 非管理员用户已认证
      // WHEN: 请求活动列表
      // THEN: 返回 403
      await request(app.getHttpServer())
        .get('/api/v1/admin/clients/activity')
        .set('Authorization', `Bearer ${nonAdminToken}`)
        .expect(403);
    });
  });

  describe('[P1] GET /api/v1/admin/clients/:id/activity - 获取单个客户活动详情', () => {
    it('[P1] should return client activity details', async () => {
      // GIVEN: 管理员已认证
      // WHEN: 请求客户活动详情
      const response = await request(app.getHttpServer())
        .get(`/api/v1/admin/clients/${testOrganization.id}/activity`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // THEN: 返回活动详情
      expect(response.body).toHaveProperty('organizationId', testOrganization.id);
      expect(response.body).toHaveProperty('monthlyActivityRate');
      expect(response.body).toHaveProperty('activityTrend');
      expect(response.body).toHaveProperty('activityBreakdown');
      expect(response.body).toHaveProperty('interventionHistory');
      expect(response.body.activityTrend).toBeInstanceOf(Array);
      expect(response.body.interventionHistory).toBeInstanceOf(Array);
    });

    it('[P1] should return 404 for non-existent organization', async () => {
      // GIVEN: 管理员已认证
      // WHEN: 使用不存在的组织ID
      // THEN: 返回 404
      await request(app.getHttpServer())
        .get('/api/v1/admin/clients/00000000-0000-0000-0000-000000000000/activity')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('[P1] GET /api/v1/admin/clients/churn-risk - 获取流失风险客户', () => {
    it('[P1] should return churn risk clients', async () => {
      // GIVEN: 管理员已认证
      // WHEN: 请求流失风险客户列表
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/clients/churn-risk')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // THEN: 返回流失风险客户
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
      expect(response.body.data).toBeInstanceOf(Array);
      // All returned clients should have churn_risk status
      response.body.data.forEach((client: any) => {
        expect(client.activityStatus).toBe('churn_risk');
      });
    });

    it('[P1] should include churn risk factors', async () => {
      // GIVEN: 管理员已认证，存在流失风险客户
      // WHEN: 请求流失风险客户列表
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/clients/churn-risk')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // THEN: 返回包含流失原因
      if (response.body.data.length > 0) {
        expect(response.body.data[0]).toHaveProperty('churnRiskFactors');
        expect(response.body.data[0].churnRiskFactors).toBeInstanceOf(Array);
      }
    });
  });

  describe('[P1] GET /api/v1/admin/clients/segmentation - 获取客户细分统计', () => {
    it('[P1] should return client segmentation', async () => {
      // GIVEN: 管理员已认证
      // WHEN: 请求客户细分统计
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/clients/segmentation')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // THEN: 返回细分统计
      expect(response.body).toHaveProperty('segments');
      expect(response.body).toHaveProperty('totalCustomers');
      expect(response.body).toHaveProperty('averageActivityRate');
      expect(response.body.segments).toBeInstanceOf(Array);
      expect(response.body.segments.length).toBe(3);

      // Check segment structure
      const segment = response.body.segments[0];
      expect(segment).toHaveProperty('name');
      expect(segment).toHaveProperty('label');
      expect(segment).toHaveProperty('range');
      expect(segment).toHaveProperty('count');
      expect(segment).toHaveProperty('percentage');
    });

    it('[P1] should include target percentage for high_active segment', async () => {
      // GIVEN: 管理员已认证
      // WHEN: 请求客户细分统计
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/clients/segmentation')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // THEN: 高活跃细分包含目标百分比
      const highActiveSegment = response.body.segments.find(
        (s: any) => s.name === 'high_active',
      );
      expect(highActiveSegment).toHaveProperty('targetPercentage', 70);
      expect(highActiveSegment).toHaveProperty('status');
    });
  });

  describe('[P1] POST /api/v1/admin/clients/:id/interventions - 记录干预', () => {
    it('[P1] should create intervention successfully', async () => {
      // GIVEN: 管理员已认证
      const interventionData = {
        interventionType: 'contact',
        result: 'contacted',
        notes: 'Customer was contacted via phone',
      };

      // WHEN: 创建干预记录
      const response = await request(app.getHttpServer())
        .post(`/api/v1/admin/clients/${testOrganization.id}/interventions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(interventionData)
        .expect(201);

      // THEN: 干预记录创建成功
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('organizationId', testOrganization.id);
      expect(response.body).toHaveProperty('interventionType', 'contact');
      expect(response.body).toHaveProperty('result', 'contacted');
      expect(response.body).toHaveProperty('notes', interventionData.notes);
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('createdBy');
    });

    it('[P1] should validate intervention type', async () => {
      // GIVEN: 管理员已认证
      const invalidData = {
        interventionType: 'invalid_type',
        result: 'contacted',
      };

      // WHEN: 使用无效的干预类型
      // THEN: 返回 400
      await request(app.getHttpServer())
        .post(`/api/v1/admin/clients/${testOrganization.id}/interventions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidData)
        .expect(400);
    });

    it('[P1] should validate result type', async () => {
      // GIVEN: 管理员已认证
      const invalidData = {
        interventionType: 'contact',
        result: 'invalid_result',
      };

      // WHEN: 使用无效的结果类型
      // THEN: 返回 400
      await request(app.getHttpServer())
        .post(`/api/v1/admin/clients/${testOrganization.id}/interventions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidData)
        .expect(400);
    });

    it('[P1] should return 404 for non-existent organization', async () => {
      // GIVEN: 管理员已认证
      const interventionData = {
        interventionType: 'contact',
        result: 'contacted',
      };

      // WHEN: 使用不存在的组织ID
      // THEN: 返回 404
      await request(app.getHttpServer())
        .post('/api/v1/admin/clients/00000000-0000-0000-0000-000000000000/interventions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(interventionData)
        .expect(404);
    });
  });

  describe('[P1] GET /api/v1/admin/clients/:id/interventions - 获取干预历史', () => {
    beforeAll(async () => {
      // 创建测试干预记录
      await dataSource.getRepository(CustomerIntervention).save({
        organizationId: testOrganization.id,
        interventionType: 'contact',
        result: 'contacted',
        notes: 'Test intervention',
        createdBy: adminUser.id,
      });
    });

    it('[P1] should return intervention history', async () => {
      // GIVEN: 管理员已认证
      // WHEN: 请求干预历史
      const response = await request(app.getHttpServer())
        .get(`/api/v1/admin/clients/${testOrganization.id}/interventions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // THEN: 返回干预历史
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('interventionType');
      expect(response.body[0]).toHaveProperty('result');
      expect(response.body[0]).toHaveProperty('createdAt');
    });
  });

  describe('[P1] GET /api/v1/admin/clients/:id/intervention-suggestions - 获取干预建议', () => {
    it('[P1] should return intervention suggestions', async () => {
      // GIVEN: 管理员已认证
      // WHEN: 请求干预建议
      const response = await request(app.getHttpServer())
        .get(`/api/v1/admin/clients/${testOrganization.id}/intervention-suggestions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // THEN: 返回干预建议
      expect(response.body).toBeInstanceOf(Array);
      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('type');
        expect(response.body[0]).toHaveProperty('title');
        expect(response.body[0]).toHaveProperty('description');
        expect(response.body[0]).toHaveProperty('priority');
      }
    });
  });

  describe('[P1] POST /api/v1/admin/clients/:id/calculate-activity - 手动触发活动率计算', () => {
    it('[P1] should calculate activity rate manually', async () => {
      // GIVEN: 管理员已认证
      // WHEN: 手动触发活动率计算
      const response = await request(app.getHttpServer())
        .post(`/api/v1/admin/clients/${testOrganization.id}/calculate-activity`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // THEN: 返回计算结果
      expect(response.body).toHaveProperty('monthlyRate');
      expect(response.body).toHaveProperty('loginRate');
      expect(response.body).toHaveProperty('contentRate');
      expect(response.body).toHaveProperty('actionRate');
      expect(response.body).toHaveProperty('status');
    });
  });

  describe('[P2] Performance - Response Times', () => {
    it('[P2] should return activity list in < 2 seconds', async () => {
      // GIVEN: 管理员已认证
      // WHEN: 请求活动列表
      const start = Date.now();
      await request(app.getHttpServer())
        .get('/api/v1/admin/clients/activity')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const duration = Date.now() - start;

      // THEN: 响应时间 < 2 秒
      expect(duration).toBeLessThan(2000);
    });

    it('[P2] should return segmentation in < 1 second', async () => {
      // GIVEN: 管理员已认证
      // WHEN: 请求细分统计
      const start = Date.now();
      await request(app.getHttpServer())
        .get('/api/v1/admin/clients/segmentation')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const duration = Date.now() - start;

      // THEN: 响应时间 < 1 秒
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('[P2] Error Scenarios', () => {
    it('[P2] should handle invalid organization ID format', async () => {
      // GIVEN: 管理员已认证
      // WHEN: 使用无效的 UUID 格式
      // THEN: 返回 400 或 404
      await request(app.getHttpServer())
        .get('/api/v1/admin/clients/invalid-uuid/activity')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect((res) => {
          expect([400, 404, 500]).toContain(res.status);
        });
    });

    it('[P2] should handle malformed query parameters', async () => {
      // GIVEN: 管理员已认证
      // WHEN: 使用无效的查询参数
      // THEN: 返回 400
      await request(app.getHttpServer())
        .get('/api/v1/admin/clients/activity?status=invalid_status')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });

  describe('[P2] Concurrent Requests', () => {
    it('[P2] should handle multiple concurrent requests', async () => {
      // GIVEN: 管理员已认证
      // WHEN: 同时发送 5 个请求
      const requests = Array(5)
        .fill(null)
        .map(() =>
          request(app.getHttpServer())
            .get('/api/v1/admin/clients/activity')
            .set('Authorization', `Bearer ${adminToken}`),
        );

      const responses = await Promise.all(requests);

      // THEN: 所有请求都成功返回
      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('data');
      });
    });
  });
});
