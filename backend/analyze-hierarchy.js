const { Client } = require('pg');

async function getFullHierarchy() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  try {
    await client.connect();

    const result = await client.query(`
      SELECT result
      FROM ai_tasks
      WHERE project_id = (
        SELECT project_id
        FROM action_plan_measures
        WHERE task_id = '3263fb92-e5ec-4bdb-b4bb-43965ae11caf'
        LIMIT 1
      )
      AND type = 'clustering'
      AND status = 'completed'
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (result.rows.length > 0) {
      const resultObj = result.rows[0].result;
      console.log('Result type:', typeof resultObj);
      console.log('Result keys:', Object.keys(resultObj));
      console.log('');

      if (resultObj.content) {
        const contentType = typeof resultObj.content;
        console.log('Content type:', contentType);

        let content;
        if (contentType === 'string') {
          content = JSON.parse(resultObj.content);
        } else {
          content = resultObj.content;
        }

        if (content.categories) {
          console.log('📊 完整的层级结构:\n');
          content.categories.forEach((cat, catIdx) => {
            console.log(`${catIdx + 1}. 【一层分类】${cat.name}`);
            console.log(`   描述: ${(cat.description || '').substring(0, 80)}...`);
            console.log(`   包含聚类数: ${cat.clusters?.length || 0}`);
            console.log('');

            if (cat.clusters) {
              cat.clusters.forEach((cluster, clusterIdx) => {
                console.log(`   ${catIdx + 1}.${clusterIdx + 1} 【二层聚类】${cluster.name}`);
                console.log(`      ID: ${cluster.id}`);
                console.log(`      条款数: ${cluster.clauses?.length || 0}`);
                console.log('');
              });
            }
            console.log('---');
          });
        }
      }
    }

  } catch (err) {
    console.error('错误:', err.message);
    console.error('Stack:', err.stack);
  } finally {
    await client.end();
  }
}

getFullHierarchy();
