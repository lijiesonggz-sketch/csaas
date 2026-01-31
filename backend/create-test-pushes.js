const { Client } = require('pg');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config({ path: '.env.development' });

async function createTestPushes() {
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

    // 组织ID（从日志中获取）
    const organizationId = '50664c3e-d1a4-4bc5-8b08-2ab48c1b15b9';

    // 查询现有的raw_contents
    const rawResult = await client.query(`
      SELECT id, title, summary, "source", "publishDate", url, "fullContent"
      FROM raw_contents
      ORDER BY "createdAt" DESC
      LIMIT 10
    `);

    if (rawResult.rows.length === 0) {
      console.log('❌ No raw contents found. Please run crawler first.');
      return;
    }

    console.log(`📋 Found ${rawResult.rows.length} raw contents\n`);

    // 为每个raw_content创建analyzed_content和radar_push
    let techCount = 0;
    let industryCount = 0;
    let complianceCount = 0;

    for (let i = 0; i < rawResult.rows.length; i++) {
      const raw = rawResult.rows[i];

      // 决定雷达类型（循环分配）
      let radarType;
      if (i % 3 === 0) {
        radarType = 'tech';
        techCount++;
      } else if (i % 3 === 1) {
        radarType = 'industry';
        industryCount++;
      } else {
        radarType = 'compliance';
        complianceCount++;
      }

      // 1. 创建analyzed_content
      const analyzedId = uuidv4();

      const keywords = ['云原生', '微服务', 'DevOps', '容器化'];
      const categories = ['技术架构', '云计算'];

      const aiSummary = raw.summary || raw.title?.substring(0, 100) || 'AI生成的摘要：该技术方案能够有效提升系统性能和可扩展性';

      const roiAnalysis = {
        estimatedCost: '50-100万',
        expectedBenefit: '年节省200万运维成本',
        roiEstimate: 'ROI 2:1',
        implementationPeriod: '3-6个月',
        recommendedVendors: ['阿里云', '腾讯云', '华为云']
      };

      const practiceDescription = radarType === 'industry'
        ? `某领先银行成功实施了云原生转型，${raw.title?.substring(0, 50) || ''}`
        : null;

      const complianceAnalysis = radarType === 'compliance' ? {
        complianceRiskCategory: '数据安全',
        penaltyCase: '某银行因数据泄露被罚款200万元',
        policyRequirements: '《数据安全法》要求建立数据分类分级制度',
        remediationSuggestions: '建议实施端到端加密和访问控制',
        relatedWeaknessCategories: ['数据治理', '安全合规']
      } : null;

      await client.query(`
        INSERT INTO analyzed_contents (
          id, "contentId", keywords, categories, "targetAudience", "aiSummary",
          "roiAnalysis", "practiceDescription", "estimatedCost", "implementationPeriod",
          "technicalEffect", "complianceAnalysis", "relevanceScore", "aiModel",
          "tokensUsed", status, "analyzedAt", "createdAt"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
        )
      `, [
        analyzedId,
        raw.id,
        JSON.stringify(keywords),
        JSON.stringify(categories),
        'IT总监',
        aiSummary,
        JSON.stringify(roiAnalysis),
        practiceDescription,
        radarType === 'industry' ? '约80万' : null,
        radarType === 'industry' ? '6个月' : null,
        radarType === 'industry' ? '部署时间从2小时缩短到10分钟' : null,
        complianceAnalysis ? JSON.stringify(complianceAnalysis) : null,
        0.85,
        'qwen-max',
        1500,
        'success',
        new Date(),
        new Date()
      ]);

      // 2. 创建radar_push
      const pushId = uuidv4();
      const scheduledAt = new Date();
      scheduledAt.setHours(scheduledAt.getHours() - 1); // 1小时前

      const pushData = {
        id: pushId,
        organizationId,
        radarType,
        contentId: analyzedId,
        relevanceScore: 0.85 + Math.random() * 0.14, // 0.85-0.99
        priorityLevel: Math.random() > 0.5 ? 'high' : 'medium',
        scheduledAt,
        status: 'sent',
        sentAt: new Date(),
        isRead: false,
        isBookmarked: false,
        checklistCompletedAt: null,
        playbookStatus: radarType === 'compliance' ? 'ready' : null
      };

      await client.query(`
        INSERT INTO radar_pushes (
          id, "organizationId", "radarType", "contentId", "relevanceScore",
          "priorityLevel", "scheduledAt", status, "sentAt", "isRead", "isBookmarked",
          "checklistCompletedAt", "playbookStatus", "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
        )
      `, [
        pushData.id, pushData.organizationId, pushData.radarType,
        pushData.contentId, pushData.relevanceScore, pushData.priorityLevel,
        pushData.scheduledAt, pushData.status, pushData.sentAt, pushData.isRead,
        pushData.isBookmarked, pushData.checklistCompletedAt, pushData.playbookStatus,
        new Date(), new Date()
      ]);

      console.log(`✅ Created ${radarType} push: ${raw.title?.substring(0, 40)}...`);
    }

    console.log('\n📊 Summary:');
    console.log(`   Tech radar: ${techCount} pushes`);
    console.log(`   Industry radar: ${industryCount} pushes`);
    console.log(`   Compliance radar: ${complianceCount} pushes`);
    console.log(`   Total: ${techCount + industryCount + complianceCount} pushes\n`);

    // 验证数据
    const verifyResult = await client.query(`
      SELECT "radarType", COUNT(*) as count
      FROM radar_pushes
      WHERE "organizationId" = $1
      GROUP BY "radarType"
    `, [organizationId]);

    console.log('✅ Verification - Pushes in database:');
    verifyResult.rows.forEach(row => {
      console.log(`   ${row.radarType}: ${row.count} pushes`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
    console.log('\n✅ Database connection closed');
  }
}

createTestPushes();
