/**
 * 测试DOCX解析 - 检查mammoth是否保留编号
 */

const mammoth = require('mammoth');
const fs = require('fs');

async function testDocxParsing() {
  console.log('【DOCX解析测试】\n');
  console.log('说明：此脚本需要你的DOCX文件路径');
  console.log('请将你的"中国人民银行业务领域数据安全管理办法.docx"放到backend目录下\n');

  const docxPath = '中国人民银行业务领域数据安全管理办法.docx';

  if (!fs.existsSync(docxPath)) {
    console.log(`❌ 文件不存在: ${docxPath}`);
    console.log('\n请手动提供DOCX文件路径进行测试');
    return;
  }

  try {
    // 读取DOCX文件
    const arrayBuffer = fs.readFileSync(docxPath);

    // 方法1: extractRawText（当前使用的方法）
    console.log('=== 方法1: mammoth.extractRawText ===');
    const result1 = await mammoth.extractRawText({ arrayBuffer });
    const text1 = result1.value;

    // 统计条款数
    const matches1 = text1.match(/第[一二三四五六七八九十百千]+条/g) || [];
    const unique1 = [...new Set(matches1)];

    console.log(`总匹配: ${matches1.length}次`);
    console.log(`唯一条款: ${unique1.length}个`);
    console.log(`条款: ${unique1.slice(0, 20).join(', ')}${unique1.length > 20 ? '...' : ''}`);

    if (result1.messages.length > 0) {
      console.log(`\n警告信息:`);
      result1.messages.forEach(msg => console.log(`  - ${msg.message}`));
    }

    // 方法2: convertToHtml（保留更多格式）
    console.log('\n=== 方法2: mammoth.convertToHtml ===');
    const result2 = await mammoth.convertToHtml({ arrayBuffer });
    const html = result2.value;

    // 从HTML中提取文本
    const text2 = html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
    const matches2 = text2.match(/第[一二三四五六七八九十百千]+条/g) || [];
    const unique2 = [...new Set(matches2)];

    console.log(`从HTML提取文本后:`);
    console.log(`总匹配: ${matches2.length}次`);
    console.log(`唯一条款: ${unique2.length}个`);
    console.log(`条款: ${unique2.slice(0, 20).join(', ')}${unique2.length > 20 ? '...' : ''}`);

    // 方法3: 检查HTML中的列表/编号
    console.log('\n=== 方法3: 检查HTML中的列表元素 ===');
    const olMatches = html.match(/<ol[^>]*>/g) || [];
    const liMatches = html.match(/<li[^>]*>/g) || [];
    const pMatches = html.match(/<p[^>]*>/g) || [];

    console.log(`<ol>标签: ${olMatches.length}个`);
    console.log(`<li>标签: ${liMatches.length}个`);
    console.log(`<p>标签: ${pMatches.length}个`);

    // 检查是否有style相关的编号
    if (html.includes('mso-list') || html.includes('list-style')) {
      console.log('\n✅ HTML中发现Word列表样式标记');
    }

    // 显示第4-15条区域的HTML
    console.log('\n=== 检查第4-15条区域的HTML ===');
    const idx4 = html.indexOf('第四条');
    if (idx4 > -1) {
      const snippet = html.substring(idx4, Math.min(idx4 + 2000, html.length));
      console.log(snippet.substring(0, 500));
    }

  } catch (error) {
    console.error('测试失败:', error.message);
  }
}

testDocxParsing().catch(console.error);
