const { Client } = require('pg');
require('dotenv').config({ path: '.env.development' });

async function checkDatabase() {
  // 先连接到postgres默认数据库
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: 'postgres', // 连接到默认数据库
  });

  try {
    console.log('连接到postgres默认数据库...');
    await client.connect();
    console.log('✅ 连接成功!');

    // 检查csaas数据库是否存在
    const result = await client.query(
      "SELECT datname FROM pg_database WHERE datname = 'csaas'"
    );

    if (result.rows.length > 0) {
      console.log('✅ csaas数据库存在');
    } else {
      console.log('❌ csaas数据库不存在，需要创建');
      console.log('\n创建csaas数据库...');
      await client.query('CREATE DATABASE csaas');
      console.log('✅ csaas数据库创建成功');
    }

    await client.end();
  } catch (error) {
    console.error('❌ 操作失败:', error.message);
    if (error.code === '28P01') {
      console.error('\n可能原因: 密码错误');
      console.error('请检查.env.development中的DB_PASSWORD是否正确');
    } else if (error.code === 'ECONNRESET') {
      console.error('\n可能原因:');
      console.error('1. PostgreSQL未运行或正在重启');
      console.error('2. pg_hba.conf配置不允许本地连接');
      console.error('3. 防火墙阻止连接');
    }
    process.exit(1);
  }
}

checkDatabase();
