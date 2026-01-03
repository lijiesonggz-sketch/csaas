const { Client } = require('pg');

async function checkSuccessTaskModel() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  try {
    await client.connect();

    const successTaskId = 'd5e35635-b2c7-4c53-8057-69d229f2d6c4';

    console.log('查询成功任务的详细配置:\n');

    // 查询AI生成事件
    const eventsResult = await client.query(`
      SELECT
        event_type,
        model_name,
        model_version,
        prompt_tokens,
        completion_tokens,
        total_tokens,
        cost,
        metadata,
        created_at
      FROM ai_generation_events
      WHERE task_id = $1
      ORDER BY created_at ASC
      LIMIT 5
    `, [successTaskId]);

    if (eventsResult.rows.length > 0) {
      console.log('找到', eventsResult.rows.length, '个AI事件:');
      eventsResult.rows.forEach((event, index) => {
        console.log(`\n事件 ${index + 1}:`);
        console.log('  - 类型:', event.event_type);
        console.log('  - 模型:', event.model_name);
        console.log('  - 版本:', event.model_version);
        console.log('  - Prompt tokens:', event.prompt_tokens);
        console.log('  - Completion tokens:', event.completion_tokens);
        console.log('  - 总tokens:', event.total_tokens);
        console.log('  - 成本:', event.cost);
        console.log('  - 时间:', event.created_at);

        if (event.metadata) {
          try {
            const metadata = typeof event.metadata === 'string' ? JSON.parse(event.metadata) : event.metadata;
            console.log('  - 元数据:', JSON.stringify(metadata, null, 2).substring(0, 200));
          } catch (e) {
            console.log('  - 元数据:', event.metadata);
          }
        }
      });
    } else {
      console.log('未找到AI生成事件');
    }

    // 查询措施样本（看前3条）
    console.log('\n\n查询措施样本（前3条）:');
    const measuresResult = await client.query(`
      SELECT
        cluster_name,
        title,
        description,
        timeline,
        responsible_department,
        ai_model
      FROM action_plan_measures
      WHERE task_id = $1
      ORDER BY sort_order
      LIMIT 3
    `, [successTaskId]);

    measuresResult.rows.forEach((measure, index) => {
      console.log(`\n措施 ${index + 1}:`);
      console.log('  - 聚类:', measure.cluster_name);
      console.log('  - 标题:', measure.title);
      console.log('  - 描述:', measure.description.substring(0, 100) + '...');
      console.log('  - 时间线:', measure.timeline);
      console.log('  - 部门:', measure.responsible_department);
      console.log('  - AI模型:', measure.ai_model);
    });

  } catch (err) {
    console.error('错误:', err.message);
  } finally {
    await client.end();
  }
}

checkSuccessTaskModel();
