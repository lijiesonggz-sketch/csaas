const { Client } = require('pg');

async function checkTableStructure() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  // 检查表结构
  const schemaRes = await client.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'ai_generation_results'
    ORDER BY ordinal_position
  `);

  console.log('=== ai_generation_results 表结构 ===');
  schemaRes.rows.forEach(col => {
    console.log(`  ${col.column_name}: ${col.data_type}`);
  });

  // 查询任务相关的所有结果
  const dataRes = await client.query(
    "SELECT * FROM ai_generation_results WHERE task_id = '51627820-d0d1-492c-ab05-d78371fe324f' LIMIT 5"
  );

  console.log('\n=== 数据记录 ===');
  console.log('记录数量:', dataRes.rows.length);

  if (dataRes.rows.length > 0) {
    const firstRow = dataRes.rows[0];
    console.log('\n第一行的所有字段:');
    Object.keys(firstRow).forEach(key => {
      const value = firstRow[key];
      if (key === 'raw_result' || key === 'validation_details') {
        console.log(`  ${key}: [${typeof value}] ${String(value).substring(0, 100)}...`);
      } else {
        console.log(`  ${key}: ${value}`);
      }
    });
  }

  await client.end();
}

checkTableStructure().catch(console.error);
