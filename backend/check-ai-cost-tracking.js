const { Client } = require('pg');

async function checkCostTracking() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  // 检查所有模型的成本追踪记录
  const res = await client.query(`
    SELECT
      model,
      COUNT(*) as count,
      SUM(tokens) as total_tokens,
      SUM(cost) as total_cost
    FROM ai_cost_tracking
    GROUP BY model
    ORDER BY count DESC
  `);

  console.log('=== AI模型调用统计（来自ai_cost_tracking表） ===\n');

  if (res.rows.length === 0) {
    console.log('⚠️ 没有找到任何成本追踪记录');
  } else {
    res.rows.forEach((r) => {
      console.log(`${r.model}:`);
      console.log(`  调用次数: ${r.count}`);
      console.log(`  总Tokens: ${r.total_tokens || 0}`);
      console.log(`  总成本: ¥${r.total_cost ? Number(r.total_cost).toFixed(4) : '0.0000'}`);
      console.log('');
    });
  }

  await client.end();
}

checkCostTracking().catch(console.error);
