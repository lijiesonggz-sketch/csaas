const { Client } = require('pg');

const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'csaas'
});

(async () => {
  try {
    await client.connect();
    console.log('数据库连接成功');

    // 要添加的新信息源
    const newSources = [
      {
        source: '北京金融监管局',
        category: 'compliance',
        url: 'http://jrj.beijing.gov.cn',
        type: 'website',
        crawlSchedule: '0 3 * * *', // 每日凌晨3:00
        isActive: true
      },
      {
        source: '上海金融监管局',
        category: 'compliance',
        url: 'http://jrj.sh.gov.cn',
        type: 'website',
        crawlSchedule: '0 3 * * *', // 每日凌晨3:00
        isActive: true
      }
    ];

    for (const sourceData of newSources) {
      // 检查是否已存在
      const existing = await client.query(
        'SELECT id FROM radar_sources WHERE source = $1 AND category = $2',
        [sourceData.source, sourceData.category]
      );

      if (existing.rows.length > 0) {
        console.log(`⚠️  信息源已存在，跳过: ${sourceData.source}`);
        continue;
      }

      // 插入新信息源
      await client.query(
        `INSERT INTO radar_sources (source, category, url, type, "crawlSchedule", "isActive", "lastCrawlStatus", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [sourceData.source, sourceData.category, sourceData.url, sourceData.type,
         sourceData.crawlSchedule, sourceData.isActive]
      );

      console.log(`✅ 添加信息源: ${sourceData.source} (${sourceData.category})`);
    }

    // 统计信息
    const result = await client.query(
      'SELECT category, COUNT(*) as count FROM radar_sources GROUP BY category ORDER BY category'
    );

    console.log('\n📊 信息源统计:');
    result.rows.forEach(row => {
      console.log(`  ${row.category}: ${row.count} 个`);
    });

    console.log('\n✅ 种子数据更新完成！');
  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
