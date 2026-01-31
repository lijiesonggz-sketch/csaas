const { Client } = require('pg');
require('dotenv').config({ path: '.env.development' });

async function checkRadarPushes() {
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

    // 查询总推送数
    const totalResult = await client.query('SELECT COUNT(*) as total FROM radar_pushes');
    console.log(`📊 Total pushes: ${totalResult.rows[0].total}\n`);

    // 按雷达类型统计
    const typeResult = await client.query(`
      SELECT "radarType", COUNT(*) as count
      FROM radar_pushes
      GROUP BY "radarType"
      ORDER BY "radarType"
    `);
    console.log('📊 Pushes by radar type:');
    typeResult.rows.forEach(row => {
      console.log(`   ${row.radarType}: ${row.count}`);
    });
    console.log('');

    // 按状态统计
    const statusResult = await client.query(`
      SELECT status, COUNT(*) as count
      FROM radar_pushes
      GROUP BY status
      ORDER BY status
    `);
    console.log('📊 Pushes by status:');
    statusResult.rows.forEach(row => {
      console.log(`   ${row.status}: ${row.count}`);
    });
    console.log('');

    // 查询最近的5条推送（所有类型）
    const recentResult = await client.query(`
      SELECT
        id,
        "radarType",
        status,
        "priorityLevel",
        "relevanceScore",
        "scheduledAt",
        "organizationId",
        "createdAt"
      FROM radar_pushes
      ORDER BY "createdAt" DESC
      LIMIT 5
    `);
    console.log('📋 Recent 5 pushes:');
    recentResult.rows.forEach((row, i) => {
      console.log(`   ${i + 1}. ${row.id.substring(0, 8)}...`);
      console.log(`      Type: ${row.radarType}, Status: ${row.status}, Priority: ${row.priorityLevel}`);
      console.log(`      Score: ${row.relevanceScore}, Scheduled: ${row.scheduledAt}`);
      console.log(`      Org: ${row.organizationId}`);
    });
    console.log('');

    // 查询每个组织的推送数
    const orgResult = await client.query(`
      SELECT "organizationId", COUNT(*) as count
      FROM radar_pushes
      GROUP BY "organizationId"
      ORDER BY count DESC
    `);
    console.log('📊 Pushes per organization:');
    orgResult.rows.forEach(row => {
      console.log(`   ${row.organizationId}: ${row.count} pushes`);
    });
    console.log('');

    // 检查是否有关联的analyzed_content
    const contentResult = await client.query(`
      SELECT COUNT(*) as count
      FROM radar_pushes rp
      INNER JOIN analyzed_contents ac ON rp."contentId" = ac.id
    `);
    console.log(`📊 Pushes with analyzed content: ${contentResult.rows[0].count}\n`);

    // 检查raw_content表
    const rawResult = await client.query('SELECT COUNT(*) as count FROM raw_contents');
    console.log(`📊 Total raw contents: ${rawResult.rows[0].count}\n`);

    // 检查analyzed_content表
    const analyzedResult = await client.query('SELECT COUNT(*) as count FROM analyzed_contents');
    console.log(`📊 Total analyzed contents: ${analyzedResult.rows[0].count}\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
    console.log('\n✅ Database connection closed');
  }
}

checkRadarPushes();
