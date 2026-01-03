const fs = require('fs');
const path = require('path');

const dir = 'D:\\csaas\\backend\\debug-ai-responses';

try {
  const files = fs.readdirSync(dir);

  // Filter for 2025-12-30 files (timestamp starts with 1765555200000 which is Dec 30, 2025)
  const dec30Files = files.filter(f => {
    const filePath = path.join(dir, f);
    const stats = fs.statSync(filePath);
    const date = new Date(stats.mtime);
    return date.toISOString().startsWith('2025-12-30');
  });

  console.log('找到2025-12-30的AI响应文件数:', dec30Files.length);
  console.log('\n文件列表:');

  dec30Files.forEach(file => {
    const filePath = path.join(dir, file);
    const stats = fs.statSync(filePath);
    console.log(`- ${file}`);
    console.log(`  大小: ${stats.size} bytes`);
    console.log(`  时间: ${stats.mtime}`);
  });

  // 找最早的文件（成功任务开始于01:20:07）
  console.log('\n\n检查最早的文件（应该对应成功任务）:');
  const sortedFiles = dec30Files
    .map(f => ({
      name: f,
      path: path.join(dir, f),
      time: fs.statSync(path.join(dir, f)).mtime
    }))
    .sort((a, b) => a.time - b.time);

  if (sortedFiles.length > 0) {
    const firstFile = sortedFiles[0];
    console.log(`文件: ${firstFile.name}`);
    console.log(`时间: ${firstFile.time}`);

    // 读取前500个字符
    const content = fs.readFileSync(firstFile.path, 'utf8');
    console.log('\n前500个字符:');
    console.log(content.substring(0, 500));
  }

} catch (err) {
  console.error('错误:', err.message);
}
