// 直接从debug文件分析标准条款
const fs = require('fs');

const content = fs.readFileSync('debug-interpretation-1768711120824.txt', 'utf-8');

// 提取标准内容（从"ICS 35"开始到"**重要约束**"之前）
const startIdx = content.indexOf('ICS 35');
const endIdx = content.indexOf('**重要约束**');

if (startIdx === -1 || endIdx === -1) {
  console.log('Cannot find standard content in debug file');
  process.exit(1);
}

const standardContent = content.substring(startIdx, endIdx);

console.log('=== GBT 43208.1-2023 条款分析 ===\n');
console.log('标准内容长度:', standardContent.length, '字符\n');

// 统计各种格式的条款
const patterns = {
  '二级编号 (4.1, 5.2)': /\b\d+\.\d+\b/g,
  '三级编号 (4.2.1)': /\b\d+\.\d+\.\d+\b/g,
};

const allClauses = new Set();

for (const [name, pattern] of Object.entries(patterns)) {
  const matches = standardContent.match(pattern) || [];
  const unique = Array.from(new Set(matches));
  console.log(`${name}:`);
  console.log(`  匹配次数: ${matches.length}`);
  console.log(`  唯一条款: ${unique.length}\n`);

  unique.forEach(id => allClauses.add(id));
}

// 按章节组织显示
console.log('=== 按章节分组的条款 ===\n');

const chapterGroups = {};
allClauses.forEach(clause => {
  const match = clause.match(/^(\d+)\./);
  if (match) {
    const chapter = match[1];
    if (!chapterGroups[chapter]) {
      chapterGroups[chapter] = [];
    }
    chapterGroups[chapter].push(clause);
  }
});

const sortedChapters = Object.keys(chapterGroups).sort((a, b) => parseInt(a) - parseInt(b));
sortedChapters.forEach(chapter => {
  const clauses = chapterGroups[chapter].sort();
  console.log(`第${chapter}章: ${clauses.length}个条款`);
  if (clauses.length <= 20) {
    console.log(`  ${clauses.join(', ')}`);
  } else {
    console.log(`  ${clauses.slice(0, 15).join(', ')}...`);
  }
  console.log('');
});

console.log('=== 总结 ===');
console.log(`唯一条款总数: ${allClauses.size}`);
console.log('\n所有唯一条款:');
Array.from(allClauses).sort().forEach((clause, i) => {
  console.log(`  ${i + 1}. ${clause}`);
});

console.log('\n=== 问题诊断 ===');
console.log(`❌ 标准实际有 ${allClauses.size} 个条款，但AI只提取了12个条款！`);
console.log(`缺失条款数: ${allClauses.size - 12}`);
