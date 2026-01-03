const { Client } = require('pg');
const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'csaas',
  user: 'postgres',
  password: 'postgres'
});

async function check() {
  await client.connect();

  // 查询矩阵任务
  const result = await client.query(`
    SELECT id, type, status, input, result, created_at, updated_at
    FROM ai_tasks
    WHERE id = 'd759603e-1d6a-4504-8498-e7fdcd3eb294'
  `);

  if (result.rows.length > 0) {
    const task = result.rows[0];
    console.log('📊 矩阵任务详情：\n');
    console.log('任务ID:', task.id);
    console.log('类型:', task.type);
    console.log('状态:', task.status);
    console.log('创建时间:', task.created_at);
    console.log('更新时间:', task.updated_at);

    console.log('\n📝 输入参数:');
    console.log(JSON.stringify(task.input, null, 2));

    console.log('\n✅ 结果数据结构:');
    if (task.result) {
      console.log('Result keys:', Object.keys(task.result));

      // 检查 content 字段
      if (task.result.content) {
        console.log('\n📦 content 字段类型:', typeof task.result.content);

        let parsedContent;
        if (typeof task.result.content === 'string') {
          try {
            parsedContent = JSON.parse(task.result.content);
            console.log('✅ content 是有效的 JSON 字符串');
            console.log('解析后的 keys:', Object.keys(parsedContent));

            if (parsedContent.matrix) {
              console.log('\n🎯 matrix 数据:');
              console.log('  - 矩阵行数:', parsedContent.matrix.length);
              if (parsedContent.matrix.length > 0) {
                console.log('  - 第一行示例:', JSON.stringify(parsedContent.matrix[0], null, 2).substring(0, 300));
              }
            }

            if (parsedContent.maturity_model_description) {
              console.log('\n📖 成熟度模型描述:', parsedContent.maturity_model_description.substring(0, 100));
            }
          } catch (e) {
            console.log('❌ content JSON 解析失败:', e.message);
            console.log('Content 前200字符:', task.result.content.substring(0, 200));
          }
        } else {
          parsedContent = task.result.content;
          console.log('✅ content 是对象格式');
          console.log('Content keys:', Object.keys(parsedContent));
        }
      } else {
        console.log('⚠️ 没有 content 字段');
        console.log('直接查看 result keys:', Object.keys(task.result));
      }

      // 检查其他重要字段
      if (task.result.selectedModel) {
        console.log('\n🤖 选中模型:', task.result.selectedModel);
      }
      if (task.result.confidenceLevel) {
        console.log('📊 置信度:', task.result.confidenceLevel);
      }
      if (task.result.qualityScores) {
        console.log('✨ 质量评分:', task.result.qualityScores);
      }
    } else {
      console.log('⚠️ 没有结果数据');
    }

    // 检查是否有生成事件
    const events = await client.query(`
      SELECT id, event_type, metadata, created_at
      FROM ai_generation_events
      WHERE task_id = 'd759603e-1d6a-4504-8498-e7fdcd3eb294'
      ORDER BY created_at ASC
      LIMIT 10
    `);

    console.log('\n📋 生成事件数:', events.rows.length);
    if (events.rows.length > 0) {
      console.log('前3个事件:');
      events.rows.slice(0, 3).forEach((event, idx) => {
        console.log(`  ${idx + 1}. ${event.event_type} (${event.created_at})`);
      });
    }

  } else {
    console.log('❌ 未找到该任务');
  }

  await client.end();
}

check().catch(console.error);
