/**
 * 检查当前正在运行的任务状态
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'csaas.db');
const db = new Database(dbPath);

console.log('🔍 检查当前任务状态\n');
console.log('=' .repeat(70));

// 查询最近的任务（包括正在运行和刚完成的）
const tasks = db.prepare(`
  SELECT id, type, status, createdAt, updatedAt, completedAt, input
  FROM ai_tasks
  WHERE type = 'standard_interpretation'
  ORDER BY createdAt DESC
  LIMIT 5
`).all();

console.log(`\n找到 ${tasks.length} 个最近的标准解读任务\n`);

tasks.forEach((task, index) => {
  console.log(`[${index + 1}] 任务ID: ${task.id}`);
  console.log(`    状态: ${task.status}`);
  console.log(`    创建时间: ${task.createdAt}`);
  console.log(`    更新时间: ${task.updatedAt}`);
  if (task.completedAt) {
    console.log(`    完成时间: ${task.completedAt}`);
  }

  // 解析input看是否使用两阶段模式
  if (task.input) {
    try {
      const input = JSON.parse(task.input);
      console.log(`    解读模式: ${input.interpretationMode || '未设置'}`);
      console.log(`    两阶段模式: ${input.useTwoPhaseMode ? '✅ 是' : '❌ 否'}`);
      if (input.batchSize) {
        console.log(`    批次大小: ${input.batchSize}`);
      }
    } catch (e) {
      console.log(`    解析input失败`);
    }
  }

  console.log('');
});

// 查看最新任务的详细信息
const latestTask = tasks[0];
if (latestTask) {
  console.log('=' .repeat(70));
  console.log('📊 最新任务详情');
  console.log('=' .repeat(70) + '\n');

  // 计算运行时间
  const created = new Date(latestTask.createdAt);
  const updated = new Date(latestTask.updatedAt);
  const now = new Date();
  const runningTime = Math.floor((now - created) / 1000); // 秒

  console.log(`任务ID: ${latestTask.id}`);
  console.log(`当前状态: ${latestTask.status}`);
  console.log(`已运行时间: ${runningTime}秒 (${Math.floor(runningTime / 60)}分${runningTime % 60}秒)`);
  console.log(`最后更新: ${updated.toLocaleString('zh-CN')}`);
  console.log('');

  // 根据状态给出建议
  if (latestTask.status === 'processing') {
    console.log('⏳ 任务正在处理中...');
    console.log('');
    console.log('💡 两阶段模式的正常处理时间:');
    console.log('   - 条款提取阶段: 1-2分钟');
    console.log('   - 批量解读阶段: 4-6分钟（取决于条款数量）');
    console.log('   - 总计: 5-8分钟');
    console.log('');
    console.log('如果超过10分钟还在运行，可能有问题，建议检查后端日志。');

    // 检查是否超时（超过10分钟）
    if (runningTime > 600) {
      console.log('');
      console.log('⚠️  警告：任务已运行超过10分钟，可能卡住了！');
      console.log('');
      console.log('建议操作:');
      console.log('  1. 检查后端终端是否有错误');
      console.log('  2. 查看后端日志输出');
      console.log('  3. 如果确实卡住，可以尝试重启后端');
    }
  } else if (latestTask.status === 'completed') {
    console.log('✅ 任务已完成');
    console.log('');
    console.log('建议检查生成结果是否包含所有条款。');
  } else if (latestTask.status === 'failed') {
    console.log('❌ 任务失败');
    console.log('');
    console.log('请查看后端日志了解失败原因。');
  }
}

db.close();

console.log('\n' + '=' .repeat(70));
