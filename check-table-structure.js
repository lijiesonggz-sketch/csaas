const { Client } = require('pg');

async function checkTableStructure() {
  const client = new Client({
    host: '127.0.0.1',
    port: 5432,
    database: 'csaas_dev',
    user: 'csaas_user',
    password: 'csaas_password',
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // 检查 analyzed_contents 表的列
    const result = await client.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'analyzed_contents'
      ORDER BY ordinal_position;
    `);

    console.log('analyzed_contents 表结构:');
    console.log('='.repeat(80));
    console.log('列名'.padEnd(25) + '数据类型'.padEnd(20) + '默认值'.padEnd(30) + '可空');
    console.log('='.repeat(80));

    result.rows.forEach(row => {
      console.log(
        row.column_name.padEnd(25) +
        row.data_type.padEnd(20) +
        (row.column_default || 'NULL').padEnd(30) +
        row.is_nullable
      );
    });

    console.log('='.repeat(80));

    // 检查是否有 categories 列
    const hasCategories = result.rows.some(row => row.column_name === 'categories');
    console.log(`\n${hasCategories ? '✅' : '❌'} categories 列${hasCategories ? '已存在' : '不存在'}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkTableStructure();
