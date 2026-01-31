/**
 * Comprehensive Test Suite for Radar Sources API
 * Story 3.1: 配置行业雷达信息源
 *
 * 测试所有API端点和数据验证
 */

import axios, { AxiosInstance } from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '.env.development') });

const BASE_URL = `http://localhost:${process.env.PORT || 3000}`;
const API_PREFIX = '/api/admin/radar-sources';

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message?: string;
  duration?: number;
  error?: any;
}

interface TestSuite {
  name: string;
  results: TestResult[];
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
}

class RadarSourcesAPITester {
  private client: AxiosInstance;
  private testResults: TestResult[] = [];
  private createdIds: string[] = [];
  private authToken: string = '';

  constructor() {
    this.client = axios.create({
      baseURL: BASE_URL,
      timeout: 30000,
      validateStatus: () => true, // 不自动抛出错误
    });
  }

  /**
   * 执行单个测试
   */
  private async runTest(
    name: string,
    testFn: () => Promise<void>,
  ): Promise<TestResult> {
    const startTime = Date.now();
    console.log(`\n🧪 Testing: ${name}`);

    try {
      await testFn();
      const duration = Date.now() - startTime;
      console.log(`✅ PASS (${duration}ms)`);
      return {
        name,
        status: 'PASS',
        duration,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.log(`❌ FAIL (${duration}ms)`);
      console.error(`   Error: ${error.message}`);
      if (error.response?.data) {
        console.error(`   Response:`, JSON.stringify(error.response.data, null, 2));
      }
      return {
        name,
        status: 'FAIL',
        message: error.message,
        error: error.response?.data || error,
        duration,
      };
    }
  }

  /**
   * 检查服务器健康状态
   */
  async checkServerHealth(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  /**
   * 测试1: GET /api/admin/radar-sources - 列表查询
   */
  async testGetList() {
    const result = await this.runTest('GET /api/admin/radar-sources - List all sources', async () => {
      const response = await this.client.get(API_PREFIX);

      if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
      }

      const data = response.data;
      if (!Array.isArray(data)) {
        throw new Error('Response should be an array');
      }

      console.log(`   Found ${data.length} sources`);
    });

    this.testResults.push(result);
  }

  /**
   * 测试2: GET /api/admin/radar-sources?category=tech - 按类别过滤
   */
  async testGetListByCategory() {
    const result = await this.runTest('GET /api/admin/radar-sources?category=tech - Filter by category', async () => {
      const response = await this.client.get(`${API_PREFIX}?category=tech`);

      if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
      }

      const data = response.data;
      if (!Array.isArray(data)) {
        throw new Error('Response should be an array');
      }

      // 验证所有返回的数据都是tech类别
      const allTech = data.every((item: any) => item.category === 'tech');
      if (!allTech) {
        throw new Error('Not all items have category=tech');
      }

      console.log(`   Found ${data.length} tech sources`);
    });

    this.testResults.push(result);
  }

  /**
   * 测试3: POST /api/admin/radar-sources - 创建新信息源
   */
  async testCreateSource() {
    const result = await this.runTest('POST /api/admin/radar-sources - Create new source', async () => {
      const newSource = {
        source: '测试信息源-' + Date.now(),
        category: 'tech',
        url: 'https://example.com/test',
        type: 'website',
        isActive: true,
        crawlSchedule: '0 2 * * *',
      };

      const response = await this.client.post(API_PREFIX, newSource);

      if (response.status !== 201) {
        throw new Error(`Expected status 201, got ${response.status}`);
      }

      const data = response.data;
      if (!data.id) {
        throw new Error('Response should contain id');
      }

      this.createdIds.push(data.id);
      console.log(`   Created source with id: ${data.id}`);
    });

    this.testResults.push(result);
  }

  /**
   * 测试4: POST /api/admin/radar-sources - 验证必填字段
   */
  async testCreateSourceValidation() {
    const result = await this.runTest('POST /api/admin/radar-sources - Validate required fields', async () => {
      const invalidSource = {
        source: '测试',
        // 缺少必填字段
      };

      const response = await this.client.post(API_PREFIX, invalidSource);

      if (response.status !== 400) {
        throw new Error(`Expected status 400 for invalid data, got ${response.status}`);
      }

      console.log(`   Validation working correctly`);
    });

    this.testResults.push(result);
  }

  /**
   * 测试5: POST /api/admin/radar-sources - 验证URL格式
   */
  async testCreateSourceUrlValidation() {
    const result = await this.runTest('POST /api/admin/radar-sources - Validate URL format', async () => {
      const invalidSource = {
        source: '测试信息源',
        category: 'tech',
        url: 'not-a-valid-url',
        type: 'website',
        isActive: true,
        crawlSchedule: '0 2 * * *',
      };

      const response = await this.client.post(API_PREFIX, invalidSource);

      if (response.status !== 400) {
        throw new Error(`Expected status 400 for invalid URL, got ${response.status}`);
      }

      console.log(`   URL validation working correctly`);
    });

    this.testResults.push(result);
  }

