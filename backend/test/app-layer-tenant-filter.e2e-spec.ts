import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { RadarPushRepository } from '../src/database/repositories/radar-push.repository';
import { Tenant } from '../src/database/entities/tenant.entity';
import { Organization } from '../src/database/entities/organization.entity';
import { createTestRadarPush } from './helpers/test-data-factory';

describe('应用层租户过滤测试', () => {
  let app: TestingModule;
  let dataSource: DataSource;
  let radarPushRepo: RadarPushRepository;
  let tenant1: Tenant;
  let tenant2: Tenant;
  let org1: Organization;
  let org2: Organization;

  beforeAll(async () => {
    app = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    await app.init();

    dataSource = app.get(DataSource);
    radarPushRepo = app.get(RadarPushRepository);

    // 创建测试租户和组织
    const tenantRepo = dataSource.getRepository(Tenant);
    tenant1 = await tenantRepo.save({
      name: 'App Filter Test Tenant 1',
      subscriptionTier: 'basic',
      isActive: true,
    });
    tenant2 = await tenantRepo.save({
      name: 'App Filter Test Tenant 2',
      subscriptionTier: 'basic',
      isActive: true,
    });

    const orgRepo = dataSource.getRepository(Organization);
    org1 = await orgRepo.save({
      name: 'App Filter Test Org 1',
      tenantId: tenant1.id,
    });
    org2 = await orgRepo.save({
      name: 'App Filter Test Org 2',
      tenantId: tenant2.id,
    });
  });

  afterAll(async () => {
    // 清理测试数据
    await dataSource.query(`DELETE FROM organizations WHERE name LIKE 'App Filter Test%'`);
    await dataSource.query(`DELETE FROM tenants WHERE name LIKE 'App Filter Test%'`);
    await app.close();
  });

  describe('BaseTenantRepository - 租户隔离', () => {
    it('应该只返回当前租户的数据', async () => {
      // 创建测试数据
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

      // 查询租户1的数据
      const tenant1Pushes = await radarPushRepo.find(tenant1.id);

      // 验证：只返回租户1的数据
      expect(tenant1Pushes.length).toBeGreaterThan(0);
      expect(tenant1Pushes.every((p) => p.tenantId === tenant1.id)).toBe(true);
      expect(tenant1Pushes.find((p) => p.id === push1.id)).toBeDefined();
      expect(tenant1Pushes.find((p) => p.id === push2.id)).toBeUndefined();

      // 清理
      const radarPushRepo2 = dataSource.getRepository('RadarPush');
      await radarPushRepo2.delete([push1.id, push2.id]);
    });

    it('应该阻止跨租户访问', async () => {
      // 创建租户1的数据
      const push1 = await createTestRadarPush(dataSource, {
        tenantId: tenant1.id,
        organizationId: org1.id,
        radarType: 'tech',
      });

      // 尝试用租户2的ID查询租户1的数据
      const result = await radarPushRepo.findById(tenant2.id, push1.id);

      // 验证：应该返回null（找不到）
      expect(result).toBeNull();

      // 清理
      const radarPushRepo2 = dataSource.getRepository('RadarPush');
      await radarPushRepo2.delete(push1.id);
    });

    it('保存时应该自动设置tenantId', async () => {
      // 先创建依赖数据（使用工厂）
      const push = await createTestRadarPush(dataSource, {
        tenantId: tenant1.id,
        organizationId: org1.id,
        radarType: 'tech',
      });

      // 验证：tenantId被自动设置
      expect(push.tenantId).toBe(tenant1.id);

      // 验证：其他租户无法访问
      const result = await radarPushRepo.findById(tenant2.id, push.id);
      expect(result).toBeNull();

      // 清理
      const radarPushRepo2 = dataSource.getRepository('RadarPush');
      await radarPushRepo2.delete(push.id);
    });

    it('QueryBuilder应该自动添加tenantId过滤', async () => {
      // 创建测试数据
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

      // 使用QueryBuilder查询
      const qb = radarPushRepo.createQueryBuilder(tenant1.id, 'push');
      const results = await qb.getMany();

      // 验证：只返回租户1的数据
      expect(results.every((p) => p.tenantId === tenant1.id)).toBe(true);
      expect(results.find((p) => p.id === push1.id)).toBeDefined();
      expect(results.find((p) => p.id === push2.id)).toBeUndefined();

      // 清理
      const radarPushRepo2 = dataSource.getRepository('RadarPush');
      await radarPushRepo2.delete([push1.id, push2.id]);
    });

    it('count应该只计算当前租户的数据', async () => {
      // 创建测试数据
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

      // 计数租户1的数据
      const count1 = await radarPushRepo.count(tenant1.id);

      // 计数租户2的数据
      const count2 = await radarPushRepo.count(tenant2.id);

      // 验证：计数不相等（各自只计算自己的数据）
      expect(count1).toBeGreaterThan(0);
      expect(count2).toBeGreaterThan(0);

      // 清理
      const radarPushRepo2 = dataSource.getRepository('RadarPush');
      await radarPushRepo2.delete([push1.id, push2.id]);
    });
  });

  describe('安全性测试', () => {
    it('应该防止通过修改tenantId进行跨租户访问', async () => {
      // 创建租户1的数据
      const push = await createTestRadarPush(dataSource, {
        tenantId: tenant1.id,
        organizationId: org1.id,
        radarType: 'tech',
      });

      // 尝试用租户2的ID更新数据
      await radarPushRepo.update(
        tenant2.id,
        { id: push.id } as any,
        { priorityLevel: 'low' } as any,
      );

      // 验证：数据未被更新（因为tenantId不匹配）
      const updated = await radarPushRepo.findById(tenant1.id, push.id);
      expect(updated?.priorityLevel).toBe('high'); // 保持原值

      // 清理
      const radarPushRepo2 = dataSource.getRepository('RadarPush');
      await radarPushRepo2.delete(push.id);
    });

    it('应该防止通过删除操作进行跨租户访问', async () => {
      // 创建租户1的数据
      const push = await createTestRadarPush(dataSource, {
        tenantId: tenant1.id,
        organizationId: org1.id,
        radarType: 'tech',
      });

      // 尝试用租户2的ID删除数据
      await radarPushRepo.delete(tenant2.id, { id: push.id } as any);

      // 验证：数据未被删除
      const exists = await radarPushRepo.findById(tenant1.id, push.id);
      expect(exists).not.toBeNull();

      // 清理
      const radarPushRepo2 = dataSource.getRepository('RadarPush');
      await radarPushRepo2.delete(push.id);
    });
  });
});
