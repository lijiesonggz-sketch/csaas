const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'csaas.db');
const db = new Database(dbPath);

console.log('🔍 分析最近的标准解读任务...\n');

const tasks = db.prepare(`
  SELECT id, type, status, createdAt, input, result
  FROM ai_tasks
  WHERE type = 'standard_interpretation'
  ORDER BY createdAt DESC
  LIMIT 3
`).all();

console.log(`找到 ${tasks.length} 个最近的任务\n`);

tasks.forEach((task, index) => {
  console.log(`[${index + 1}] 任务ID: ${task.id}`);
  console.log(`    状态: ${task.status}`);
  console.log(`    创建时间: ${task.createdAt}`);

  if (task.input) {
    try {
      const input = JSON.parse(task.input);
      console.log(`    使用两阶段模式: ${input.useTwoPhaseMode ? '✅ 是' : '❌ 否'}`);
    } catch (e) {}
  }

  if (task.result) {
    try {
      const result = JSON.parse(task.result);
      if (result.selectedResult && result.selectedResult.key_requirements) {
        const count = result.selectedResult.key_requirements.length;
        console.log(`    生成条款数: ${count}`);

        const clauseIds = result.selectedResult.key_requirements.map(req => req.clause_id).sort();
        console.log(`    条款编号: ${clauseIds.slice(0, 15).join(', ')}${clauseIds.length > 15 ? '...' : ''}`);
      }
    } catch (e) {}
  }
  console.log('');
});

const recentTask = tasks[0];
if (recentTask && recentTask.result) {
  try {
    const result = JSON.parse(recentTask.result);
    if (result.selectedResult && result.selectedResult.key_requirements) {
      const clauseIds = result.selectedResult.key_requirements.map(req => req.clause_id);

      console.log('已生成的条款编号：');
      clauseIds.sort().forEach(id => console.log('  - ' + id));

      const patterns = {
        '数字+数字': clauseIds.filter(id => /^\d+\.\d+$/.test(id)),
        '数字+数字+数字': clauseIds.filter(id => /^\d+\.\d+\.\d+$/.test(id)),
        '中文': clauseIds.filter(id => /第.*条/.test(id)),
        '其他': clauseIds.filter(id => !/^\d+\./.test(id) && !/第.*条/.test(id))
      };

      console.log('\n条款编号分布：');
      Object.entries(patterns).forEach(([pattern, ids]) => {
        if (ids.length > 0) {
          console.log(`  ${pattern}: ${ids.length}个`);
        }
      });

      console.log('\n❓ 可能遗漏的条款编号：');
      console.log('  4.2 (二级编号)');
      console.log('  5.1 (二级编号)');
      console.log('  6.1 (二级编号)');
    }
  } catch (e) {}
}

db.close();
