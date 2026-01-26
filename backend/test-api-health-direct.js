/**
 * API健康检查脚本（直接使用客户端版本）
 * 绕过NestJS依赖注入，直接测试AI客户端
 *
 * 使用方法：
 *   node test-api-health-direct.js
 */

const { AnthropicClient } = require('./dist/src/modules/ai-clients/providers/anthropic.client');
const { OpenAIClient } = require('./dist/src/modules/ai-clients/providers/openai.client');
const { TongyiClient } = require('./dist/src/modules/ai-clients/providers/tongyi.client');
const { AIModel } = require('./dist/src/database/entities/ai-generation-event.entity');
const fs = require('fs');
const path = require('path');

// 健康检查结果
const healthResults = {
  timestamp: new Date().toISOString(),
  apis: {},
  summary: {
    total: 0,
    healthy: 0,
    unhealthy: 0,
    overall: 'unknown'
  }
};

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

/**
 * 测试单个API客户端
 */
async function testClient(client, apiName, testPrompt) {
  const startTime = Date.now();

  try {
    console.log(colors.cyan + '测试 ' + apiName + '...' + colors.reset);

    // 检查客户端是否可用
    if (!client.isAvailable()) {
      throw new Error('客户端不可用（isAvailable()返回false）');
    }

    const result = await client.generate({
      prompt: testPrompt,
      temperature: 0.3,
      maxTokens: 50
    });

    const duration = Date.now() - startTime;
    const responsePreview = result.content ? result.content.substring(0, 50) : '无响应';

    const apiResult = {
      status: 'healthy',
      responseTime: duration,
      responsePreview: responsePreview,
      responseLength: result.content ? result.content.length : 0,
      tokens: result.tokens,
      cost: result.cost,
      error: null
    };

    console.log(colors.green + '✅ ' + apiName + ' 正常' + colors.reset);
    console.log('   响应时间: ' + duration + 'ms');
    console.log('   Tokens: ' + result.tokens.total);
    console.log('   成本: $' + result.cost.toFixed(4));
    console.log('   响应预览: ' + responsePreview + '\n');

    return apiResult;
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error.message || '未知错误';

    const apiResult = {
      status: 'unhealthy',
      responseTime: duration,
      responsePreview: null,
      responseLength: 0,
      tokens: null,
      cost: null,
      error: errorMessage
    };

    console.log(colors.red + '❌ ' + apiName + ' 失败' + colors.reset);
    console.log('   错误: ' + errorMessage + '\n');

    return apiResult;
  }
}

/**
 * 运行健康检查
 */
