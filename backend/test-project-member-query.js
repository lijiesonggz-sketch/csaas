const { Client } = require('pg');

async function testProjectMemberQuery() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'csaas',
    user: 'postgres',
    password: 'postgres'
  });

  try {
    await client.connect();

    const projectId = 'd2fe6e12-3f43-462f-b2ac-973e4adfe2e2';
    const userId = '65fefcd7-3b4b-49d7-a56f-8db474314c62';

    console.log('\n=== 查询项目成员 ===');
    console.log('Project ID:', projectId);
    console.log('User ID:', userId);

    // 直接SQL查询
    const result1 = await client.query(
      'SELECT * FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, userId]
    );
    console.log('\n1. 直接SQL查询结果:', result1.rows.length, '条记录');
    if (result1.rows.length > 0) {
      console.log('   记录详情:', result1.rows[0]);
    }

    // 检查大小写
    const result2 = await client.query(
      'SELECT column_name, data_type FROM information_schema.columns WHERE table_name = \'project_members\''
    );
    console.log('\n2. 表结构:');
    result2.rows.forEach(row => {
      console.log(`   ${row.column_name}: ${row.data_type}`);
    });

    // 检查所有project_members
    const result3 = await client.query('SELECT * FROM project_members');
    console.log('\n3. 所有project_members记录:', result3.rows.length, '条');
    result3.rows.forEach(row => {
      console.log(`   ${row.project_id.substring(0, 8)}... | ${row.user_id.substring(0, 8)}... | ${row.role}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

testProjectMemberQuery();
