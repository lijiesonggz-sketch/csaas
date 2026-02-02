import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Tenant } from '../src/database/entities/tenant.entity';
import { Organization } from '../src/database/entities/organization.entity';
import { RadarPush } from '../src/database/entities/radar-push.entity';
import { WatchedTopic } from '../src/database/entities/watched-topic.entity';

/**
 * RLS Performance and Stress Testing
 *
 * Tests the performance impact of Row-Level Security (RLS) policies:
 * - RLS policy overhead on query performance (< 10% impact)
 * - Concurrent query performance with RLS
 * - Index effectiveness with RLS policies
 * - Query response time under load (P95 < 200ms)
 *
 * **Acceptance Criteria**:
 * - RLS policy impact on query performance < 10%
 * - P95 response time < 200ms for common queries
 * - No performance degradation under concurrent load
 *
 * @story Story 6.1B - Database Layer RLS and Audit Layer
 * @phase Phase 3: Performance Testing
 */
describe('RLS Performance Testing (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let tenant1: Tenant;
  let tenant2: Tenant;
  let org1: Organization;
  let org2: Organization;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = app.get(DataSource);

    // 创建测试租户
    const tenantRepo = dataSource.getRepository(Tenant);
    tenant1 = await tenantRepo.save({
      name: 'Performance Test Tenant 1',
      subscriptionTier: 'pro',
      isActive: true,
    });
    tenant2 = await tenantRepo.save({
      name: 'Performance Test Tenant 2',
      subscriptionTier: 'pro',
      isActive: true,
    });

    // 创建测试组织
    const orgRepo = dataSource.getRepository(Organization);
    org1 = await orgRepo.save({
      name: 'Performance Test Org 1',
      tenantId: tenant1.id,
      radarActivated: true,
    });
    org2 = await orgRepo.save({
      name: 'Performance Test Org 2',
      tenantId: tenant2.id,
      radarActivated: true,
    });

    // 创建测试数据（每个租户100条记录）
    await seedTestData(dataSource, tenant1.id, org1.id, 100);
    await seedTestData(dataSource, tenant2.id, org2.id, 100);
  });

  afterAll(async () => {
    // 清理测试数据
    await dataSource.query(`DELETE FROM radar_pushes WHERE tenant_id IN ($1, $2)`, [
      tenant1.id,
      tenant2.id,
    ]);
    await dataSource.query(`DELETE FROM watched_topics WHERE tenant_id IN ($1, $2)`, [
      tenant1.id,
      tenant2.id,
    ]);
    await dataSource.query(`DELETE FROM organizations WHERE id IN ($1, $2)`, [org1.id, org2.id]);
    await dataSource.query(`DELETE FROM tenants WHERE id IN ($1, $2)`, [tenant1.id, tenant2.id]);
    await app.close();
  });

  describe('[P2] RLS Policy Overhead', () => {
    it('should have < 10% performance impact on SELECT queries', async () => {
      const iterations = 100;

      // Baseline: Query without RLS (admin bypass)
      await dataSource.query(`SET app.is_admin = true`);
      const baselineStart = Date.now();
      for (let i = 0; i < iterations; i++) {
        await dataSource.query(`SELECT * FROM radar_pushes LIMIT 10`);
      }
      const baselineTime = Date.now() - baselineStart;
      await dataSource.query(`RESET app.is_admin`);

      // With RLS: Query with RLS policy
      await dataSource.query(`SET app.current_tenant = $1`, [tenant1.id]);
      const rlsStart = Date.now();
      for (let i = 0; i < iterations; i++) {
        await dataSource.query(`SELECT * FROM radar_pushes LIMIT 10`);
      }
      const rlsTime = Date.now() - rlsStart;
      await dataSource.query(`RESET app.current_tenant`);

      // Calculate overhead
      const overhead = ((rlsTime - baselineTime) / baselineTime) * 100;

      console.log(`\n📊 RLS Performance Impact:`);
      console.log(`   Baseline (no RLS): ${baselineTime}ms`);
      console.log(`   With RLS: ${rlsTime}ms`);
      console.log(`   Overhead: ${overhead.toFixed(2)}%`);

      // THEN: Overhead should be < 10%
      expect(overhead).toBeLessThan(10);
    });

    it('should have < 10% performance impact on COUNT queries', async () => {
      const iterations = 100;

      // Baseline: COUNT without RLS
      await dataSource.query(`SET app.is_admin = true`);
      const baselineStart = Date.now();
      for (let i = 0; i < iterations; i++) {
        await dataSource.query(`SELECT COUNT(*) FROM radar_pushes`);
      }
      const baselineTime = Date.now() - baselineStart;
      await dataSource.query(`RESET app.is_admin`);

      // With RLS: COUNT with RLS policy
      await dataSource.query(`SET app.current_tenant = $1`, [tenant1.id]);
      const rlsStart = Date.now();
      for (let i = 0; i < iterations; i++) {
        await dataSource.query(`SELECT COUNT(*) FROM radar_pushes`);
      }
      const rlsTime = Date.now() - rlsStart;
      await dataSource.query(`RESET app.current_tenant`);

      const overhead = ((rlsTime - baselineTime) / baselineTime) * 100;

      console.log(`\n📊 RLS COUNT Query Impact:`);
      console.log(`   Baseline: ${baselineTime}ms`);
      console.log(`   With RLS: ${rlsTime}ms`);
      console.log(`   Overhead: ${overhead.toFixed(2)}%`);

      expect(overhead).toBeLessThan(10);
    });

    it('should have < 10% performance impact on JOIN queries', async () => {
      const iterations = 50;

      // Baseline: JOIN without RLS
      await dataSource.query(`SET app.is_admin = true`);
      const baselineStart = Date.now();
      for (let i = 0; i < iterations; i++) {
        await dataSource.query(`
          SELECT rp.*, o.name as org_name
          FROM radar_pushes rp
          JOIN organizations o ON rp.organization_id = o.id
          LIMIT 10
        `);
      }
      const baselineTime = Date.now() - baselineStart;
      await dataSource.query(`RESET app.is_admin`);

      // With RLS: JOIN with RLS policy
      await dataSource.query(`SET app.current_tenant = $1`, [tenant1.id]);
      const rlsStart = Date.now();
      for (let i = 0; i < iterations; i++) {
        await dataSource.query(`
          SELECT rp.*, o.name as org_name
          FROM radar_pushes rp
          JOIN organizations o ON rp.organization_id = o.id
          LIMIT 10
        `);
      }
      const rlsTime = Date.now() - rlsStart;
      await dataSource.query(`RESET app.current_tenant`);

      const overhead = ((rlsTime - baselineTime) / baselineTime) * 100;

      console.log(`\n📊 RLS JOIN Query Impact:`);
      console.log(`   Baseline: ${baselineTime}ms`);
      console.log(`   With RLS: ${rlsTime}ms`);
      console.log(`   Overhead: ${overhead.toFixed(2)}%`);

      expect(overhead).toBeLessThan(10);
    });
  });

  describe('[P2] Query Response Time (P95)', () => {
    it('should have P95 < 200ms for common SELECT queries', async () => {
      const iterations = 100;
      const responseTimes: number[] = [];

      await dataSource.query(`SET app.current_tenant = $1`, [tenant1.id]);

      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await dataSource.query(`SELECT * FROM radar_pushes LIMIT 10`);
        const responseTime = Date.now() - start;
        responseTimes.push(responseTime);
      }

      await dataSource.query(`RESET app.current_tenant`);

      // Calculate P95
      responseTimes.sort((a, b) => a - b);
      const p95Index = Math.floor(iterations * 0.95);
      const p95 = responseTimes[p95Index];
      const avg = responseTimes.reduce((a, b) => a + b, 0) / iterations;

      console.log(`\n📊 Query Response Time:`);
      console.log(`   Average: ${avg.toFixed(2)}ms`);
      console.log(`   P95: ${p95}ms`);
      console.log(`   Max: ${Math.max(...responseTimes)}ms`);

      // THEN: P95 should be < 200ms
      expect(p95).toBeLessThan(200);
    });

    it('should have P95 < 200ms for filtered queries', async () => {
      const iterations = 100;
      const responseTimes: number[] = [];

      await dataSource.query(`SET app.current_tenant = $1`, [tenant1.id]);

      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await dataSource.query(`
          SELECT * FROM radar_pushes
          WHERE content_type = 'technical'
          AND sent_at > NOW() - INTERVAL '30 days'
          LIMIT 10
        `);
        const responseTime = Date.now() - start;
        responseTimes.push(responseTime);
      }

      await dataSource.query(`RESET app.current_tenant`);

      responseTimes.sort((a, b) => a - b);
      const p95Index = Math.floor(iterations * 0.95);
      const p95 = responseTimes[p95Index];

      console.log(`\n📊 Filtered Query Response Time (P95): ${p95}ms`);

      expect(p95).toBeLessThan(200);
    });
  });

  describe('[P2] Concurrent Query Performance', () => {
    it('should handle concurrent queries without performance degradation', async () => {
      const concurrentQueries = 20;
      const queriesPerConnection = 10;

      // Sequential baseline
      await dataSource.query(`SET app.current_tenant = $1`, [tenant1.id]);
      const sequentialStart = Date.now();
      for (let i = 0; i < concurrentQueries * queriesPerConnection; i++) {
        await dataSource.query(`SELECT * FROM radar_pushes LIMIT 10`);
      }
      const sequentialTime = Date.now() - sequentialStart;
      await dataSource.query(`RESET app.current_tenant`);

      // Concurrent execution
      const concurrentStart = Date.now();
      const promises = [];
      for (let i = 0; i < concurrentQueries; i++) {
        promises.push(
          (async () => {
            await dataSource.query(`SET app.current_tenant = $1`, [tenant1.id]);
            for (let j = 0; j < queriesPerConnection; j++) {
              await dataSource.query(`SELECT * FROM radar_pushes LIMIT 10`);
            }
            await dataSource.query(`RESET app.current_tenant`);
          })(),
        );
      }
      await Promise.all(promises);
      const concurrentTime = Date.now() - concurrentStart;

      const speedup = sequentialTime / concurrentTime;

      console.log(`\n📊 Concurrent Query Performance:`);
      console.log(`   Sequential: ${sequentialTime}ms`);
      console.log(`   Concurrent (${concurrentQueries} connections): ${concurrentTime}ms`);
      console.log(`   Speedup: ${speedup.toFixed(2)}x`);

      // THEN: Concurrent should be faster (speedup > 1)
      expect(speedup).toBeGreaterThan(1);
    });

    it('should handle multi-tenant concurrent queries efficiently', async () => {
      const queriesPerTenant = 50;

      const start = Date.now();
      await Promise.all([
        // Tenant 1 queries
        (async () => {
          await dataSource.query(`SET app.current_tenant = $1`, [tenant1.id]);
          for (let i = 0; i < queriesPerTenant; i++) {
            await dataSource.query(`SELECT * FROM radar_pushes LIMIT 10`);
          }
          await dataSource.query(`RESET app.current_tenant`);
        })(),
        // Tenant 2 queries
        (async () => {
          await dataSource.query(`SET app.current_tenant = $1`, [tenant2.id]);
          for (let i = 0; i < queriesPerTenant; i++) {
            await dataSource.query(`SELECT * FROM radar_pushes LIMIT 10`);
          }
          await dataSource.query(`RESET app.current_tenant`);
        })(),
      ]);
      const totalTime = Date.now() - start;

      const avgTimePerQuery = totalTime / (queriesPerTenant * 2);

      console.log(`\n📊 Multi-Tenant Concurrent Performance:`);
      console.log(`   Total time: ${totalTime}ms`);
      console.log(`   Avg per query: ${avgTimePerQuery.toFixed(2)}ms`);

      // THEN: Average time per query should be reasonable
      expect(avgTimePerQuery).toBeLessThan(50);
    });
  });

  describe('[P2] Index Effectiveness with RLS', () => {
    it('should use tenant_id index effectively', async () => {
      await dataSource.query(`SET app.current_tenant = $1`, [tenant1.id]);

      // Get query plan
      const plan = await dataSource.query(`
        EXPLAIN (FORMAT JSON)
        SELECT * FROM radar_pushes
        WHERE tenant_id = '${tenant1.id}'
        LIMIT 10
      `);

      await dataSource.query(`RESET app.current_tenant`);

      const queryPlan = JSON.stringify(plan);

      console.log(`\n📊 Query Plan Analysis:`);
      console.log(`   Uses Index: ${queryPlan.includes('Index Scan') ? 'Yes' : 'No'}`);

      // THEN: Should use index scan (not sequential scan)
      expect(queryPlan).toContain('Index');
    });

    it('should use composite index for filtered queries', async () => {
      await dataSource.query(`SET app.current_tenant = $1`, [tenant1.id]);

      const plan = await dataSource.query(`
        EXPLAIN (FORMAT JSON)
        SELECT * FROM radar_pushes
        WHERE tenant_id = '${tenant1.id}'
        AND sent_at > NOW() - INTERVAL '30 days'
        ORDER BY sent_at DESC
        LIMIT 10
      `);

      await dataSource.query(`RESET app.current_tenant`);

      const queryPlan = JSON.stringify(plan);

      console.log(`\n📊 Composite Index Usage:`);
      console.log(`   Query Plan: ${queryPlan.includes('Index') ? 'Using Index' : 'Sequential Scan'}`);

      // THEN: Should use index
      expect(queryPlan).toContain('Index');
    });
  });

  describe('[P2] Stress Testing', () => {
    it('should handle high-volume queries without errors', async () => {
      const highVolumeQueries = 500;
      let successCount = 0;
      let errorCount = 0;

      await dataSource.query(`SET app.current_tenant = $1`, [tenant1.id]);

      for (let i = 0; i < highVolumeQueries; i++) {
        try {
          await dataSource.query(`SELECT * FROM radar_pushes LIMIT 10`);
          successCount++;
        } catch (error) {
          errorCount++;
        }
      }

      await dataSource.query(`RESET app.current_tenant`);

      const successRate = (successCount / highVolumeQueries) * 100;

      console.log(`\n📊 High-Volume Query Results:`);
      console.log(`   Total queries: ${highVolumeQueries}`);
      console.log(`   Success: ${successCount}`);
      console.log(`   Errors: ${errorCount}`);
      console.log(`   Success rate: ${successRate.toFixed(2)}%`);

      // THEN: Success rate should be 100%
      expect(successRate).toBe(100);
    });

    it('should maintain performance under sustained load', async () => {
      const duration = 10000; // 10 seconds
      const queryInterval = 100; // Query every 100ms
      const responseTimes: number[] = [];

      await dataSource.query(`SET app.current_tenant = $1`, [tenant1.id]);

      const startTime = Date.now();
      while (Date.now() - startTime < duration) {
        const queryStart = Date.now();
        await dataSource.query(`SELECT * FROM radar_pushes LIMIT 10`);
        const responseTime = Date.now() - queryStart;
        responseTimes.push(responseTime);

        await new Promise((resolve) => setTimeout(resolve, queryInterval));
      }

      await dataSource.query(`RESET app.current_tenant`);

      // Analyze response times over time
      const firstHalf = responseTimes.slice(0, Math.floor(responseTimes.length / 2));
      const secondHalf = responseTimes.slice(Math.floor(responseTimes.length / 2));

      const avgFirstHalf = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const avgSecondHalf = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

      const degradation = ((avgSecondHalf - avgFirstHalf) / avgFirstHalf) * 100;

      console.log(`\n📊 Sustained Load Performance:`);
      console.log(`   Total queries: ${responseTimes.length}`);
      console.log(`   Avg response time (first half): ${avgFirstHalf.toFixed(2)}ms`);
      console.log(`   Avg response time (second half): ${avgSecondHalf.toFixed(2)}ms`);
      console.log(`   Performance degradation: ${degradation.toFixed(2)}%`);

      // THEN: Performance degradation should be minimal (< 20%)
      expect(Math.abs(degradation)).toBeLessThan(20);
    });
  });
});

/**
 * Helper function to seed test data
 */
async function seedTestData(
  dataSource: DataSource,
  tenantId: string,
  orgId: string,
  count: number,
): Promise<void> {
  const pushRepo = dataSource.getRepository(RadarPush);
  const topicRepo = dataSource.getRepository(WatchedTopic);

  // Seed RadarPushes
  for (let i = 0; i < count; i++) {
    await pushRepo.save({
      tenantId,
      organizationId: orgId,
      contentType: i % 2 === 0 ? 'technical' : 'compliance',
      title: `Test Push ${i}`,
      summary: `Test summary ${i}`,
      sentAt: new Date(Date.now() - i * 86400000), // Spread over days
    });
  }

  // Seed WatchedTopics
  for (let i = 0; i < count / 2; i++) {
    await topicRepo.save({
      tenantId,
      organizationId: orgId,
      keyword: `Test Keyword ${i}`,
      category: 'technical',
      priority: i % 3 === 0 ? 'high' : 'medium',
    });
  }
}