async function runHealthCheck() {
  console.log(colors.magenta + '========================================' + colors.reset);
  console.log(colors.magenta + '   AI API 健康检查（直接模式）' + colors.reset);
  console.log(colors.magenta + '========================================' + colors.reset + '\n');

  console.log('检查时间: ' + healthResults.timestamp + '\n');

  // 创建客户端实例
  const anthropicClient = new AnthropicClient();
  const openaiClient = new OpenAIClient();
  const tongyiClient = new TongyiClient();

  // 测试所有API
  const clients = [
    { name: 'Claude (Anthropic)', client: anthropicClient, prompt: '请回复：Claude API正常' },
    { name: '智谱GLM', client: openaiClient, prompt: '请回复：智谱GLM API正常' },
    { name: '通义千问', client: tongyiClient, prompt: '请回复：通义千问API正常' }
  ];

  for (const item of clients) {
    const result = await testClient(item.client, item.name, item.prompt);
    healthResults.apis[item.name] = result;
    healthResults.summary.total++;

    if (result.status === 'healthy') {
      healthResults.summary.healthy++;
    } else {
      healthResults.summary.unhealthy++;
    }

    // 延迟1秒，避免API限流
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // 计算总体健康状态
  if (healthResults.summary.healthy === healthResults.summary.total) {
    healthResults.summary.overall = 'healthy';
  } else if (healthResults.summary.healthy === 0) {
    healthResults.summary.overall = 'critical';
  } else {
    healthResults.summary.overall = 'degraded';
  }

  // 打印总结
  console.log(colors.magenta + '========================================' + colors.reset);
  console.log(colors.magenta + '   健康检查总结' + colors.reset);
  console.log(colors.magenta + '========================================' + colors.reset + '\n');

  console.log('总API数: ' + healthResults.summary.total);
  console.log(colors.green + '正常: ' + healthResults.summary.healthy + colors.reset);
  console.log(colors.red + '异常: ' + healthResults.summary.unhealthy + colors.reset);

  const overallStatus = healthResults.summary.overall;
  let statusColor = colors.reset;
  let statusIcon = '⚪';

  if (overallStatus === 'healthy') {
    statusColor = colors.green;
    statusIcon = '✅';
  } else if (overallStatus === 'critical') {
    statusColor = colors.red;
    statusIcon = '🔴';
  } else {
    statusColor = colors.yellow;
    statusIcon = '⚠️';
  }

  console.log('\n' + statusColor + statusIcon + ' 总体状态: ' + overallStatus.toUpperCase() + colors.reset + '\n');

  // 打印建议
  printRecommendations();

  // 导出结果
  exportResults();

  return healthResults;
}

/**
 * 打印修复建议
 */
function printRecommendations() {
  console.log(colors.magenta + '========================================' + colors.reset);
  console.log(colors.magenta + '   修复建议' + colors.reset);
  console.log(colors.magenta + '========================================' + colors.reset + '\n');

  let hasIssues = false;

  for (const [apiName, result] of Object.entries(healthResults.apis)) {
    if (result.status === 'unhealthy') {
      hasIssues = true;
      console.log(colors.yellow + '🔧 ' + apiName + ':' + colors.reset);

      if (result.error.includes('401') || result.error.includes('令牌') || result.error.includes('验证')) {
        console.log('   问题: API密钥过期或无效');
        console.log('   解决: 更新API密钥后重启服务');
        console.log('   配置文件: backend/.env.development\n');
      } else if (result.error.includes('429') || result.error.includes('余额') || result.error.includes('充值')) {
        console.log('   问题: 账户余额不足');
        console.log('   解决: 充值账户');
        console.log('   智谱GLM: https://open.bigmodel.cn/\n');
      } else if (result.error.includes('timeout') || result.error.includes('ETIMEDOUT')) {
        console.log('   问题: 网络连接超时');
        console.log('   解决: 检查网络连接或代理设置\n');
      } else if (result.error.includes('isAvailable') || result.error.includes('不可用')) {
        console.log('   问题: API客户端未正确初始化');
        console.log('   解决: 检查环境变量和配置文件\n');
      } else {
        console.log('   问题: ' + result.error);
        console.log('   解决: 查看日志了解更多详情\n');
      }
    }
  }

  if (!hasIssues) {
    console.log(colors.green + '✅ 所有API正常工作！' + colors.reset + '\n');
  }
}

/**
 * 导出结果到JSON文件
 */
function exportResults() {
  const reportPath = path.join(__dirname, 'api-health-report-' + Date.now() + '.json');

  fs.writeFileSync(reportPath, JSON.stringify(healthResults, null, 2));
  console.log(colors.blue + '📄 详细报告已保存到: ' + path.basename(reportPath) + colors.reset + '\n');

  return reportPath;
}

/**
 * 主函数
 */
async function main() {
  try {
    await runHealthCheck();

    // 根据健康状态设置退出码
    const exitCode = healthResults.summary.overall === 'critical' ? 1 : 0;
    process.exit(exitCode);
  } catch (error) {
    console.error('健康检查失败: ' + error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

// 导出函数供其他模块使用
module.exports = {
  runHealthCheck,
  testClient,
  healthResults
};
