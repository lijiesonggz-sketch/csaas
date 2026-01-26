/**
 * 诊断聚类进度显示问题
 * 检查最新的聚类任务和API响应
 */

const { Client } = require('pg');

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

    console.log('🔍 诊断聚类进度显示问题\n');

    // 1. 获取最新的聚类任务
    const result = await client.query(
      "SELECT id, status, generation_stage, progress_details, created_at FROM ai_tasks WHERE type = 'clustering' ORDER BY created_at DESC LIMIT 1"
    );

    if (result.rows.length === 0) {
      console.log('❌ 未找到聚类任务');
      process.exit(1);
    }

    const task = result.rows[0];
    console.log('📋 最新聚类任务信息:');
    console.log('   任务ID:', task.id);
    console.log('   状态:', task.status);
    console.log('   阶段:', task.generation_stage);
    console.log('   创建时间:', task.created_at.toISOString());
    console.log('   进度详情:', JSON.stringify(task.progress_details, null, 2));

    // 2. 检查进度详情是否为空
    if (!task.progress_details || Object.keys(task.progress_details).length === 0) {
      console.log('\n❌ 问题确认: progress_details 为空');
      console.log('   这就是前端一直显示"正在连接服务器"的原因');
      console.log('\n💡 解决方案: 需要创建新的聚类任务来测试修复');
    } else {
      console.log('\n✅ progress_details 有数据');
      console.log('   应该能正常显示进度');
    }

    // 3. 测试status API
    console.log('\n🌐 测试 status API...');
    try {
      const response = await fetch(`http://localhost:3000/ai-tasks/${task.id}/status`);

      console.log('   HTTP状态:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('\n✅ API调用成功');
        console.log('   返回数据:', JSON.stringify(data, null, 2));

        // 检查返回的progress字段
        if (data.data && data.data.progress) {
          const hasModelProgress = data.data.progress.gpt4 || data.data.progress.claude || data.data.progress.domestic;

          console.log('\n📊 进度数据分析:');
          if (hasModelProgress) {
            console.log('   ✅ 包含模型进度数据');
            if (data.data.progress.gpt4) {
              console.log('      - GPT-4:', data.data.progress.gpt4.status, data.data.progress.gpt4.message);
            }
            if (data.data.progress.domestic) {
              console.log('      - Qwen:', data.data.progress.domestic.status, data.data.progress.domestic.message);
            }
            console.log('\n   前端应该能正常显示进度！');
          } else {
            console.log('   ❌ 缺少模型进度数据 (gpt4/claude/domestic)');
            console.log('   这就是前端显示"正在连接服务器"的原因');
          }
        } else {
          console.log('\n❌ API返回的progress字段为空');
        }
      } else {
        const errorText = await response.text();
        console.log('\n❌ API调用失败');
        console.log('   错误:', errorText);
      }
    } catch (error) {
      console.log('\n❌ API请求异常:', error.message);
    }

    // 4. 给出诊断结论
    console.log('\n' + '='.repeat(60));
    console.log('📝 诊断结论:');
    console.log('='.repeat(60));

    if (task.status === 'processing' && (!task.progress_details || Object.keys(task.progress_details).length === 0)) {
      console.log('❌ 任务卡在 processing 状态，但 progress_details 为空');
      console.log('💡 建议: 这个任务已经卡住，需要创建新任务');
    } else if (task.status === 'completed' && (!task.progress_details || Object.keys(task.progress_details).length === 0)) {
      console.log('❌ 任务已完成，但 progress_details 为空（老任务）');
      console.log('💡 建议: 这是修复前的老任务，需要创建新任务才能看到修复效果');
    } else if (task.progress_details && Object.keys(task.progress_details).length > 0) {
      console.log('✅ progress_details 有数据，修复已生效');
      console.log('💡 建议: 如果前端还是卡住，请检查:');
      console.log('   1. 是否刷新了页面');
      console.log('   2. 浏览器控制台是否有错误');
      console.log('   3. 是否在查看最新的任务');
    }

    console.log('\n📌 操作建议:');
    console.log('   1. 在前端创建新的聚类任务');
    console.log('   2. 观察进度是否正常显示');
    console.log('   3. 如果还有问题，复制浏览器控制台的Network响应给我');

  } catch (error) {
    console.error('❌ 诊断失败:', error.message);
  } finally {
    await client.end();
  }
})();
