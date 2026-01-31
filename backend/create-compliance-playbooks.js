const { Client } = require('pg');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config({ path: '.env.development' });

async function createCompliancePlaybooks() {
  const client = new Client({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT) || 5432,
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'csaas',
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // 查询所有合规雷达推送
    const pushesResult = await client.query(`
      SELECT id, "organizationId"
      FROM radar_pushes
      WHERE "radarType" = 'compliance'
      ORDER BY "createdAt" DESC
    `);

    if (pushesResult.rows.length === 0) {
      console.log('❌ No compliance radar pushes found.');
      return;
    }

    console.log(`📋 Found ${pushesResult.rows.length} compliance pushes\n`);

    // 为每个合规推送创建playbook
    for (const push of pushesResult.rows) {
      // 检查是否已存在playbook
      const existingResult = await client.query(`
        SELECT id FROM compliance_playbooks WHERE "pushId" = $1
      `, [push.id]);

      if (existingResult.rows.length > 0) {
        console.log(`⚠️  Playbook already exists for push ${push.id.substring(0, 8)}...`);
        continue;
      }

      const playbookId = uuidv4();

      // 创建完整的剧本数据
      const playbookData = {
        id: playbookId,
        pushId: push.id,
        organizationId: push.organizationId,
        checklistItems: [
          {
            id: uuidv4(),
            text: '是否建立了数据分类分级制度？',
            category: '数据治理',
            checked: false,
            order: 1
          },
          {
            id: uuidv4(),
            text: '是否实施了端到端数据加密？',
            category: '技术安全',
            checked: false,
            order: 2
          },
          {
            id: uuidv4(),
            text: '是否建立了数据访问控制机制？',
            category: '访问控制',
            checked: false,
            order: 3
          },
          {
            id: uuidv4(),
            text: '是否定期进行数据安全审计？',
            category: '审计合规',
            checked: false,
            order: 4
          },
          {
            id: uuidv4(),
            text: '是否建立了数据泄露应急预案？',
            category: '应急响应',
            checked: false,
            order: 5
          }
        ],
        solutions: [
          {
            name: '实施数据分类分级管理系统',
            estimatedCost: 500000,
            expectedBenefit: 2000000,
            roiScore: 8.5,
            implementationTime: '3-4个月'
          },
          {
            name: '部署端到端加密方案',
            estimatedCost: 300000,
            expectedBenefit: 1500000,
            roiScore: 9.0,
            implementationTime: '2-3个月'
          },
          {
            name: '建立RBAC访问控制体系',
            estimatedCost: 200000,
            expectedBenefit: 800000,
            roiScore: 7.5,
            implementationTime: '2个月'
          }
        ],
        reportTemplate: `# 数据安全合规报告

## 执行摘要

根据《数据安全法》、《个人信息保护法》等法律法规要求，本机构需要建立完善的数据安全治理体系。

## 风险评估

当前主要风险点：
1. 数据分类分级制度缺失
2. 敏感数据加密保护不足
3. 访问控制机制不完善

## 整改建议

1. **建立数据分类分级制度**（优先级：高）
   - 制定数据分类分级标准
   - 建立数据资产清单
   - 实施差异化保护措施

2. **实施端到端加密**（优先级：高）
   - 传输加密：TLS 1.3
   - 存储加密：AES-256
   - 密钥管理：KMS

3. **完善访问控制**（优先级：中）
   - 实施最小权限原则
   - 建立权限审批流程
   - 定期权限审计

## 实施计划

**第一阶段（1-2个月）**：制度建立
**第二阶段（2-4个月）**：技术实施
**第三阶段（4-6个月）**：持续改进

## 预期成果

- 降低合规风险80%
- 提升数据安全防护能力
- 满足监管要求`,
        policyReference: [
          '《中华人民共和国数据安全法》',
          '《中华人民共和国个人信息保护法》',
          '《关键信息基础设施安全保护条例》',
          '《网络安全法》'
        ],
        generatedAt: new Date()
      };

      await client.query(`
        INSERT INTO compliance_playbooks (
          id, "pushId", "organizationId", "checklistItems", solutions,
          "reportTemplate", "policyReference", "createdAt", "generatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        playbookData.id,
        playbookData.pushId,
        playbookData.organizationId,
        JSON.stringify(playbookData.checklistItems),
        JSON.stringify(playbookData.solutions),
        playbookData.reportTemplate,
        JSON.stringify(playbookData.policyReference),
        new Date(),
        playbookData.generatedAt
      ]);

      console.log(`✅ Created playbook for push ${push.id.substring(0, 8)}...`);
    }

    // 验证
    const verifyResult = await client.query(`
      SELECT COUNT(*) as count FROM compliance_playbooks
    `);
    console.log(`\n📊 Total playbooks in database: ${verifyResult.rows[0].count}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
    console.log('\n✅ Database connection closed');
  }
}

createCompliancePlaybooks();
