const { Client } = require('pg');
require('dotenv').config({ path: '.env.development' });

async function testConnection() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'csaas',
  });

  try {
    console.log('尝试连接到 PostgreSQL...');
    console.log(`Host: ${process.env.DB_HOST}`);
    console.log(`Port: ${process.env.DB_PORT}`);
    console.log(`User: ${process.env.DB_USERNAME}`);
    console.log(`Database: ${process.env.DB_DATABASE || 'csaas'}`);

    await client.connect();
    console.log('✅ 连接成功!');

    const result = await client.query('SELECT version()');
    console.log('PostgreSQL版本:', result.rows[0].version);

    await client.end();
    console.log('✅ 连接已关闭');
  } catch (error) {
    console.error('❌ 连接失败:', error.message);
    console.error('错误详情:', error);
    process.exit(1);
  }
}

testConnection();
