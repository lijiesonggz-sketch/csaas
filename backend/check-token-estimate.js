// 估算token数量
// 中文：大约1字符 = 1-1.5 tokens
// 英文：大约4字符 = 1 token

const contentLength = 66749
const chineseRatio = 0.9 // 假设90%是中文

const estimatedTokens = contentLength * chineseRatio * 1.3 + contentLength * (1 - chineseRatio) * 0.25

console.log('=== Token 估算 ===')
console.log('文档内容长度:', contentLength, '字符')
console.log('估算输入tokens:', Math.round(estimatedTokens))
console.log('\n=== 模型限制 ===')
console.log('GPT-4: 128K tokens')
console.log('Claude: 200K tokens')
console.log('通义千问: 30K-150K tokens（取决于版本）')
console.log('\n=== 建议 ===')
console.log('对于企业模式，完整66749字符文档大约需要', Math.round(estimatedTokens), '输入tokens')
console.log('预留40000 tokens用于输出')
console.log('总计需求: ~', Math.round(estimatedTokens + 40000), 'tokens')
console.log('\n结论: GPT-4和Claude应该能处理，通义千问可能需要截取')
