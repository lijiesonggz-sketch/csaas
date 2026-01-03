const OpenAI = require('openai');

async function testZhipu() {
  const client = new OpenAI({
    apiKey: 'c047b612d64c4663bdce563fdf05aec0.poaOCXh3RU3Yr6to',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4/',
    timeout: 60000,
  });

  const testCases = [
    {
      name: '简单测试',
      prompt: '请回答：1+1等于几？只需回答数字。',
    },
    {
      name: 'JSON格式测试',
      prompt: '请用JSON格式回答：{"answer": "2"}。只需返回JSON，不要其他内容。',
    },
    {
      name: '较长prompt测试',
      prompt: `
你是一个成熟度分析专家。请根据以下信息生成改进措施。

聚类名称: 数据管理
当前级别: 2
目标级别: 4
差距: 2

问题详情:
- 问题1: 我们的数据管理流程混乱，缺少统一的数据标准。得分: 2
- 问题2: 数据质量管理不足，经常出现数据错误。得分: 2.5

请生成3-5条改进措施，以JSON格式返回，包含以下字段：
- title: 措施标题
- description: 措施描述
- implementation_steps: 实施步骤

返回格式: {"measures": [...]}
      `.trim(),
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n=== ${testCase.name} ===`);
    console.log('Prompt 长度:', testCase.prompt.length);

    try {
      const response = await client.chat.completions.create({
        model: 'glm-4.7',
        messages: [{ role: 'user', content: testCase.prompt }],
        max_tokens: 2000,
        temperature: 0.7,
      });

      console.log('✅ 成功');
      console.log('Model:', response.model);
      console.log('Content Length:', response.choices[0].message.content?.length || 0);
      console.log('Content:', response.choices[0].message.content?.substring(0, 200) || '(空)');
      console.log('Usage:', JSON.stringify(response.usage));

      if (!response.choices[0].message.content) {
        console.log('⚠️  警告: 内容为空!');
      }
    } catch (error) {
      console.log('❌ 失败:', error.message);
      if (error.response) {
        console.log('Response:', JSON.stringify(error.response.data, null, 2));
      }
    }
  }
}

testZhipu().catch(console.error);
