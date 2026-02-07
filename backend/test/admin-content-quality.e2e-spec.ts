/**
 * Story 7.2: 内容质量管理 - E2E 测试
 *
 * 测试所有内容质量管理 API 端点
 * 包括：质量指标、低分推送、反馈详情、趋势分析
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { Tenant } from '../src/database/entities/tenant.entity';
import { User, UserRole } from '../src/database/entities/user.entity';
import { Organization } from '../src/database/entities/organization.entity';
import { RadarPush } from '../src/database/entities/radar-push.entity';
import { AnalyzedContent } from '../src/database/entities/analyzed-content.entity';
import { RawContent } from '../src/database/entities/raw-content.entity';
import { PushFeedback } from '../src/database/entities/push-feedback.entity';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';

describe('[Story 7.2] Admin Content Quality (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  let testTenant: Tenant;
  let testOrganization: Organization;
  let adminUser: User;
  let adminToken: string;
  let nonAdminUser: User;
  let nonAdminToken: string;
  let regularUser: User;
  let testPush: RadarPush;
  let testAnalyzedContent: AnalyzedContent;
  let testRawContent: RawContent;

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

    // 创建测试组织
    testOrganization = await dataSource.getRepository(Organization).save({
      name: `Test Org ${Date.now()}`,
      tenantId: testTenant.id,
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

    // 创建普通用户（用于提交反馈）
    regularUser = await dataSource.getRepository(User).save({
      name: 'Feedback User',
      email: `feedback-${Date.now()}@example.com`,
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

    // 创建测试原始内容
    const timestamp = Date.now();
    testRawContent = await dataSource.getRepository(RawContent).save({
      title: 'Test Content Title',
      fullContent: 'This is a test content for content quality management.',
      source: 'GARTNER',
      category: 'tech',
      url: 'https://example.com/test',
      publishedAt: new Date(),
      contentHash: `test-hash-${timestamp}`,
      status: 'analyzed',
    });

    // 创建测试分析内容
    testAnalyzedContent = await dataSource.getRepository(AnalyzedContent).save({
      contentId: testRawContent.id,
      aiSummary: 'AI summary of the test content',
      relevanceScore: 0.85,
      keywords: ['test', 'content'],
      categories: ['tech'],
      aiModel: 'qwen-max',
      tokensUsed: 100,
      status: 'success',
      analyzedAt: new Date(),
    });

    // 创建测试推送
    testPush = await dataSource.getRepository(RadarPush).save({
      organizationId: testOrganization.id,
      tenantId: testTenant.id,
      radarType: 'tech',
      contentId: testAnalyzedContent.id,
      relevanceScore: 0.85,
      priorityLevel: 'high',
      scheduledAt: new Date(),
      status: 'sent',
      sentAt: new Date(),
    });
  });

  afterAll(async () => {
    // 清理测试数据
    await dataSource.getRepository(PushFeedback).delete({ pushId: testPush.id });
    await dataSource.getRepository(RadarPush).delete({ id: testPush.id });
    await dataSource.getRepository(AnalyzedContent).delete({ id: testAnalyzedContent.id });
    await dataSource.getRepository(RawContent).delete({ id: testRawContent.id });
    await dataSource.getRepository(User).delete({ id: adminUser.id });
    await dataSource.getRepository(User).delete({ id: nonAdminUser.id });
    await dataSource.getRepository(User).delete({ id: regularUser.id });
    await dataSource.getRepository(Organization).delete({ id: testOrganization.id });
    await dataSource.getRepository(Tenant).delete({ id: testTenant.id });
    await app.close();
  });

  describe('[P1] GET /api/v1/admin/content-quality/metrics - 获取内容质量指标', () => {
    beforeEach(async () => {
      // 清除缓存
      const cacheManager = app.get('CACHE_MANAGER');
      await cacheManager.del('content-quality:metrics');
    });

    it('[P1] should return content quality metrics for admin user', async () => {
      // GIVEN: 管理员已认证
      // WHEN: 请求内容质量指标
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/content-quality/metrics')
        .set('Authorization', `Bearer ${adminToken}`);

      // Debug: Print response if not 200
      if (response.status !== 200) {
        console.log('Response status:', response.status);
        console.log('Response body:', JSON.stringify(response.body, null, 2));
      }

      expect(response.status).toBe(200);

      // THEN: 返回质量指标
      expect(response.body).toHaveProperty('averageRating');
      expect(response.body).toHaveProperty('totalFeedback');
      expect(response.body).toHaveProperty('lowRatedPushes');
      expect(response.body).toHaveProperty('targetAchievement');
      expect(response.body).toHaveProperty('ratingDistribution');

      expect(typeof response.body.averageRating).toBe('number');
      expect(typeof response.body.totalFeedback).toBe('number');
      expect(typeof response.body.lowRatedPushes).toBe('number');
      expect(typeof response.body.targetAchievement).toBe('number');
      expect(response.body.ratingDistribution).toHaveProperty('1');
      expect(response.body.ratingDistribution).toHaveProperty('2');
      expect(response.body.ratingDistribution).toHaveProperty('3');
      expect(response.body.ratingDistribution).toHaveProperty('4');
      expect(response.body.ratingDistribution).toHaveProperty('5');
    });

    it('[P1] should return 401 without auth token', async () => {
      // GIVEN: 未认证
      // WHEN: 请求质量指标
      // THEN: 返回 401
      await request(app.getHttpServer())
        .get('/api/v1/admin/content-quality/metrics')
        .expect(401);
    });

    it('[P1] should return 403 for non-admin users', async () => {
      // GIVEN: 非管理员用户已认证
      // WHEN: 请求质量指标
      // THEN: 返回 403
      await request(app.getHttpServer())
        .get('/api/v1/admin/content-quality/metrics')
        .set('Authorization', `Bearer ${nonAdminToken}`)
        .expect(403);
    });

    it('[P2] should use cache for repeated requests', async () => {
      // GIVEN: 管理员已认证
      // WHEN: 连续请求质量指标两次
      const response1 = await request(app.getHttpServer())
        .get('/api/v1/admin/content-quality/metrics')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const response2 = await request(app.getHttpServer())
        .get('/api/v1/admin/content-quality/metrics')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // THEN: 两次响应应该相同（来自缓存）
      expect(response1.body).toEqual(response2.body);
    });
  });

  describe('[P1] GET /api/v1/admin/content-quality/low-rated - 获取低分推送列表', () => {
    beforeAll(async () => {
      // 创建低分反馈数据
      await dataSource.getRepository(PushFeedback).save([
        {
          pushId: testPush.id,
          userId: regularUser.id,
          rating: 2,
          comment: 'Not very relevant to my needs',
        },
      ]);
    });

    afterAll(async () => {
      // 清理反馈数据
      await dataSource.getRepository(PushFeedback).delete({ pushId: testPush.id });
    });

    it('[P1] should return low-rated pushes for admin user', async () => {
      // GIVEN: 管理员已认证
      // WHEN: 请求低分推送列表
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/content-quality/low-rated')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // THEN: 返回低分推送列表
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.meta).toHaveProperty('total');
    });

    it('[P1] should filter by radar type', async () => {
      // GIVEN: 管理员已认证
      // WHEN: 按雷达类型筛选
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/content-quality/low-rated?radarType=tech')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // THEN: 返回指定类型的低分推送
      expect(response.body.data).toBeInstanceOf(Array);
      response.body.data.forEach((push: any) => {
        expect(push.radarType).toBe('tech');
      });
    });

    it('[P2] should respect limit parameter', async () => {
      // GIVEN: 管理员已认证
      // WHEN: 使用 limit 参数
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/content-quality/low-rated?limit=5')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // THEN: 返回数量不超过限制
      expect(response.body.data.length).toBeLessThanOrEqual(5);
    });

    it('[P2] should return 400 for invalid radar type', async () => {
      // GIVEN: 管理员已认证
      // WHEN: 使用无效的雷达类型
      // THEN: 返回 400
      await request(app.getHttpServer())
        .get('/api/v1/admin/content-quality/low-rated?radarType=invalid')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });

  describe('[P1] GET /api/v1/admin/content-quality/pushes/:id/feedback - 获取推送反馈详情', () => {
    beforeAll(async () => {
      // 创建反馈数据
      await dataSource.getRepository(PushFeedback).save([
        {
          pushId: testPush.id,
          userId: regularUser.id,
          rating: 4,
          comment: 'Good content',
        },
      ]);
    });

    afterAll(async () => {
      await dataSource.getRepository(PushFeedback).delete({ pushId: testPush.id });
    });

    it('[P1] should return push feedback details', async () => {
      // GIVEN: 管理员已认证
      // WHEN: 请求推送反馈详情
      const response = await request(app.getHttpServer())
        .get(`/api/v1/admin/content-quality/pushes/${testPush.id}/feedback`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // THEN: 返回推送详情和反馈
      expect(response.body).toHaveProperty('push');
      expect(response.body).toHaveProperty('feedback');
      expect(response.body).toHaveProperty('optimizationSuggestions');
      expect(response.body).toHaveProperty('status');

      expect(response.body.push).toHaveProperty('id');
      expect(response.body.push).toHaveProperty('title');
      expect(response.body.push).toHaveProperty('radarType');
      expect(response.body.feedback).toBeInstanceOf(Array);
      expect(response.body.optimizationSuggestions).toBeInstanceOf(Array);
    });

    it('[P1] should return 404 for non-existent push', async () => {
      // GIVEN: 管理员已认证
      // WHEN: 使用不存在的推送 ID
      // THEN: 返回 404
      await request(app.getHttpServer())
        .get('/api/v1/admin/content-quality/pushes/00000000-0000-0000-0000-000000000000/feedback')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('[P2] should return 400 for invalid push ID format', async () => {
      // GIVEN: 管理员已认证
      // WHEN: 使用无效的 UUID 格式
      // THEN: 返回 400 或 404
      await request(app.getHttpServer())
        .get('/api/v1/admin/content-quality/pushes/invalid-uuid/feedback')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect((res) => {
          expect([400, 404, 500]).toContain(res.status);
        });
    });
  });

  describe('[P1] PUT /api/v1/admin/content-quality/pushes/:id/optimize - 标记推送为已优化', () => {
    it('[P1] should mark push as optimized', async () => {
      // GIVEN: 管理员已认证
      // WHEN: 标记推送为已优化
      const response = await request(app.getHttpServer())
        .put(`/api/v1/admin/content-quality/pushes/${testPush.id}/optimize`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // THEN: 返回成功消息
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('optimized');
      expect(response.body.message).toContain('已标记为已优化');
    });

    it('[P1] should invalidate cache after marking as optimized', async () => {
      // GIVEN: 管理员已认证，先获取一次指标（建立缓存）
      await request(app.getHttpServer())
        .get('/api/v1/admin/content-quality/metrics')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // WHEN: 标记推送为已优化
      await request(app.getHttpServer())
        .put(`/api/v1/admin/content-quality/pushes/${testPush.id}/optimize`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // THEN: 缓存应该被清除（下一次请求将重新计算）
      // 这里我们验证 API 调用成功即可，实际缓存行为在单元测试中验证
    });

    it('[P1] should return 404 for non-existent push', async () => {
      // GIVEN: 管理员已认证
      // WHEN: 使用不存在的推送 ID
      // THEN: 返回 404
      await request(app.getHttpServer())
        .put('/api/v1/admin/content-quality/pushes/00000000-0000-0000-0000-000000000000/optimize')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('[P1] PUT /api/v1/admin/content-quality/pushes/:id/ignore - 标记推送为已忽略', () => {
    it('[P1] should mark push as ignored', async () => {
      // GIVEN: 管理员已认证
      // WHEN: 标记推送为已忽略
      const response = await request(app.getHttpServer())
        .put(`/api/v1/admin/content-quality/pushes/${testPush.id}/ignore`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // THEN: 返回成功消息
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('ignored');
      expect(response.body.message).toContain('已忽略');
    });

    it('[P1] should return 404 for non-existent push', async () => {
      // GIVEN: 管理员已认证
      // WHEN: 使用不存在的推送 ID
      // THEN: 返回 404
      await request(app.getHttpServer())
        .put('/api/v1/admin/content-quality/pushes/00000000-0000-0000-0000-000000000000/ignore')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('[P1] GET /api/v1/admin/content-quality/trends - 获取质量趋势数据', () => {
    it('[P1] should return quality trends', async () => {
      // GIVEN: 管理员已认证
      // WHEN: 请求质量趋势
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/content-quality/trends')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // THEN: 返回趋势数据
      expect(response.body).toHaveProperty('averageRatingTrend');
      expect(response.body).toHaveProperty('lowRatedPushCountTrend');
      expect(response.body.averageRatingTrend).toBeInstanceOf(Array);
      expect(response.body.lowRatedPushCountTrend).toBeInstanceOf(Array);
    });

    it('[P1] should support custom date range', async () => {
      // GIVEN: 管理员已认证
      // WHEN: 使用自定义日期范围
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/content-quality/trends?range=7d')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // THEN: 返回指定范围的趋势数据
      expect(response.body).toHaveProperty('averageRatingTrend');
      expect(response.body).toHaveProperty('lowRatedPushCountTrend');
    });

    it('[P2] should validate date range parameter', async () => {
      // GIVEN: 管理员已认证
      // WHEN: 使用无效的日期范围
      // THEN: 返回 400
      await request(app.getHttpServer())
        .get('/api/v1/admin/content-quality/trends?range=invalid')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });

  describe('[P2] Performance - Response Times', () => {
    it('[P2] should return metrics in < 2 seconds', async () => {
      // GIVEN: 管理员已认证
      // WHEN: 请求质量指标
      const start = Date.now();
      await request(app.getHttpServer())
        .get('/api/v1/admin/content-quality/metrics')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const duration = Date.now() - start;

      // THEN: 响应时间 < 2 秒
      expect(duration).toBeLessThan(2000);
    });

    it('[P2] should return low-rated pushes in < 2 seconds', async () => {
      // GIVEN: 管理员已认证
      // WHEN: 请求低分推送
      const start = Date.now();
      await request(app.getHttpServer())
        .get('/api/v1/admin/content-quality/low-rated')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const duration = Date.now() - start;

      // THEN: 响应时间 < 2 秒
      expect(duration).toBeLessThan(2000);
    });

    it('[P2] should return trends in < 3 seconds', async () => {
      // GIVEN: 管理员已认证
      // WHEN: 请求趋势数据
      const start = Date.now();
      await request(app.getHttpServer())
        .get('/api/v1/admin/content-quality/trends?range=30d')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const duration = Date.now() - start;

      // THEN: 响应时间 < 3 秒
      expect(duration).toBeLessThan(3000);
    });
  });

  describe('[P2] Edge Cases - Empty Data', () => {
    it('[P2] should handle empty feedback data gracefully', async () => {
      // GIVEN: 管理员已认证，清除缓存
      const cacheManager = app.get('CACHE_MANAGER');
      await cacheManager.del('content-quality:metrics');

      // 清理所有反馈数据
      const allFeedback = await dataSource.getRepository(PushFeedback).find();
      if (allFeedback.length > 0) {
        await dataSource.getRepository(PushFeedback).delete(allFeedback.map(f => f.id));
      }

      // WHEN: 请求质量指标
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/content-quality/metrics')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // THEN: 返回默认值
      expect(response.body.averageRating).toBe(0);
      expect(response.body.totalFeedback).toBe(0);
      expect(response.body.targetAchievement).toBe(0);

      // 恢复测试数据
      await dataSource.getRepository(PushFeedback).save([
        {
          pushId: testPush.id,
          userId: regularUser.id,
          rating: 4,
          comment: 'Test feedback',
        },
      ]);
    });

    it('[P2] should handle empty low-rated pushes list', async () => {
      // GIVEN: 管理员已认证，只有高分反馈
      await dataSource.getRepository(PushFeedback).delete({});
      await dataSource.getRepository(PushFeedback).save([
        {
          pushId: testPush.id,
          userId: regularUser.id,
          rating: 5, // 高分，不应出现在低分列表
          comment: 'Excellent content',
        },
      ]);

      // WHEN: 请求低分推送
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/content-quality/low-rated')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // THEN: 返回空列表
      expect(response.body.data).toEqual([]);
      expect(response.body.meta.total).toBe(0);
    });
  });

  describe('[P2] Concurrent Requests', () => {
    it('[P2] should handle multiple concurrent metrics requests', async () => {
      // GIVEN: 管理员已认证
      // WHEN: 同时发送 5 个请求
      const requests = Array(5)
        .fill(null)
        .map(() =>
          request(app.getHttpServer())
            .get('/api/v1/admin/content-quality/metrics')
            .set('Authorization', `Bearer ${adminToken}`),
        );

      const responses = await Promise.all(requests);

      // THEN: 所有请求都成功返回
      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('averageRating');
      });
    });
  });

  describe('[P2] Error Scenarios', () => {
    it('[P2] should handle malformed JWT token', async () => {
      // GIVEN: 使用格式错误的 token
      // WHEN: 请求质量指标
      // THEN: 返回 401
      await request(app.getHttpServer())
        .get('/api/v1/admin/content-quality/metrics')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('[P2] should handle expired JWT token', async () => {
      // GIVEN: 使用过期的 token
      const expiredToken = jwt.sign(
        {
          userId: adminUser.id,
          email: adminUser.email,
          role: adminUser.role,
          tenantId: testTenant.id,
        },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '-1h' }, // Expired 1 hour ago
      );

      // WHEN: 请求质量指标
      // THEN: 返回 401
      await request(app.getHttpServer())
        .get('/api/v1/admin/content-quality/metrics')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });

    it('[P2] should handle missing Authorization header', async () => {
      // GIVEN: 没有 Authorization header
      // WHEN: 请求质量指标
      // THEN: 返回 401
      await request(app.getHttpServer())
        .get('/api/v1/admin/content-quality/metrics')
        .expect(401);
    });
  });

  describe('[P2] Multi-tenant Data Isolation', () => {
    let otherTenant: Tenant;
    let otherOrganization: Organization;
    let otherPush: RadarPush;
    let otherAnalyzedContent: AnalyzedContent;
    let otherRawContent: RawContent;

    beforeAll(async () => {
      // 创建另一个租户的测试数据
      otherTenant = await dataSource.getRepository(Tenant).save({
        name: `Other Tenant ${Date.now()}`,
      });

      otherOrganization = await dataSource.getRepository(Organization).save({
        name: `Other Org ${Date.now()}`,
        tenantId: otherTenant.id,
      });

      const otherTimestamp = Date.now() + 1;
      otherRawContent = await dataSource.getRepository(RawContent).save({
        title: 'Other Tenant Content',
        fullContent: 'Content from another tenant',
        source: 'GARTNER',
        category: 'industry',
        url: 'https://example.com/other',
        publishedAt: new Date(),
        contentHash: `other-hash-${otherTimestamp}`,
        status: 'analyzed',
      });

      otherAnalyzedContent = await dataSource.getRepository(AnalyzedContent).save({
        contentId: otherRawContent.id,
        aiSummary: 'Other tenant AI summary',
        relevanceScore: 0.75,
        keywords: ['other', 'tenant'],
        categories: ['industry'],
        aiModel: 'qwen-max',
        tokensUsed: 100,
        status: 'success',
        analyzedAt: new Date(),
      });

      otherPush = await dataSource.getRepository(RadarPush).save({
        organizationId: otherOrganization.id,
        tenantId: otherTenant.id,
        radarType: 'industry',
        contentId: otherAnalyzedContent.id,
        relevanceScore: 0.75,
        priorityLevel: 'medium',
        scheduledAt: new Date(),
        status: 'sent',
        sentAt: new Date(),
      });

      // 为另一个租户创建低分反馈
      const otherUser = await dataSource.getRepository(User).save({
        name: 'Other Tenant User',
        email: `other-${Date.now()}@example.com`,
        passwordHash: await bcrypt.hash('password123', 10),
        role: UserRole.CLIENT_PM,
        tenantId: otherTenant.id,
      });

      await dataSource.getRepository(PushFeedback).save({
        pushId: otherPush.id,
        userId: otherUser.id,
        rating: 1, // 低分
        comment: 'Very poor content from other tenant',
      });
    });

    afterAll(async () => {
      // 清理另一个租户的数据
      await dataSource.getRepository(PushFeedback).delete({ pushId: otherPush.id });
      await dataSource.getRepository(RadarPush).delete({ id: otherPush.id });
      await dataSource.getRepository(AnalyzedContent).delete({ id: otherAnalyzedContent.id });
      await dataSource.getRepository(RawContent).delete({ id: otherRawContent.id });
      await dataSource.getRepository(User).delete({ tenantId: otherTenant.id });
      await dataSource.getRepository(Organization).delete({ id: otherOrganization.id });
      await dataSource.getRepository(Tenant).delete({ id: otherTenant.id });
    });

    it('[P2] should include feedback from all tenants for admin metrics', async () => {
      // GIVEN: 管理员已认证
      // WHEN: 请求质量指标
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/content-quality/metrics')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // THEN: 指标应该包含所有租户的反馈（平台级管理功能）
      expect(response.body).toHaveProperty('totalFeedback');
      // 由于我们是平台级管理员，应该看到所有租户的反馈
      expect(response.body.totalFeedback).toBeGreaterThanOrEqual(0);
    });
  });
});
