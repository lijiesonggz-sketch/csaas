/**
 * 测试综述生成API
 *
 * 使用方法：
 * node test-summary-generation.js
 */

const http = require('http');

// 测试数据：ISO 27001标准摘录
const testDocument = `
ISO/IEC 27001:2013 信息安全管理体系要求

1. 范围
本标准规定了建立、实施、维护和持续改进信息安全管理体系（ISMS）的要求。

2. 规范性引用文件
ISO/IEC 27000:2014 信息技术 - 安全技术 - 信息安全管理体系 - 概述和术语

3. 术语和定义
3.1 信息安全：保护信息的机密性、完整性和可用性
3.2 信息安全事件：已识别的系统、服务或网络状态，表明可能违反了信息安全策略

4. 组织环境
4.1 理解组织及其环境
4.2 理解相关方的需求和期望
4.3 确定信息安全管理体系的范围
4.4 信息安全管理体系

5. 领导作用
5.1 领导作用和承诺
5.2 信息安全策略
5.3 组织角色、职责和权限

6. 策划
6.1 应对风险和机遇的措施
6.2 信息安全目标及其实现的策划

7. 支持
7.1 资源
7.2 能力
7.3 意识
7.4 沟通
7.5 文件化信息

8. 运行
8.1 运行的策划和控制
8.2 信息安全风险评估
8.3 信息安全风险处理

9. 绩效评价
9.1 监视、测量、分析和评价
9.2 内部审核
9.3 管理评审

10. 改进
10.1 不符合和纠正措施
10.2 持续改进
`.trim();

// API配置
const API_HOST = 'localhost';
const API_PORT = 3000;
const TASK_ID = `test-task-${Date.now()}`;

console.log('=== 测试综述生成API ===\n');
console.log(`任务ID: ${TASK_ID}`);
console.log(`文档长度: ${testDocument.length} 字符\n`);

// 发送POST请求
const postData = JSON.stringify({
  taskId: TASK_ID,
  standardDocument: testDocument,
  temperature: 0.7,
  maxTokens: 2000,
});

const options = {
  hostname: API_HOST,
  port: API_PORT,
  path: '/ai-generation/summary',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
  },
};

console.log('正在调用API生成综述...\n');
console.log(`请求: POST http://${API_HOST}:${API_PORT}${options.path}`);
console.log('这可能需要1-2分钟（三模型并行调用）...\n');

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log(`状态码: ${res.statusCode}\n`);

    try {
      const result = JSON.parse(data);

      if (result.success) {
        console.log('✅ 综述生成成功！\n');
        console.log('=== 结果摘要 ===');
        console.log(`选择的模型: ${result.data.selectedModel}`);
        console.log(`置信度等级: ${result.data.confidenceLevel}`);
        console.log(`质量分数:`);
        console.log(`  - 结构层: ${(result.data.qualityScores.structural * 100).toFixed(2)}%`);
        console.log(`  - 语义层: ${(result.data.qualityScores.semantic * 100).toFixed(2)}%`);
        console.log(`  - 细节层: ${(result.data.qualityScores.detail * 100).toFixed(2)}%`);
        console.log(`\n=== 生成的综述 ===`);
        console.log(JSON.stringify(result.data.selectedResult, null, 2));

        // 测试获取结果
        console.log(`\n正在测试结果查询API...`);
        setTimeout(() => {
          testGetResult(TASK_ID);
        }, 1000);
      } else {
        console.log('❌ 综述生成失败！');
        console.log(`错误: ${result.error}`);
      }
    } catch (error) {
      console.log('❌ 解析响应失败！');
      console.log('响应内容:', data);
      console.log('错误:', error.message);
    }
  });
});

req.on('error', (error) => {
  console.log('❌ 请求失败！');
  console.log('错误:', error.message);
  console.log('\n请确保后端服务正在运行：');
  console.log('  cd backend && npm run start:dev');
});

req.write(postData);
req.end();

// 测试获取结果
function testGetResult(taskId) {
  const getOptions = {
    hostname: API_HOST,
    port: API_PORT,
    path: `/ai-generation/result/${taskId}`,
    method: 'GET',
  };

  console.log(`请求: GET http://${API_HOST}:${API_PORT}${getOptions.path}\n`);

  const getReq = http.request(getOptions, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      try {
        const result = JSON.parse(data);

        if (result.success) {
          console.log('✅ 结果查询成功！\n');
          console.log('=== 完整结果元数据 ===');
          console.log(`结果ID: ${result.data.id}`);
          console.log(`任务ID: ${result.data.taskId}`);
          console.log(`生成类型: ${result.data.generationType}`);
          console.log(`审核状态: ${result.data.reviewStatus}`);
          console.log(`版本: ${result.data.version}`);
          console.log(`创建时间: ${result.data.createdAt}`);

          if (result.data.consistencyReport) {
            console.log(`\n=== 一致性报告 ===`);
            console.log(`一致点数量: ${result.data.consistencyReport.agreements.length}`);
            console.log(`分歧点数量: ${result.data.consistencyReport.disagreements.length}`);
            if (result.data.consistencyReport.highRiskDisagreements.length > 0) {
              console.log(`高风险分歧: ${result.data.consistencyReport.highRiskDisagreements.length}`);
            }
          }
        } else {
          console.log('❌ 结果查询失败！');
          console.log(`错误: ${result.error}`);
        }
      } catch (error) {
        console.log('❌ 解析响应失败！');
        console.log('响应内容:', data);
        console.log('错误:', error.message);
      }
    });
  });

  getReq.on('error', (error) => {
    console.log('❌ 请求失败！');
    console.log('错误:', error.message);
  });

  getReq.end();
}
