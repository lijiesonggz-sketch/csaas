const { Client } = require('pg');

async function checkOutputStructure() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  const taskId = '510233a2-e8d1-48b5-891b-ab244c0e4ffc';

  const events = await client.query(`
    SELECT id, model, output, metadata
    FROM ai_generation_events
    WHERE task_id = '${taskId}' AND model = 'domestic'
  `);

  if (events.rows.length > 0) {
    const event = events.rows[0];
    console.log('=== Output字段结构 ===');
    console.log('Output类型:', typeof event.output);

    if (typeof event.output === 'object') {
      console.log('Output是对象');
      console.log('Output的键:', Object.keys(event.output));

      if (event.output.content) {
        console.log('\nContent类型:', typeof event.output.content);
        console.log('Content长度:', event.output.content?.length || 0);

        if (typeof event.output.content === 'object') {
          console.log('\nContent是对象！');
          console.log('Content的键:', Object.keys(event.output.content));

          if (event.output.content.categories) {
            console.log('\n找到categories!');
            console.log('类别数量:', event.output.content.categories?.length || 0);

            event.output.content.categories.forEach((cat, idx) => {
              console.log(`\n类别 ${idx+1}: ${cat.name}`);
              console.log(`  子聚类数: ${cat.clusters?.length || 0}`);
            });
          }
        }
      }
    }
  }

  await client.end();
}

checkOutputStructure().catch(console.error);
