/**
 * 简化版诊断脚本：检查标准解读任务是否使用了两阶段模式
 * 不依赖better-sqlite3，直接读取和分析日志
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 分析最近的标准解读日志...\n');

// 读取最近的日志文件
const logFile = path.join(__dirname, 'combined.log');

if (!fs.existsSync(logFile)) {
  console.log('❌ 日志文件不存在: combined.log');
  console.log('💡 提示：请确保后端服务正在运行，并已生成日志文件');
  process.exit(1);
}

// 读取最后10000行日志
const logContent = fs.readFileSync(logFile, 'utf8');
const lines = logContent.split('\n').slice(-10000);

console.log(`读取了 ${lines.length} 行日志\n`);

// 查找两阶段模式相关的日志
const twoPhaseLogs = lines.filter(line =>
  line.includes('two-phase') ||
  line.includes('two phase') ||
  line.includes('两阶段') ||
  line.includes('batch interpretation') ||
  line.includes('generateBatchInterpretation')
);

if (twoPhaseLogs.length > 0) {
  console.log(`✅ 找到 ${twoPhaseLogs.length} 行两阶段模式相关的日志\n`);

  console.log('最近的两阶段模式日志：');
  twoPhaseLogs.slice(-10).forEach(log => {
    console.log('  ' + log);
  });
} else {
  console.log('❌ 未找到两阶段模式相关的日志');
  console.log('💡 这意味着最近的任务可能没有使用两阶段模式\n');
}

// 查找条款提取相关的日志
const extractionLogs = lines.filter(line =>
  line.includes('clause extraction') ||
  line.includes('条款提取') ||
  line.includes('extractClauses') ||
  line.includes('Starting clause extraction')
);

if (extractionLogs.length > 0) {
  console.log(`\n✅ 找到 ${extractionLogs.length} 行条款提取相关的日志\n`);

  console.log('最近的条款提取日志：');
  extractionLogs.slice(-15).forEach(log => {
    console.log('  ' + log);
  });
}

// 查找批量解读相关的日志
const batchLogs = lines.filter(line =>
  line.includes('[Batch Interpretation]') ||
  line.includes('Batch') ||
  line.includes('批次')
);

if (batchLogs.length > 0) {
  console.log(`\n✅ 找到 ${batchLogs.length} 行批量解读相关的日志\n`);

  console.log('最近的批量解读日志：');
  batchLogs.slice(-20).forEach(log => {
    console.log('  ' + log);
  });
}

// 查找覆盖率验证日志
const coverageLogs = lines.filter(line =>
  line.includes('Coverage validation') ||
  line.includes('覆盖率') ||
  line.includes('Missing') ||
  line.includes('missing clauses')
);

if (coverageLogs.length > 0) {
  console.log(`\n✅ 找到 ${coverageLogs.length} 行覆盖率验证相关的日志\n`);

  console.log('最近的覆盖率验证日志：');
  coverageLogs.slice(-10).forEach(log => {
    console.log('  ' + log);
  });
}

console.log('\n' + '='.repeat(60));
console.log('💡 诊断建议');
console.log('='.repeat(60) + '\n');

if (twoPhaseLogs.length === 0) {
  console.log('⚠️  未检测到两阶段模式的使用\n');
  console.log('可能的原因：');
  console.log('  1. 前端调用了 /standard-interpretation 端点（而非 /standard-interpretation/two-phase）');
  console.log('  2. 请求中没有设置 useTwoPhaseMode: true');
  console.log('  3. 日志文件被清空或轮转\n');
  console.log('解决方案：');
  console.log('  1. 确保前端调用两阶段端点：');
  console.log('     POST /api/ai-generation/standard-interpretation/two-phase');
  console.log('  2. 或在现有端点请求中添加：');
  console.log('     { "useTwoPhaseMode": true, "batchSize": 10 }\n');
} else if (extractionLogs.length > 0) {
  console.log('✅ 已检测到两阶段模式的使用\n');
  console.log('如果仍然缺失条款，可能的原因：');
  console.log('  1. 条款提取阶段AI遗漏了某些条款');
  console.log('  2. 覆盖率验证的正则表达式未能匹配到某些条款格式');
  console.log('  3. 条款补全失败（extractClauseText返回null）\n');
  console.log('建议：');
  console.log('  1. 检查上方的"条款提取日志"，看AI提取了多少条款');
  console.log('  2. 检查"覆盖率验证日志"，看是否检测到缺失条款');
  console.log('  3. 如果检测到缺失但补全失败，需要改进extractClauseText方法\n');
} else {
  console.log('⚠️  日志信息不足，无法确定问题原因\n');
  console.log('建议：');
  console.log('  1. 重新运行一次标准解读任务');
  console.log('  2. 运行此脚本再次检查日志');
  console.log('  3. 手动检查combined.log文件中的完整日志\n');
}

console.log('='.repeat(60));
