const { Client } = require('pg');
const { v4: uuidv4 } = require('uuid');

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

    const projectId = '5b43dad9-18f0-436b-b2b1-417c08507c99';

    // 获取最新的聚类任务
    const result = await client.query(
      "SELECT id, status, progress_details FROM ai_tasks WHERE project_id = $1 AND type = 'clustering' ORDER BY created_at DESC LIMIT 1",
      [projectId]
    );

    if (result.rows.length === 0) {
      console.log('❌ 未找到聚类任务');
      process.exit(1);
    }

    const task = result.rows[0];
    console.log('✅ 找到聚类任务:');
    console.log('   ID:', task.id);
    console.log('   状态:', task.status);
    console.log('   进度详情:', JSON.stringify(task.progress_details, null, 2));

    // 测试status API
    console.log('\n🔬 测试后端status API...');
    const response = await fetch(`http://localhost:3000/ai-tasks/${task.id}/status`);

    console.log('   状态码:', response.status);
    console.log('   Content-Type:', response.headers.get('content-type'));

    if (response.ok) {
      const data = await response.json();
      console.log('\n✅ API调用成功');
      console.log('   返回数据:', JSON.stringify(data, null, 2));

      if (data.success && data.data) {
        const statusData = data.data;
        console.log('\n📊 状态数据解析:');
        console.log('   状态:', statusData.status);
        console.log('   阶段:', statusData.stage);
        console.log('   进度:', statusData.progress);

        if (!statusData.progress || !statusData.progress.gpt4) {
          console.log('\n⚠️  警告: progress数据为空或缺少gpt4字段');
          console.log('   这就是为什么前端一直显示"正在连接服务器"');
        }
      }
    } else {
      const errorText = await response.text();
      console.log('\n❌ API调用失败');
      console.log('   错误:', errorText);
    }

  } catch (error) {
    console.error('❌ 错误:', error.message);
  } finally {
    await client.end();
  }
})();
