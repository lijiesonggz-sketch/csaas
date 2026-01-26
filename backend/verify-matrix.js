const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'csaas',
  user: 'postgres',
  password: 'postgres'
});

(async () => {
  await client.connect();

  const r = await client.query(
    "SELECT result FROM ai_tasks WHERE id = '10ceab80-eacb-4c78-a570-aa2243e92ecf'"
  );

  if (r.rows.length > 0) {
    const matrix = r.rows[0].result.selectedResult.matrix;
    console.log('矩阵数据验证:');
    console.log('  总行数:', matrix.length);
    console.log('\n第一行数据:');
    console.log('  cluster_id:', matrix[0].cluster_id);
    console.log('  cluster_name:', matrix[0].cluster_name);
    console.log('  levels字段:', Object.keys(matrix[0].levels));
    console.log('  level_1存在:', !!matrix[0].levels.level_1);
    if (matrix[0].levels.level_1) {
      console.log('  level_1内容:', JSON.stringify(matrix[0].levels.level_1).substring(0, 100) + '...');
    }
  }

  await client.end();
})();
