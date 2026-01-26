/**
 * 诊断脚本：检查标准解读任务是否使用了两阶段模式
 * 分析为什么仍然缺失条款4.2、5.1、6.1
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'csaas.db');
const db = new Database(dbPath);

console.log('🔍 诊断标准解读任务...\n');

// 查询最近的任务
const tasks = db.prepare(`
  SELECT id, type, status, createdAt, input, result
  FROM ai_tasks
  WHERE type = 'standard_interpretation'
  ORDER BY createdAt DESC
  LIMIT 5
`).all();

console.log(`找到 ${tasks.length} 个最近的任务\n`);

tasks.forEach((task, index) => {
  console.log(`[${index + 1}] 任务ID: ${task.id}`);
  console.log(`    状态: ${task.status}`);
  console.log(`    创建时间: ${task.createdAt}`);

  // 解析input查看是否使用两阶段模式
  if (task.input) {
    try {
      const input = JSON.parse(task.input);
      console.log(`    使用两阶段模式: ${input.useTwoPhaseMode ? '✅ 是' : '❌ 否'}`);

      if (input.batchSize) {
        console.log(`    批次大小: ${input.batchSize}`);
      }
    } catch (e) {
      console.log(`    解析input失败: ${e.message}`);
    }
  }

  // 解析result查看生成的条款数量
  if (task.result) {
    try {
      const result = JSON.parse(task.result);

      if (result.selectedResult && result.selectedResult.key_requirements) {
        const count = result.selectedResult.key_requirements.length;
        console.log(`    生成条款数: ${count}`);

        // 检查是否包含4.2、5.1、6.1
        const clauseIds = result.selectedResult.key_requirements.map(req => req.clause_id);

        const missing42 = !clauseIds.includes('4.2');
        const missing51 = !clauseIds.includes('5.1');
        const missing61 = !clauseIds.includes('6.1');

        if (missing42 || missing51 || missing61) {
          console.log(`    ❌ 缺失条款: ${missing42 ? '4.2 ' : ''}${missing51 ? '5.1 ' : ''}${missing61 ? '6.1' : ''}`);
        } else {
          console.log(`    ✅ 包含所有目标条款`);
        }
      }
    } catch (e) {
      console.log(`    解析result失败: ${e.message}`);
    }
  }

  console.log('');
});

// 分析最最近的任务的详细情况
const latestTask = tasks[0];
if (latestTask) {
  console.log('=' .repeat(60));
  console.log('详细分析最近的任务');
  console.log('=' .repeat(60) + '\n');

  if (latestTask.input) {
    try {
      const input = JSON.parse(latestTask.input);

      if (input.standardDocument && input.standardDocument.content) {
        const content = input.standardDocument.content;

        // 使用正则表达式统计文档中的条款
        const patterns = {
          '中文条款 (第四条)': /第[一二三四五六七八九十百千]+条/g,
          '数字条款 (第4条)': /\b第\d+条/g,
          '三级编号 (4.2.1)': /\b\d+\.\d+\.\d+\b/g,
          '二级编号 (4.2)': /\b\d+\.\d+\b/g,
        };

        console.log('📊 正则表达式统计文档中的条款：\n');

        const allMatches = new Set();

        Object.entries(patterns).forEach(([name, pattern]) => {
          const matches = content.match(pattern) || [];
          const unique = [...new Set(matches)];
          console.log(`  ${name}:`);
          console.log(`    匹配次数: ${matches.length}`);
          console.log(`    唯一数量: ${unique.length}`);

          if (unique.length > 0 && unique.length <= 20) {
            console.log(`    示例: ${unique.slice(0, 10).join(', ')}${unique.length > 10 ? '...' : ''}`);
          }

          unique.forEach(m => allMatches.add(m.trim()));
          console.log('');
        });

        console.log(`  📌 文档中总计唯一条款ID: ${allMatches.size}个\n`);

        // 检查是否包含4.2、5.1、6.1
        const has42 = allMatches.has('4.2');
        const has51 = allMatches.has('5.1');
        const has61 = allMatches.has('6.1');

        console.log('🎯 目标条款检查：');
        console.log(`  4.2: ${has42 ? '✅ 存在于文档' : '❌ 文档中未找到'}`);
        console.log(`  5.1: ${has51 ? '✅ 存在于文档' : '❌ 文档中未找到'}`);
        console.log(`  6.1: ${has61 ? '✅ 存在于文档' : '❌ 文档中未找到'}`);
        console.log('');
      }

      // 检查是否使用两阶段模式
      if (!input.useTwoPhaseMode) {
        console.log('⚠️  警告：该任务未使用两阶段模式！');
        console.log('');
        console.log('💡 建议：');
        console.log('  1. 确保前端调用 /standard-interpretation/two-phase 端点');
        console.log('  2. 或在请求中设置 useTwoPhaseMode: true');
        console.log('  3. 两阶段模式可以确保100%条款覆盖率');
        console.log('');
      }
    } catch (e) {
      console.log(`分析失败: ${e.message}`);
    }
  }
}

db.close();

console.log('=' .repeat(60));
console.log('诊断完成');
console.log('=' .repeat(60));
