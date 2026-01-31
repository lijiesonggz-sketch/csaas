/**
 * 测试合规雷达文件导入功能
 *
 * Story 4.1: 测试文件导入 - 处罚通报和政策征求意见
 */

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

console.log('🧪 测试合规雷达文件导入功能\n');

// 测试文件1: 处罚通报
const penaltyFilePath = path.join(__dirname, 'data-import', 'website-crawl', 'compliance-penalty-example.md');
console.log('📄 测试文件1: 处罚通报');
console.log(`   路径: ${penaltyFilePath}`);

if (fs.existsSync(penaltyFilePath)) {
  const penaltyContent = fs.readFileSync(penaltyFilePath, 'utf-8');
  const penaltyData = matter(penaltyContent);

  console.log('   ✅ 文件存在');
  console.log('   📋 Frontmatter:');
  console.log(`      - source: ${penaltyData.data.source}`);
  console.log(`      - category: ${penaltyData.data.category}`);
  console.log(`      - type: ${penaltyData.data.type}`);
  console.log(`      - url: ${penaltyData.data.url}`);
  console.log(`      - publishDate: ${penaltyData.data.publishDate}`);
  console.log(`      - penaltyInstitution: ${penaltyData.data.penaltyInstitution}`);
  console.log(`      - penaltyAmount: ${penaltyData.data.penaltyAmount}`);
  console.log(`      - penaltyDate: ${penaltyData.data.penaltyDate}`);
  console.log(`      - policyBasis: ${penaltyData.data.policyBasis}`);

  console.log('   📝 正文长度:', penaltyData.content.length, '字符');
  console.log('   📝 正文摘要:', penaltyData.content.substring(0, 100) + '...');
} else {
  console.log('   ❌ 文件不存在');
}

console.log('\n');

// 测试文件2: 政策征求意见
const policyFilePath = path.join(__dirname, 'data-import', 'website-crawl', 'compliance-policy-example.md');
console.log('📄 测试文件2: 政策征求意见');
console.log(`   路径: ${policyFilePath}`);

if (fs.existsSync(policyFilePath)) {
  const policyContent = fs.readFileSync(policyFilePath, 'utf-8');
  const policyData = matter(policyContent);

  console.log('   ✅ 文件存在');
  console.log('   📋 Frontmatter:');
  console.log(`      - source: ${policyData.data.source}`);
  console.log(`      - category: ${policyData.data.category}`);
  console.log(`      - type: ${policyData.data.type}`);
  console.log(`      - url: ${policyData.data.url}`);
  console.log(`      - publishDate: ${policyData.data.publishDate}`);
  console.log(`      - commentDeadline: ${policyData.data.commentDeadline}`);
  console.log(`      - policyTitle: ${policyData.data.policyTitle}`);

  console.log('   📝 正文长度:', policyData.content.length, '字符');
  console.log('   📝 正文摘要:', policyData.content.substring(0, 100) + '...');
} else {
  console.log('   ❌ 文件不存在');
}

console.log('\n');

// 验证字段完整性
console.log('✅ 字段完整性检查:');
console.log('   处罚通报必需字段:');
const penaltyRequiredFields = ['source', 'category', 'type', 'url', 'publishDate', 'penaltyInstitution', 'penaltyAmount', 'penaltyDate', 'policyBasis'];
const penaltyContent = fs.readFileSync(penaltyFilePath, 'utf-8');
const penaltyData = matter(penaltyContent);

let penaltyValid = true;
penaltyRequiredFields.forEach(field => {
  const present = penaltyData.data.hasOwnProperty(field);
  console.log(`      - ${field}: ${present ? '✅' : '❌'}`);
  if (!present) penaltyValid = false;
});

console.log('\n   政策征求意见必需字段:');
const policyRequiredFields = ['source', 'category', 'type', 'url', 'publishDate', 'commentDeadline', 'policyTitle'];
const policyContent2 = fs.readFileSync(policyFilePath, 'utf-8');
const policyData2 = matter(policyContent2);

let policyValid = true;
policyRequiredFields.forEach(field => {
  const present = policyData2.data.hasOwnProperty(field);
  console.log(`      - ${field}: ${present ? '✅' : '❌'}`);
  if (!present) policyValid = false;
});

console.log('\n📊 总结:');
console.log(`   处罚通报文件: ${penaltyValid ? '✅ 格式正确' : '❌ 缺少字段'}`);
console.log(`   政策征求意见文件: ${policyValid ? '✅ 格式正确' : '❌ 缺少字段'}`);
console.log(`   ${penaltyValid && policyValid ? '\n🎉 所有测试文件格式正确，可以导入！' : '\n⚠️  请修复缺失的字段'}`);
