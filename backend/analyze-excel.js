const XLSX = require('xlsx');
const fs = require('fs');

try {
  const workbook = XLSX.readFile('D:\\csaas\\成熟度改进措施计划_2025-12-31.xlsx');

  console.log('📊 Excel文件结构分析:\n');

  // 列出所有Sheet
  console.log('Sheet列表:');
  workbook.SheetNames.forEach((name, index) => {
    console.log(`  ${index + 1}. ${name}`);
  });

  console.log('\n总Sheet数:', workbook.SheetNames.length);

  // 分析每个Sheet的结构
  workbook.SheetNames.forEach((sheetName, index) => {
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    console.log(`\n${'='.repeat(80)}`);
    console.log(`Sheet ${index + 1}: ${sheetName}`);
    console.log(`${'='.repeat(80)}`);
    console.log('行数:', data.length);
    console.log('列数:', data[0] ? data[0].length : 0);

    if (data.length > 0) {
      console.log('\n表头:');
      console.log(data[0].map((h, i) => `${i + 1}. ${h}`).join('\n'));

      console.log('\n前3行数据预览:');
      data.slice(0, Math.min(3, data.length)).forEach((row, i) => {
        console.log(`\n第${i + 1}行:`);
        console.log(JSON.stringify(row, null, 2));
      });
    }
  });

} catch (err) {
  console.error('错误:', err.message);
  console.log('\n尝试安装 xlsx 库...');
}
