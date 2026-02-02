import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Organization } from '../src/database/entities/organization.entity';
import { RadarPush } from '../src/database/entities/radar-push.entity';
import { Tenant } from '../src/database/entities/tenant.entity';
import { createTestRadarPush } from './helpers/test-data-factory';

describe('RLS Policy E2E Tests', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let tenant1: Tenant;
  let tenant2: Tenant;
  let org1: Organization;
  let org2: Organization;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = app.get(DataSource);

    // 创建测试租户和组织
    const tenantRepo = dataSource.getRepository(Tenant);
    tenant1 = await tenantRepo.save({
      name: 'Test Tenant 1',
      subscriptionTier: 'basic',
      isActive: true,
    });
    tenant2 = await tenantRepo.save({
      name: 'Test Tenant 2',
      subscriptionTier: 'basic',
      isActive: true,
    });

    const orgRepo = dataSource.getRepository(Organization);
    org1 = await orgRepo.save({
      name: 'Test Org 1',
      tenantId: tenant1.id,
    });
    org2 = await orgRepo.save({
      name: 'Test Org 2',
      tenantId: tenant2.id,
    });
  });

  afterAll(async () => {
    // 清理测试数据
    await dataSource.query(`DELETE FROM organizations WHERE name LIKE 'Test Org%'`);
    await dataSource.query(`DELETE FROM tenants WHERE name LIKE 'Test Tenant%'`);
    await app.close();
  });

  describe('RLS Policy - Tenant Isolation', () => {
    it('should only return data for the current tenant when app.current_tenant is set', async () => {
      // 创建测试数据 - 使用测试数据工厂
      const push1 = await createTestRadarPush(dataSource, {
        tenantId: tenant1.id,
        organizationId: org1.id,
        radarType: 'tech',
      });
      const push2 = await createTestRadarPush(dataSource, {
        tenantId: tenant2.id,
        organizationId: org2.id,
        radarType: 'tech',
      });

      // 设置 app.current_tenant 为 tenant1
      await dataSource.query(`SET app.current_tenant = '${tenant1.id}'`);

      // 查询应该只返回 tenant1 的数据
      const radarPushRepo = dataSource.getRepository(RadarPush);
      const results = await radarPushRepo.find();
      expect(results.length).toBeGreaterThan(0);
      expect(results.every((r) => r.tenantId === tenant1.id)).toBe(true);
      expect(results.find((r) => r.id === push1.id)).toBeDefined();
      expect(results.find((r) => r.id === push2.id)).toBeUndefined();

      // 清理
      await dataSource.query(`RESET app.current_tenant`);
      await radarPushRepo.delete([push1.id, push2.id]);
    });

    it('should return empty results when app.current_tenant is not set', async () => {
      // 确保 app.current_tenant 未设置
      await dataSource.query(`RESET app.current_tenant`);

      // 查询应该返回空结果（RLS 策略阻止）
      const radarPushRepo = dataSource.getRepository(RadarPush);
      const results = await radarPushRepo.find();

      // 由于 RLS 策略使用 true 参数，未设置时应该返回空
      expect(results.length).toBe(0);
    });

    it('should prevent cross-tenant data access via direct SQL query', async () => {
      // 创建测试数据 - 使用测试数据工厂
      const push1 = await createTestRadarPush(dataSource, {
        tenantId: tenant1.id,
        organizationId: org1.id,
        radarType: 'tech',
      });
      const push2 = await createTestRadarPush(dataSource, {
        tenantId: tenant2.id,
        organizationId: org2.id,
        radarType: 'tech',
      });

      // 设置 app.current_tenant 为 tenant1
      await dataSource.query(`SET app.current_tenant = '${tenant1.id}'`);

      // 直接 SQL 查询也应该受 RLS 策略限制
      const results = await dataSource.query(
        `SELECT * FROM radar_pushes WHERE id = $1 OR id = $2`,
        [push1.id, push2.id],
      );

      // 应该只返回 tenant1 的数据
      expect(results.length).toBe(1);
      expect(results[0].id).toBe(push1.id);

      // 清理
      await dataSource.query(`RESET app.current_tenant`);
      const radarPushRepo = dataSource.getRepository(RadarPush);
      await radarPushRepo.delete([push1.id, push2.id]);
    });

    it('should allow admin to bypass RLS policy when app.is_admin is set', async () => {
      // 创建测试数据 - 使用测试数据工厂
      const push1 = await createTestRadarPush(dataSource, {
        tenantId: tenant1.id,
        organizationId: org1.id,
        radarType: 'tech',
      });
      const push2 = await createTestRadarPush(dataSource, {
        tenantId: tenant2.id,
        organizationId: org2.id,
        radarType: 'tech',
      });

      // 设置 app.is_admin = true
      await dataSource.query(`SET app.is_admin = true`);

      // 管理员应该能看到所有租户的数据
      const radarPushRepo = dataSource.getRepository(RadarPush);
      const results = await radarPushRepo.find({
        where: [{ id: push1.id }, { id: push2.id }],
      });

      expect(results.length).toBe(2);
      expect(results.find((r) => r.id === push1.id)).toBeDefined();
      expect(results.find((r) => r.id === push2.id)).toBeDefined();

      // 清理
      await dataSource.query(`RESET app.is_admin`);
      await radarPushRepo.delete([push1.id, push2.id]);
    });
  });

  describe('RLS Policy - Organizations Table', () => {
    it('should apply RLS policy to organizations table', async () => {
      // 设置 app.current_tenant 为 tenant1
      await dataSource.query(`SET app.current_tenant = '${tenant1.id}'`);

      // 查询应该只返回 tenant1 的组织
      const orgRepo = dataSource.getRepository(Organization);
      const results = await orgRepo.find();

      expect(results.length).toBeGreaterThan(0);
      expect(results.every((r) => r.tenantId === tenant1.id)).toBe(true);

      // 清理
      await dataSource.query(`RESET app.current_tenant`);
    });
  });
});