  /**
   * 测试6: POST /api/admin/radar-sources - 验证枚举值
   */
  async testCreateSourceEnumValidation() {
    const result = await this.runTest('POST /api/admin/radar-sources - Validate enum values', async () => {
      const invalidSource = {
        source: '测试信息源',
        category: 'invalid_category',
        url: 'https://example.com',
        type: 'website',
        isActive: true,
        crawlSchedule: '0 2 * * *',
      };

      const response = await this.client.post(API_PREFIX, invalidSource);

      if (response.status !== 400) {
        throw new Error(`Expected status 400 for invalid enum, got ${response.status}`);
      }

      console.log(`   Enum validation working correctly`);
    });

    this.testResults.push(result);
  }

  /**
   * 测试7: GET /api/admin/radar-sources/:id - 查询单个信息源
   */
  async testGetById() {
    const result = await this.runTest('GET /api/admin/radar-sources/:id - Get single source', async () => {
      if (this.createdIds.length === 0) {
        throw new Error('No created sources to test with');
      }

      const id = this.createdIds[0];
      const response = await this.client.get(`${API_PREFIX}/${id}`);

      if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
      }

      const data = response.data;
      if (data.id !== id) {
        throw new Error(`Expected id ${id}, got ${data.id}`);
      }

      console.log(`   Retrieved source: ${data.source}`);
    });

