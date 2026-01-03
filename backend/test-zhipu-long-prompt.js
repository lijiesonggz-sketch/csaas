require('dotenv').config({ path: '.env.development' });
const OpenAI = require('openai');

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
  timeout: 360000, // 6分钟
  maxRetries: 0,
});

// 生成一个长prompt（模拟聚类任务）
const longPrompt = `
你是一个专业的文档聚类分析专家。请根据以下文档，将它们分成若干个主题相关的组。

文档列表：
${Array.from({ length: 10 }, (_, i) => `
文档${i + 1}:
标题: 测试文档${i + 1}
内容: ${'这是一段很长的文档内容。'.repeat(200)}
`).join('\n')}

请返回JSON格式的聚类结果，包含以下字段：
- clusters: 聚类列表
- summary: 总体摘要
`;

console.log('\n=== 测试智谱AI长文本处理 ===');
console.log(`Prompt长度: ${longPrompt.length} 字符`);
console.log(`模型: ${process.env.OPENAI_MODEL}`);
console.log(`Timeout: 360秒`);
console.log('\n开始调用...\n');

const startTime = Date.now();

client.chat.completions.create({
  model: process.env.OPENAI_MODEL,
  messages: [
    {
      role: 'user',
      content: longPrompt,
    }
  ],
  temperature: 0.7,
  max_tokens: 2000,
})
.then(response => {
  const duration = Date.now() - startTime;
  console.log(`✓ 成功！耗时: ${duration}ms (${(duration/1000).toFixed(1)}秒)`);
  console.log(`Tokens: ${response.usage.total_tokens}`);
  console.log(`响应长度: ${response.choices[0].message.content.length} 字符`);
})
.catch(error => {
  const duration = Date.now() - startTime;
  console.error(`✗ 失败！耗时: ${duration}ms (${(duration/1000).toFixed(1)}秒)`);
  console.error(`错误: ${error.message}`);
  if (error.code) console.error(`错误代码: ${error.code}`);
});
