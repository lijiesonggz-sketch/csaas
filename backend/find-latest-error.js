const fs = require('fs');
const path = require('path');

const dir = 'D:\\csaas\\backend\\debug-ai-responses';

try {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

  // 按修改时间排序
  const sortedFiles = files.map(f => {
    const filePath = path.join(dir, f);
    const stats = fs.statSync(filePath);
    return {
      name: f,
      path: filePath,
      time: stats.mtime,
      size: stats.size
    };
  }).sort((a, b) => b.time - a.time);

  if (sortedFiles.length > 0) {
    const latest = sortedFiles[0];
    console.log('最新错误文件:');
    console.log('  文件名:', latest.name);
    console.log('  时间:', latest.time.toISOString());
    console.log('  大小:', latest.size, 'bytes');

    // 读取前200个字符
    const content = fs.readFileSync(latest.path, 'utf8');
    console.log('\n前200个字符:');
    console.log(content.substring(0, 200));

    // 检查position 81附近
    if (content.length > 81) {
      console.log('\n错误位置 (position 81) 附近:');
      const start = Math.max(0, 81 - 50);
      const end = Math.min(content.length, 81 + 50);
      console.log(content.substring(start, end));
      console.log(' '.repeat(81 - start) + '^'); // 标记错误位置
    }
  } else {
    console.log('没有找到错误文件');
  }
} catch (err) {
  console.error('错误:', err.message);
}
