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
    const result = await client.query('SELECT source, category, url, "isActive" FROM radar_sources ORDER BY category, source');
    console.log('现有雷达信息源数量:', result.rows.length);
    console.log('\n详细信息:');
    console.log('Category | Source | URL | Status');
    console.log('-'.repeat(80));
    result.rows.forEach(row => {
      console.log(`${row.category.padEnd(12)} | ${row.source.padEnd(20)} | ${row.isActive ? '启用' : '禁用'}`);
    });

    // 检查是否有合规信息源
    const complianceSources = result.rows.filter(r => r.category === 'compliance');
    console.log(`\n合规雷达信息源数量: ${complianceSources.length}`);
  } catch (error) {
    console.error('查询失败:', error.message);
  } finally {
    await client.end();
  }
})();
