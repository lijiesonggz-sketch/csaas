const fs = require('fs');

const filePath = 'debug-ai-responses/1767386149780-error.json';
const content = fs.readFileSync(filePath, 'utf8');

// 新的fixJSON函数（包含单引号修复）
function fixJSON(jsonString) {
  let fixed = jsonString;

  // 1. 移除BOM标记
  fixed = fixed.replace(/^\uFEFF/, '');

  // 2. 处理双引号字符串内部的单引号（防止破坏JSON结构）
  fixed = fixed.replace(/"([^"]*)"/g, (match, content) => {
    return '"' + content.replace(/'/g, '') + '"';
  });

  // 3. 修复未加引号的属性名
  fixed = fixed.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

  // 4. 修复单引号字符串
  fixed = fixed.replace(/'([^']*)'/g, '"$1"');

  // 5. 移除注释
  fixed = fixed.replace(/\/\/.*$/gm, '');
  fixed = fixed.replace(/\/\*[\s\S]*?\*\//g, '');

  // 6. 修复尾随逗号
  fixed = fixed.replace(/,\s*([}\]])/g, '$1');

  // 7. 修复未引用的布尔值和null
  fixed = fixed.replace(/\:\s*(true|false|null)\s*([,}])/g, ': $1$2');

  return fixed;
}

console.log('原始内容前150字符:');
console.log(content.substring(0, 150));

const fixed = fixJSON(content);

console.log('\n修复后前150字符:');
console.log(fixed.substring(0, 150));

// 尝试解析
try {
  const parsed = JSON.parse(fixed);
  console.log('\n✅ JSON.parse成功!');
  console.log('解析到', parsed.measures.length, '个措施');

  // 验证description字段
  console.log('\n第一个措施的description:');
  console.log(parsed.measures[0].description);
} catch(e) {
  console.log('\n❌ JSON.parse失败:', e.message);
  const match = e.message.match(/position (\d+)/);
  if (match) {
    const pos = parseInt(match[1]);
    console.log('错误位置附近:', JSON.stringify(fixed.substring(Math.max(0, pos - 50), pos + 50)));
  }
}
