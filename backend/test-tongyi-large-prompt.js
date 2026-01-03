/**
 * 测试通义千问处理大 Prompt 的能力
 * 模拟聚类任务的实际调用
 */

const OpenAI = require('openai');
require('dotenv').config({ path: './.env.development' });

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color, ...args) {
  console.log(color, ...args, colors.reset);
}

// 模拟聚类任务的大 Prompt（约25000字符）
const LARGE_PROMPT = `你是一个专业的文档分析和聚类专家。请分析以下2个监管文档，提取关键条款并进行跨文档聚类。

# 文档列表

## 文档1: 银行保险机构数据安全管理办法
内容摘要：${' 数据安全管理条款 '.repeat(500)}

## 文档2: 中国人民银行业务领域数据安全管理办法
内容摘要：${' 业务数据安全条款 '.repeat(500)}

# 任务要求

请按照以下JSON格式返回聚类结果：

{
  "clusters": [
    {
      "id": "cluster_1",
      "name": "聚类名称",
      "description": "聚类描述",
      "clauses": [
        {
          "source_document_id": "doc_1",
          "source_document_name": "文档名称",
          "clause_id": "clause_1",
          "clause_text": "条款文本",
          "rationale": "归类理由"
        }
      ],
      "importance": "HIGH",
      "risk_level": "HIGH"
    }
  ],
  "clustering_logic": "聚类逻辑说明",
  "coverage_summary": {
    "by_document": {
      "doc_1": {
        "total_clauses": 10,
        "clustered_clauses": 10,
        "missing_clause_ids": []
      }
    },
    "overall": {
      "total_clauses": 20,
      "clustered_clauses": 20,
      "coverage_rate": 1.0
    }
  }
}`;

async function testTongyiWithLargePrompt() {
  log(colors.cyan, '\n=== 测试通义千问处理大 Prompt ===');
  log(colors.blue, `Prompt 长度: ${LARGE_PROMPT.length} 字符`);
  log(colors.blue, `Max Tokens: 8000`);
  log(colors.blue, `Response Format: JSON`);

  try {
    const client = new OpenAI({
      apiKey: process.env.TONGYI_API_KEY,
      baseURL: process.env.TONGYI_BASE_URL,
    });

    const startTime = Date.now();

    log(colors.yellow, '\n开始调用通义千问...');

    const response = await client.chat.completions.create({
      model: process.env.TONGYI_MODEL,
      messages: [{ role: 'user', content: LARGE_PROMPT }],
      max_tokens: 8000,
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const duration = Date.now() - startTime;
    const result = response.choices[0].message.content;

    log(colors.green, '\n✓ 通义千问大 Prompt 调用成功');
    log(colors.blue, `耗时: ${duration}ms (${(duration/1000).toFixed(1)}秒)`);
    log(colors.blue, `Input Tokens: ${response.usage.prompt_tokens}`);
    log(colors.blue, `Output Tokens: ${response.usage.completion_tokens}`);
    log(colors.blue, `Total Tokens: ${response.usage.total_tokens}`);
    log(colors.blue, `响应长度: ${result.length} 字符`);

    // 验证 JSON 格式
    try {
      const parsed = JSON.parse(result);
      log(colors.green, '✓ JSON 格式验证通过');
      log(colors.blue, `聚类数量: ${parsed.clusters?.length || 0}`);
    } catch (e) {
      log(colors.red, '✗ JSON 格式验证失败:', e.message);
      log(colors.yellow, '\n响应内容前500字符:');
      log(colors.yellow, result.substring(0, 500));
    }

    return { success: true, duration, tokens: response.usage.total_tokens };
  } catch (error) {
    log(colors.red, '\n✗ 通义千问大 Prompt 调用失败');
    log(colors.red, `错误类型: ${error.constructor.name}`);
    log(colors.red, `错误信息: ${error.message}`);

    if (error.response) {
      log(colors.red, `HTTP 状态: ${error.response.status}`);
      log(colors.red, `响应数据: ${JSON.stringify(error.response.data)}`);
    }

    if (error.cause) {
      log(colors.red, `根本原因: ${error.cause.message}`);
    }

    return { success: false, error: error.message };
  }
}

// 运行测试
testTongyiWithLargePrompt()
  .then(result => {
    log(colors.cyan, '\n=== 测试总结 ===');
    if (result.success) {
      log(colors.green, '✓ 通义千问可以处理聚类任务的大 Prompt');
    } else {
      log(colors.red, '✗ 通义千问无法处理聚类任务的大 Prompt');
      log(colors.yellow, '\n这就解释了为什么在实际运行时会 fallback 到 OpenAI，然后再 fallback 到 Anthropic');
    }
  })
  .catch(error => {
    log(colors.red, '测试执行出错:', error);
    process.exit(1);
  });
