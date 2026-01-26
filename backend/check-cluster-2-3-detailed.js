const { Client } = require('pg');
const fs = require('fs');

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'csaas',
  user: 'postgres',
  password: 'postgres'
});

(async () => {
  try {
    await client.connect();
    const matrixTaskId = 'd759603e-1d6a-4504-8498-e7fdcd3eb294';

    let output = '';

    // 查询矩阵任务的content字段
    const result = await client.query(
      'SELECT result FROM ai_tasks WHERE id = $1',
      [matrixTaskId]
    );

    if (result.rows.length > 0) {
      const resultData = result.rows[0].result;

      if (resultData && resultData.content) {
        output += '📊 矩阵任务的content.content字段:\n';
        output += '='.repeat(80) + '\n\n';

        // content是text类型，需要解析
        let content;
        if (typeof resultData.content === 'string') {
          content = JSON.parse(resultData.content);
        } else {
          content = resultData.content;
        }

        output += `矩阵行数: ${content.matrix ? content.matrix.length : 'N/A'}\n\n`;

        // 查找cluster_2_3
        if (content.matrix) {
          const targetCluster = content.matrix.find(row => row.cluster_id === 'cluster_2_3');

          if (targetCluster) {
            output += '✅ 找到cluster_2_3 (数据使用、加工与展示)\n';
            output += '='.repeat(80) + '\n\n';
            output += JSON.stringify(targetCluster, null, 2);
          } else {
            output += '❌ 未找到cluster_2_3\n\n';
            output += '可用的clusters:\n';
            content.matrix.forEach(row => {
              output += `  - ${row.cluster_id}: ${row.cluster_name}\n`;
            });
          }
        }
      }
    }

    console.log(output);

    // 保存到文件
    fs.writeFileSync('cluster-2-3-matrix-data.txt', output, 'utf8');
    console.log('\n✅ 详细数据已保存到: cluster-2-3-matrix-data.txt');

  } finally {
    await client.end();
  }
})();
