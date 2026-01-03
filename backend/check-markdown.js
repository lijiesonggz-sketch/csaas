const fs = require('fs');

const filePath = 'D:\\csaas\\backend\\debug-ai-responses\\1767384602709-error.json';

try {
  const content = fs.readFileSync(filePath, 'utf8');

  console.log('文件前500个字符:');
  console.log(content.substring(0, 500));
  console.log('\n文件包含```json吗?', content.includes('```json'));
  console.log('文件包含```吗?', content.includes('```'));

  // 检查是否有其他非JSON内容
  const lines = content.split('\n');
  console.log('\n前10行:');
  lines.slice(0, 10).forEach((line, i) => {
    console.log(`${i + 1}: ${line}`);
  });

  // 尝试直接解析
  console.log('\n尝试直接JSON.parse...');
  try {
    JSON.parse(content);
    console.log('✅ 直接解析成功');
  } catch (e) {
    console.log('❌ 直接解析失败:', e.message);

    // 尝试移除markdown后再解析
    console.log('\n尝试移除markdown标记...');
    let cleaned = content.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/, '').replace(/```\s*$/, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/, '').replace(/```\s*$/, '');
    }

    try {
      JSON.parse(cleaned);
      console.log('✅ 移除markdown后解析成功');
    } catch (e2) {
      console.log('❌ 移除markdown后仍然失败:', e2.message);
    }
  }

} catch (err) {
  console.error('错误:', err.message);
}