    this.testResults.push(result);
  }

  /**
   * 测试8: GET /api/admin/radar-sources/:id - 不存在的ID
   */
  async testGetByIdNotFound() {
    const result = await this.runTest('GET /api/admin/radar-sources/:id - Not found', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await this.client.get(`${API_PREFIX}/${fakeId}`);

      if (response.status !== 404) {
        throw new Error(`Expected status 404, got ${response.status}`);
      }

      console.log(`   404 handling working correctly`);
    });

    this.testResults.push(result);
  }

  /**
   * 测试9: PUT /api/admin/radar-sources/:id - 更新信息源
   */
  async testUpdateSource() {
    const result = await this.runTest('PUT /api/admin/radar-sources/:id - Update source', async () => {
      if (this.createdIds.length === 0) {
        throw new Error('No created sources to test with');
      }

      const id = this.createdIds[0];
      const updateData = {
        source: '更新后的信息源',
        category: 'industry',
        url: 'https://example.com/updated',
        type: 'wechat',
        peerName: '测试同业机构',
        isActive: false,
        crawlSchedule: '0 3 * * *',
      };

      const response = await this.client.put(`${API_PREFIX}/${id}`, updateData);

      if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
      }

      const data = response.data;
      if (data.source !== updateData.source) {
        throw new Error(`Update failed: source not updated`);
      }

      console.log(`   Updated source successfully`);
    });

    this.testResults.push(result);
  }

  /**
   * 测试10: PATCH /api/admin/radar-sources/:id/toggle - 切换状态
   */
  async testToggleStatus() {
    const result = await this.runTest('PATCH /api/admin/radar-sources/:id/toggle - Toggle status', async () => {
      if (this.createdIds.length === 0) {
        throw new Error('No created sources to test with');
      }

      const id = this.createdIds[0];

      // 获取当前状态
      const getResponse = await this.client.get(`${API_PREFIX}/${id}`);
      const currentStatus = getResponse.data.isActive;

      // 切换状态
      const response = await this.client.patch(`${API_PREFIX}/${id}/toggle`);

      if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
      }

      const data = response.data;
      if (data.isActive === currentStatus) {
        throw new Error(`Status not toggled`);
      }

      console.log(`   Toggled status from ${currentStatus} to ${data.isActive}`);
    });

    this.testResults.push(result);
  }

  /**
   * 测试11: GET /api/admin/radar-sources/stats/by-category - 统计
   */
  async testGetStats() {
    const result = await this.runTest('GET /api/admin/radar-sources/stats/by-category - Get statistics', async () => {
      const response = await this.client.get(`${API_PREFIX}/stats/by-category`);

      if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
      }

      const data = response.data;
      if (!Array.isArray(data)) {
        throw new Error('Response should be an array');
      }

      console.log(`   Statistics:`, JSON.stringify(data, null, 2));
    });

    this.testResults.push(result);
  }

  /**
   * 测试12: POST /api/admin/radar-sources/:id/test-crawl - 测试爬虫
   */
  async testCrawl() {
    const result = await this.runTest('POST /api/admin/radar-sources/:id/test-crawl - Test crawler', async () => {
      if (this.createdIds.length === 0) {
        throw new Error('No created sources to test with');
      }

      const id = this.createdIds[0];
      const response = await this.client.post(`${API_PREFIX}/${id}/test-crawl`);

      // 爬虫测试可能返回200或202
      if (response.status !== 200 && response.status !== 202) {
        throw new Error(`Expected status 200 or 202, got ${response.status}`);
      }

      console.log(`   Crawler test initiated`);
    });

    this.testResults.push(result);
  }

  /**
   * 测试13: DELETE /api/admin/radar-sources/:id - 删除信息源
   */
  async testDeleteSource() {
    const result = await this.runTest('DELETE /api/admin/radar-sources/:id - Delete source', async () => {
      if (this.createdIds.length === 0) {
        throw new Error('No created sources to test with');
      }

      const id = this.createdIds.pop()!;
      const response = await this.client.delete(`${API_PREFIX}/${id}`);

      if (response.status !== 200 && response.status !== 204) {
        throw new Error(`Expected status 200 or 204, got ${response.status}`);
      }

      // 验证已删除
      const getResponse = await this.client.get(`${API_PREFIX}/${id}`);
      if (getResponse.status !== 404) {
        throw new Error(`Source should be deleted but still exists`);
      }

      console.log(`   Deleted source successfully`);
    });

    this.testResults.push(result);
  }

  /**
   * 清理测试数据
   */
  async cleanup() {
    console.log('\n🧹 Cleaning up test data...');
    for (const id of this.createdIds) {
      try {
        await this.client.delete(`${API_PREFIX}/${id}`);
        console.log(`   Deleted: ${id}`);
      } catch (error) {
        console.error(`   Failed to delete ${id}`);
      }
    }
  }

  /**
   * 生成测试报告
   */
  generateReport(): TestSuite {
    const passed = this.testResults.filter(r => r.status === 'PASS').length;
    const failed = this.testResults.filter(r => r.status === 'FAIL').length;
    const skipped = this.testResults.filter(r => r.status === 'SKIP').length;
    const totalDuration = this.testResults.reduce((sum, r) => sum + (r.duration || 0), 0);

    return {
      name: 'Radar Sources API Test Suite',
      results: this.testResults,
      totalTests: this.testResults.length,
      passed,
      failed,
      skipped,
      duration: totalDuration,
    };
  }

  /**
   * 运行所有测试
   */
  async runAllTests() {
    console.log('═══════════════════════════════════════════════════════');
    console.log('  Radar Sources API - Comprehensive Test Suite');
    console.log('  Story 3.1: 配置行业雷达信息源');
    console.log('═══════════════════════════════════════════════════════');

    // 检查服务器健康状态
    console.log('\n🔍 Checking server health...');
    const isHealthy = await this.checkServerHealth();
    if (!isHealthy) {
      console.error('❌ Server is not running or not healthy');
      console.error(`   Please start the server at ${BASE_URL}`);
      process.exit(1);
    }
    console.log('✅ Server is healthy');

    // 运行所有测试
    console.log('\n📋 Running API Tests...');
    console.log('─────────────────────────────────────────────────────');

    await this.testGetList();
    await this.testGetListByCategory();
    await this.testCreateSource();
    await this.testCreateSourceValidation();
    await this.testCreateSourceUrlValidation();
    await this.testCreateSourceEnumValidation();
    await this.testGetById();
    await this.testGetByIdNotFound();
    await this.testUpdateSource();
    await this.testToggleStatus();
    await this.testGetStats();
    await this.testCrawl();
    await this.testDeleteSource();

    // 清理
    await this.cleanup();

    // 生成报告
    const report = this.generateReport();

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  Test Summary');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`Total Tests:  ${report.totalTests}`);
    console.log(`✅ Passed:    ${report.passed}`);
    console.log(`❌ Failed:    ${report.failed}`);
    console.log(`⏭️  Skipped:   ${report.skipped}`);
    console.log(`⏱️  Duration:  ${report.duration}ms`);
    console.log('═══════════════════════════════════════════════════════');

    if (report.failed > 0) {
      console.log('\n❌ Failed Tests:');
      report.results
        .filter(r => r.status === 'FAIL')
        .forEach(r => {
          console.log(`   - ${r.name}`);
          console.log(`     ${r.message}`);
        });
    }

    return report;
  }
}

// 主函数
async function main() {
  const tester = new RadarSourcesAPITester();

  try {
    const report = await tester.runAllTests();

    // 保存报告到文件
    const fs = require('fs');
    const reportPath = path.join(__dirname, 'test-radar-sources-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Report saved to: ${reportPath}`);

    // 退出码
    process.exit(report.failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  }
}

// 执行测试
main();
