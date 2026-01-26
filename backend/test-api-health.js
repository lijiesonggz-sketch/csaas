/**
 * API健康检查脚本
 * 定期测试所有AI API的可用性
 *
 * 使用方法：
 *   node test-api-health.js
 *
 * 添加到package.json：
 *   "scripts": {
 *     "health:check": "node test-api-health.js"
 *   }
 */

const { AIOrchestrator } = require('./dist/src/modules/ai-clients/ai-orchestrator.service');
const { AIModel } = require('./dist/src/database/entities/ai-generation-event.entity');
const Database = require('better-sqlite3');
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
 * 测试单个API
 */
async function testAPI(apiName, model, testPrompt) {
  const startTime = Date.now();
  const orchestrator = new AIOrchestrator();

  try {
    console.log(colors.cyan + '测试 ' + apiName + '...' + colors.reset);

    const result = await orchestrator.generate({
      prompt: testPrompt,
      temperature: 0.3,
      maxTokens: 50
    }, model);

    const duration = Date.now() - startTime;
    const responsePreview = result.content ? result.content.substring(0, 50) : '无响应';

    const apiResult = {
      status: 'healthy',
      responseTime: duration,
      responsePreview: responsePreview,
      responseLength: result.content ? result.content.length : 0,
      error: null
    };

    console.log(colors.green + '✅ ' + apiName + ' 正常' + colors.reset);
    console.log('   响应时间: ' + duration + 'ms');
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
  console.log(colors.magenta + '   AI API 健康检查' + colors.reset);
  console.log(colors.magenta + '========================================' + colors.reset + '\n');

  console.log('检查时间: ' + healthResults.timestamp + '\n');

  // 测试所有API
  const apis = [
    { name: 'Claude (Anthropic)', model: AIModel.CLAUDE, prompt: '请回复：Claude API正常' },
    { name: '智谱GLM', model: AIModel.GPT4, prompt: '请回复：智谱GLM API正常' },
    { name: '通义千问', model: AIModel.DOMESTIC, prompt: '请回复：通义千问API正常' }
  ];

  for (const api of apis) {
    const result = await testAPI(api.name, api.model, api.prompt);
    healthResults.apis[api.name] = result;
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

  // 保存结果到数据库
  saveHealthCheckResult();

  // 打印建议
  printRecommendations();

  return healthResults;
}

/**
 * 保存健康检查结果到数据库
 */
function saveHealthCheckResult() {
  try {
    const dbPath = path.join(__dirname, 'data', 'csaas.db');
    const db = new Database(dbPath);

    // 创建健康检查表（如果不存在）
    db.exec(`
      CREATE TABLE IF NOT EXISTS api_health_checks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        api_name TEXT NOT NULL,
        status TEXT NOT NULL,
        response_time INTEGER,
        error TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 插入检查结果
    const insert = db.prepare(`
      INSERT INTO api_health_checks (timestamp, api_name, status, response_time, error)
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((checks) => {
      for (const check of checks) {
        insert.run(check.timestamp, check.apiName, check.status, check.responseTime, check.error);
      }
    });

    const checks = [];
    for (const [apiName, result] of Object.entries(healthResults.apis)) {
      checks.push({
        timestamp: healthResults.timestamp,
        apiName,
        status: result.status,
        responseTime: result.responseTime,
        error: result.error
      });
    }

    insertMany(checks);
    db.close();

    console.log(colors.blue + '💾 健康检查结果已保存到数据库' + colors.reset + '\n');
  } catch (error) {
    console.error('保存健康检查结果失败: ' + error.message);
  }
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
        console.log('   解决: 更新API密钥后重启服务\n');
      } else if (result.error.includes('429') || result.error.includes('余额') || result.error.includes('充值')) {
        console.log('   问题: 账户余额不足');
        console.log('   解决: 充值账户\n');
      } else if (result.error.includes('timeout') || result.error.includes('ETIMEDOUT')) {
        console.log('   问题: 网络连接超时');
        console.log('   解决: 检查网络连接或代理设置\n');
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
  const fs = require('fs');
  const reportPath = path.join(__dirname, 'api-health-report-' + Date.now() + '.json');

  fs.writeFileSync(reportPath, JSON.stringify(healthResults, null, 2));
  console.log(colors.blue + '📄 详细报告已保存到: ' + reportPath + colors.reset + '\n');

  return reportPath;
}

/**
 * 查询历史健康检查记录
 */
function queryHistory(days = 7) {
  try {
    const dbPath = path.join(__dirname, 'data', 'csaas.db');
    const db = new Database(dbPath);

    const rows = db.prepare(`
      SELECT
        api_name,
        COUNT(*) as total_checks,
        SUM(CASE WHEN status = 'healthy' THEN 1 ELSE 0 END) as healthy_count,
        AVG(response_time) as avg_response_time,
        MAX(created_at) as last_check
      FROM api_health_checks
      WHERE created_at >= datetime('now', '-' + days + ' days')
      GROUP BY api_name
      ORDER BY api_name
    `).all();

    console.log(colors.magenta + '========================================' + colors.reset);
    console.log(colors.magenta + '   过去' + days + '天的健康检查统计' + colors.reset);
    console.log(colors.magenta + '========================================' + colors.reset + '\n');

    rows.forEach(row => {
      const successRate = ((row.healthy_count / row.total_checks) * 100).toFixed(1);
      console.log(row.api_name + ':');
      console.log('  总检查次数: ' + row.total_checks);
      console.log('  成功次数: ' + row.healthy_count);
      console.log('  成功率: ' + successRate + '%');
      console.log('  平均响应时间: ' + Math.round(row.avg_response_time) + 'ms');
      console.log('  最后检查: ' + row.last_check + '\n');
    });

    db.close();
  } catch (error) {
    console.error('查询历史记录失败: ' + error.message);
  }
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);

  // 如果是查询历史
  if (args.includes('--history') || args.includes('-h')) {
    const daysArg = args.find(arg => arg.match(/^\d+$/));
    const days = daysArg ? parseInt(daysArg) : 7;
    queryHistory(days);
    process.exit(0);
    return;
  }

  // 运行健康检查
  try {
    await runHealthCheck();
    exportResults();

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
  testAPI,
  healthResults,
  queryHistory
};
