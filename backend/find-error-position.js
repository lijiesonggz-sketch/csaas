const fs = require('fs');

const filePath = 'D:\\csaas\\backend\\debug-ai-responses\\1767384602709-error.json';

try {
  const content = fs.readFileSync(filePath, 'utf8');
  console.log('文件长度:', content.length, 'bytes');

  // 找到position 81的位置
  const targetPos = 81;

  if (content.length > targetPos) {
    console.log('\n错误位置 (position', targetPos, ') 附近内容:');
    const start = Math.max(0, targetPos - 60);
    const end = Math.min(content.length, targetPos + 40);
    const snippet = content.substring(start, end);

    console.log(snippet);
    console.log(' '.repeat(targetPos - start) + '^'); // 标记错误位置

    // 尝试解析JSON
    console.log('\n尝试解析JSON...');
    try {
      JSON.parse(content);
      console.log('✅ JSON解析成功！这不应该发生...');
    } catch (e) {
      console.log('❌ JSON解析失败:', e.message);
    }
  }

} catch (err) {
  console.error('错误:', err.message);
}
