import { DataSource } from 'typeorm';
import { User, UserRole } from '../src/database/entities/user.entity';
import { Tenant } from '../src/database/entities/tenant.entity';
import { Organization } from '../src/database/entities/organization.entity';
import { Project, ProjectStatus } from '../src/database/entities/project.entity';
import { RadarPush } from '../src/database/entities/radar-push.entity';
import { PushFeedback } from '../src/database/entities/push-feedback.entity';
import { SystemHealthLog } from '../src/database/entities/system-health-log.entity';
import { AIUsageLog } from '../src/database/entities/ai-usage-log.entity';
import { Alert } from '../src/database/entities/alert.entity';
import { AnalyzedContent } from '../src/database/entities/analyzed-content.entity';
import * as bcrypt from 'bcrypt';

export async function setupCompleteTestData(dataSource: DataSource) {
  console.log('🚀 开始初始化完整测试数据...\n');

  // 1. 创建测试租户
  console.log('1️⃣ 创建测试租户...');
  const tenantRepo = dataSource.getRepository(Tenant);
  let testTenant = await tenantRepo.findOne({ where: { name: 'Test Tenant' } });

  if (!testTenant) {
    testTenant = await tenantRepo.save({
      name: 'Test Tenant',
      companyName: 'Test Company',
    });
  }
  console.log(`✅ 租户创建成功: ${testTenant.id}\n`);

  // 2. 创建测试用户
  console.log('2️⃣ 创建测试用户...');
  const userRepo = dataSource.getRepository(User);
  const passwordHash = await bcrypt.hash('password', 10);

  // 管理员用户
  let adminUser = await userRepo.findOne({ where: { email: 'admin@example.com' } });
  if (!adminUser) {
    adminUser = await userRepo.save({
      email: 'admin@example.com',
      passwordHash,
      name: 'Admin User',
      role: UserRole.ADMIN,
      tenantId: testTenant.id,
    });
  } else {
    adminUser.tenantId = testTenant.id;
    await userRepo.save(adminUser);
  }

  // 普通用户
  let regularUser = await userRepo.findOne({ where: { email: 'user@example.com' } });
  if (!regularUser) {
    regularUser = await userRepo.save({
      email: 'user@example.com',
      passwordHash,
      name: 'Regular User',
      role: UserRole.CLIENT_PM,
      tenantId: testTenant.id,
    });
  } else {
    regularUser.tenantId = testTenant.id;
    await userRepo.save(regularUser);
  }
  console.log(`✅ 用户创建成功: admin=${adminUser.id}, user=${regularUser.id}\n`);

  // 3. 创建测试组织
  console.log('3️⃣ 创建测试组织...');
  const orgRepo = dataSource.getRepository(Organization);
  let testOrg = await orgRepo.findOne({
    where: { name: 'Test Organization', tenantId: testTenant.id }
  });

  if (!testOrg) {
    testOrg = await orgRepo.save({
      name: 'Test Organization',
      tenantId: testTenant.id,
      industryType: 'banking',
      scale: 'medium',
      status: 'active',
      contactPerson: 'Test Contact',
      contactEmail: 'contact@test.com',
    });
  }
  console.log(`✅ 组织创建成功: ${testOrg.id}\n`);

  // 4. 创建测试项目
  console.log('4️⃣ 创建测试项目...');
  const projectRepo = dataSource.getRepository(Project);
  let testProject = await projectRepo.findOne({
    where: { name: 'Test Project', organizationId: testOrg.id }
  });

  if (!testProject) {
    testProject = await projectRepo.save({
      name: 'Test Project',
      organizationId: testOrg.id,
      tenantId: testTenant.id,
      ownerId: regularUser.id,
      status: ProjectStatus.ACTIVE,
    });
  }
  console.log(`✅ 项目创建成功: ${testProject.id}\n`);

  // 5. 跳过创建分析内容（E2E测试不需要）
  console.log('5️⃣ 跳过创建分析内容（E2E测试不需要）\n');
  const contents = [];

  // 6. 跳过创建推送数据（E2E测试不需要）
  console.log('6️⃣ 跳过创建推送数据（E2E测试不需要）\n');
  const pushes = [];

  // 7. 跳过创建推送反馈（E2E测试不需要）
  console.log('7️⃣ 跳过创建推送反馈（E2E测试不需要）\n');
  const feedbackCount = 0;

  // 8. 创建系统健康日志
  console.log('8️⃣ 创建系统健康日志...');
  const healthLogRepo = dataSource.getRepository(SystemHealthLog);
  const metrics = ['availability', 'push_success_rate', 'ai_cost', 'customer_activity'];
  let healthLogCount = 0;

  for (let i = 0; i < 48; i++) { // 48小时的数据
    for (const metric of metrics) {
      await healthLogRepo.save({
        metricType: metric as any,
        metricValue: metric === 'availability' ? 1 : Math.random() * 100,
        targetValue: metric === 'availability' ? 99.5 : 80,
        status: Math.random() > 0.9 ? 'warning' : 'healthy',
        metadata: {},
        recordedAt: new Date(Date.now() - i * 60 * 60 * 1000),
      });
      healthLogCount++;
    }
  }
  console.log(`✅ 健康日志创建成功: ${healthLogCount} 条\n`);

  // 9. 创建 AI 使用日志
  console.log('9️⃣ 创建 AI 使用日志...');
  const aiLogRepo = dataSource.getRepository(AIUsageLog);
  let aiLogCount = 0;

  for (let i = 0; i < 30; i++) {
    await aiLogRepo.save({
      organizationId: testOrg.id,
      modelName: i % 2 === 0 ? 'gpt-4' : 'gpt-3.5-turbo',
      promptTokens: 1000 + i * 100,
      completionTokens: 500 + i * 50,
      totalTokens: 1500 + i * 150,
      cost: parseFloat((0.03 + i * 0.01).toFixed(4)),
      operationType: 'analysis',
      createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
    });
    aiLogCount++;
  }
  console.log(`✅ AI日志创建成功: ${aiLogCount} 条\n`);

  // 10. 创建告警
  console.log('🔟 创建告警...');
  const alertRepo = dataSource.getRepository(Alert);
  const alertTypes = ['crawler_failure', 'ai_cost_exceeded', 'customer_churn_risk'];
  let alertCount = 0;

  for (let i = 0; i < 3; i++) {
    const existing = await alertRepo.findOne({
      where: { alertType: alertTypes[i] as any, status: 'unresolved' }
    });

    if (!existing) {
      await alertRepo.save({
        alertType: alertTypes[i] as any,
        severity: i === 0 ? 'high' : 'medium',
        message: `测试告警 ${i + 1}`,
        status: 'unresolved',
        metadata: {},
      });
      alertCount++;
    }
  }
  console.log(`✅ 告警创建成功: ${alertCount} 条\n`);

  console.log('✨ 测试数据初始化完成！\n');
  console.log('📊 数据统计:');
  console.log(`  - 租户: 1`);
  console.log(`  - 用户: 2 (admin + regular)`);
  console.log(`  - 组织: 1`);
  console.log(`  - 项目: 1`);
  console.log(`  - 分析内容: ${contents.length}`);
  console.log(`  - 推送: ${pushes.length}`);
  console.log(`  - 反馈: ${feedbackCount}`);
  console.log(`  - 健康日志: ${healthLogCount}`);
  console.log(`  - AI日志: ${aiLogCount}`);
  console.log(`  - 告警: ${alertCount}`);
  console.log('');

  return {
    testTenant,
    adminUser,
    regularUser,
    testOrg,
    testProject,
    contents,
    pushes,
  };
}

export async function cleanupTestData(dataSource: DataSource) {
  console.log('🧹 清理测试数据...');

  // 按依赖顺序删除
  await dataSource.getRepository(PushFeedback).delete({});
  await dataSource.getRepository(RadarPush).delete({});
  await dataSource.getRepository(AnalyzedContent).delete({});
  await dataSource.getRepository(Project).delete({});
  await dataSource.getRepository(Organization).delete({});
  await dataSource.getRepository(SystemHealthLog).delete({});
  await dataSource.getRepository(AIUsageLog).delete({});
  await dataSource.getRepository(Alert).delete({});

  console.log('✅ 测试数据清理完成\n');
}
