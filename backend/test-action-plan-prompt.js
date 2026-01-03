const OpenAI = require('openai');

async function testActionPlanPrompt() {
  const client = new OpenAI({
    apiKey: 'c047b612d64c4663bdce563fdf05aec0.poaOCXh3RU3Yr6to',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4/',
    timeout: 120000,
  });

  // 简化的测试 prompt
  const prompt = `你是一名资深数据安全治理专家,专注于帮助企业提升数据安全成熟度。请基于以下聚类的差距分析,生成具体、可执行的改进措施。

**聚类信息**:
- 聚类名称: 数据管理
- 聚类ID: cluster_1
- 当前成熟度: 2.00 分
- 目标成熟度: 4.0 分
- 成熟度差距: 2.00 分
- 改进优先级: high (高优先级，需要快速改进)
- 需要生成措施数量: 2 条

**该聚类下的问题得分情况**:
1. 您的组织是否建立了数据分类分级体系？
   选择: 否，没有建立任何分类分级制度
   得分: 1/5 (Level 1)

2. 组织是否对重要数据进行了标识和标记？
   选择: 部分数据有简单标识，但不够系统
   得分: 2/5 (Level 2)

---

**输出要求**:

请严格按照以下JSON格式输出 **2条** 改进措施:

{
  "measures": [
    {
      "title": "措施标题（简明扼要，15字以内）",
      "description": "措施的详细描述，说明为什么需要这项措施、它将解决什么问题（80-150字）",
      "implementation_steps": [
        {
          "stepNumber": 1,
          "title": "步骤标题",
          "description": "详细说明该步骤的具体操作和注意事项（50-100字）",
          "duration": "预计耗时（如：2周、1个月）"
        }
      ],
      "timeline": "总体时间线（如：3-6个月、短期内、1年）",
      "responsible_department": "负责部门（如：数据安全部、IT部门、法务部）",
      "expected_improvement": 1.0,
      "resources_needed": {
        "budget": "预算估算（如：20-30万元、中等投入）",
        "personnel": ["所需人员1"],
        "technology": ["所需技术/工具1"],
        "training": "培训需求描述"
      },
      "dependencies": {
        "prerequisiteMeasures": [],
        "externalDependencies": ["外部依赖1"]
      },
      "risks": [
        {
          "risk": "潜在风险描述",
          "mitigation": "风险缓解措施"
        }
      ],
      "kpi_metrics": [
        {
          "metric": "KPI指标名称",
          "target": "目标值（如：90%、<2小时）",
          "measurementMethod": "测量方法"
        }
      ]
    }
  ]
}

**重要提示**:
1. **严格按照JSON格式输出**,不要添加markdown代码块标记(如\`\`\`json或\`\`\`)
2. **不要添加任何注释、说明文字或额外内容**,只输出纯JSON对象
3. 确保所有字符串用双引号包裹,不要使用单引号
4. 确保生成 **2条** 措施
5. 每条措施必须包含3-5个implementation_steps
6. expected_improvement的总和应接近差距值(2.00)
7. 措施之间要有逻辑顺序,基础措施排在前面,高级措施排在后面
8. 确保JSON格式完全合法,不要有尾随逗号、未引号的属性名等常见错误

现在请开始生成 **2条** 改进措施,输出纯JSON(不要有任何其他文字):`;

  console.log('发送测试请求到智谱AI...\n');

  try {
    const response = await client.chat.completions.create({
      model: 'glm-4.7',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 8000,
      temperature: 0.7,
    });

    const content = response.choices[0].message.content;
    console.log('=== AI 原始响应 ===');
    console.log(content);
    console.log('\n=== 响应长度 ===');
    console.log(content.length, '字符');

    // 尝试解析JSON
    console.log('\n=== 尝试解析 JSON ===');
    let cleanedContent = content.trim();

    if (cleanedContent.startsWith('```json')) {
      cleanedContent = cleanedContent.replace(/^```json\s*/, '').replace(/```\s*$/, '');
    } else if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/```\s*$/, '');
    }

    console.log('清理后内容长度:', cleanedContent.length);
    console.log('前200个字符:', cleanedContent.substring(0, 200));

    try {
      const parsed = JSON.parse(cleanedContent);
      console.log('\n✅ JSON 解析成功!');
      console.log('生成措施数量:', parsed.measures?.length || 0);
    } catch (jsonError) {
      console.log('\n❌ JSON 解析失败:', jsonError.message);
      console.log('错误位置:', jsonError.message);

      // 找到错误位置附近的内容
      const match = jsonError.message.match(/position (\d+)/);
      if (match) {
        const pos = parseInt(match[1]);
        const start = Math.max(0, pos - 100);
        const end = Math.min(cleanedContent.length, pos + 100);
        console.log('\n错误位置附近的内容:');
        console.log(cleanedContent.substring(start, end));
        console.log(' '.repeat(pos - start) + '^ 错误位置');
      }
    }

  } catch (error) {
    console.error('请求失败:', error.message);
  }
}

testActionPlanPrompt();
