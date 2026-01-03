const fs = require('fs');

const filePath = 'debug-ai-responses/1767386149780-error.json';
const content = fs.readFileSync(filePath, 'utf8');

console.log('文件前100个字符:');
console.log(content.substring(0, 100));
console.log('\n包含```json?', content.includes('```json'));
console.log('包含```吗?', content.includes('```'));
console.log('\n后100个字符:');
console.log(content.substring(content.length - 100));

// 尝试按照代码中的逻辑处理
console.log('\n\n模拟代码处理流程:');

// 步骤1: 移除markdown标记
let cleanedContent = content.trim();
if (cleanedContent.startsWith('```json')) {
  cleanedContent = cleanedContent.replace(/^```json\s*/, '').replace(/```\s*$/, '');
  console.log('步骤1 - 移除```json标记');
} else if (cleanedContent.startsWith('```')) {
  cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/```\s*$/, '');
  console.log('步骤1 - 移除```标记');
} else {
  console.log('步骤1 - 无markdown标记');
}

// 步骤2: fixJSON处理
function fixJSON(jsonString) {
  let fixed = jsonString;
  fixed = fixed.replace(/^\uFEFF/, '');
  fixed = fixed.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
  fixed = fixed.replace(/'([^']*)'/g, '"$1"');
  fixed = fixed.replace(/\/\/.*$/gm, '');
  fixed = fixed.replace(/\/\*[\s\S]*?\*\//g, '');
  fixed = fixed.replace(/,\s*([}\]])/g, '$1');
  fixed = fixed.replace(/\:\s*(true|false|null)\s*([,}])/g, ': $1$2');
  return fixed;
}

const fixedContent = fixJSON(cleanedContent);
console.log('步骤2 - fixJSON处理完成');

// 步骤3: 尝试解析
try {
  const parsed = JSON.parse(fixedContent);
  console.log('步骤3 - ✅ JSON.parse成功!');
  console.log('解析到', parsed.measures.length, '个措施');
} catch(e) {
  console.log('步骤3 - ❌ JSON.parse失败:', e.message);

  // 步骤4: 尝试JSON5
  try {
    const JSON5 = require('json5');
    const parsed5 = JSON5.parse(fixedContent);
    console.log('步骤4 - ✅ JSON5.parse成功!');
    console.log('解析到', parsed5.measures.length, '个措施');
  } catch(e2) {
    console.log('步骤4 - ❌ JSON5也失败:', e2.message);
  }
}
