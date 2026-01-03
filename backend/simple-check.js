const { Client } = require('pg');

async function checkTask() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  const res = await client.query(
    "SELECT id, status, error_message as errorMessage, input, result FROM ai_tasks WHERE id = '51627820-d0d1-492c-ab05-d78371fe324f'"
  );

  if (res.rows.length > 0) {
    const task = res.rows[0];
    console.log('=== 聚类任务信息 ===');
    console.log('任务ID:', task.id);
    console.log('状态:', task.status);
    console.log('错误:', task.errorMessage || '无');
    console.log('\n=== 输入数据 ===');
    if (task.input) {
      console.log('文档数量:', task.input.documents?.length || 0);
      if (task.input.documents) {
        task.input.documents.forEach((doc, i) => {
          console.log(`\n文档 ${i+1}:`);
          console.log('  ID:', doc.id);
          console.log('  名称:', doc.name);
          console.log('  内容长度:', doc.content?.length || 0, '字符');
        });
      }
    }
    console.log('\n=== 输出结果 ===');
    if (task.result && task.result.gpt4) {
      const result = task.result.gpt4;
      console.log('categories数量:', result.categories?.length || 0);
      if (result.categories) {
        let totalClusters = 0;
        let totalClauses = 0;
        result.categories.forEach((cat, i) => {
          console.log(`\nCategory ${i+1}: ${cat.name}`);
          console.log('  clusters数量:', cat.clusters?.length || 0);
          if (cat.clusters) {
            totalClusters += cat.clusters.length;
            cat.clusters.forEach(cluster => {
              totalClauses += cluster.clauses?.length || 0;
            });
          }
        });
        console.log(`\n总计: ${totalClusters}个聚类, ${totalClauses}个条款`);
      }
    }
  }

  await client.end();
}

checkTask().catch(console.error);
