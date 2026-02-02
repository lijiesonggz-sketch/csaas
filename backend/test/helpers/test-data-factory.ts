import { DataSource } from 'typeorm'
import { AnalyzedContent } from '../../src/database/entities/analyzed-content.entity'
import { RawContent } from '../../src/database/entities/raw-content.entity'
import { RadarPush } from '../../src/database/entities/radar-push.entity'
import { Organization } from '../../src/database/entities/organization.entity'
import { Tenant } from '../../src/database/entities/tenant.entity'

/**
 * Test Data Factory
 *
 * 提供创建测试数据的工厂方法，自动处理实体之间的依赖关系
 */

/**
 * 创建测试用的AnalyzedContent
 */
export async function createTestAnalyzedContent(
  dataSource: DataSource,
  data: {
    tenantId: string
    category?: 'tech' | 'industry' | 'compliance'
    title?: string
    summary?: string
  },
): Promise<AnalyzedContent> {
  const repo = dataSource.getRepository(AnalyzedContent)

  // 先创建依赖的RawContent
  const rawContent = await createTestRawContent(dataSource, {
    tenantId: data.tenantId,
    category: data.category || 'tech',
    title: data.title || 'Test Content',
  })

  const analyzedContent = await repo.save({
    contentId: rawContent.id,
    category: data.category || 'tech',
    title: data.title || 'Test Analyzed Content',
    summary: data.summary || 'Test summary',
    fullAnalysis: 'Test full analysis',
    keywords: ['test', 'keyword'],
    categories: [],
    relevanceScore: 0.8,
    aiModel: 'qwen-max',
    tokensUsed: 100,
    tags: [],
    status: 'success',
    analyzedAt: new Date(),
  })

  return analyzedContent
}

/**
 * 创建测试用的RawContent
 */
export async function createTestRawContent(
  dataSource: DataSource,
  data: {
    tenantId: string
    category?: 'tech' | 'industry' | 'compliance'
    title?: string
    source?: string
  },
): Promise<RawContent> {
  const repo = dataSource.getRepository(RawContent)

  const rawContent = await repo.save({
    tenantId: data.tenantId,
    source: data.source || 'TEST_SOURCE',
    category: data.category || 'tech',
    contentType: 'article',
    title: data.title || 'Test Raw Content',
    summary: 'Test summary',
    fullContent: 'Test full content',
    url: 'https://test.example.com',
    publishedAt: new Date(),
    contentHash: `test-hash-${Date.now()}`,
    status: 'pending',
  })

  return rawContent
}

/**
 * 创建测试用的RadarPush
 */
export async function createTestRadarPush(
  dataSource: DataSource,
  data: {
    tenantId: string
    organizationId: string
    radarType?: 'tech' | 'industry' | 'compliance'
    relevanceScore?: number
    priorityLevel?: 'high' | 'medium' | 'low'
  },
): Promise<RadarPush> {
  const repo = dataSource.getRepository(RadarPush)

  // 先创建依赖的AnalyzedContent
  const analyzedContent = await createTestAnalyzedContent(dataSource, {
    tenantId: data.tenantId,
    category: data.radarType || 'tech',
  })

  const radarPush = await repo.save({
    tenantId: data.tenantId,
    organizationId: data.organizationId,
    radarType: data.radarType || 'tech',
    contentId: analyzedContent.id,
    relevanceScore: data.relevanceScore || 0.8,
    priorityLevel: data.priorityLevel || 'high',
    scheduledAt: new Date(),
    status: 'scheduled',
  })

  return radarPush
}

/**
 * 创建测试用的Tenant
 */
export async function createTestTenant(
  dataSource: DataSource,
  data?: {
    name?: string
    subscriptionTier?: 'basic' | 'pro'
    isActive?: boolean
  },
): Promise<Tenant> {
  const repo = dataSource.getRepository(Tenant)

  const tenant = await repo.save({
    name: data?.name || `Test Tenant ${Date.now()}`,
    subscriptionTier: data?.subscriptionTier || 'basic',
    isActive: data?.isActive !== undefined ? data.isActive : true,
  })

  return tenant
}

/**
 * 创建测试用的Organization
 */
export async function createTestOrganization(
  dataSource: DataSource,
  data: {
    tenantId: string
    name?: string
    radarActivated?: boolean
  },
): Promise<Organization> {
  const repo = dataSource.getRepository(Organization)

  const organization = await repo.save({
    name: data.name || `Test Organization ${Date.now()}`,
    tenantId: data.tenantId,
    radarActivated: data.radarActivated !== undefined ? data.radarActivated : true,
  })

  return organization
}

/**
 * 清理测试数据
 */
export async function cleanupTestData(
  dataSource: DataSource,
  options?: {
    tenantIds?: string[]
    sources?: string[]
  },
): Promise<void> {
  try {
    // 按依赖顺序清理
    if (options?.sources) {
      await dataSource.query(
        `DELETE FROM radar_pushes WHERE "contentId" IN (
          SELECT id FROM analyzed_contents WHERE "contentId" IN (
            SELECT id FROM raw_contents WHERE source = ANY($1)
          )
        )`,
        [options.sources],
      )
      await dataSource.query(
        `DELETE FROM analyzed_contents WHERE "contentId" IN (
          SELECT id FROM raw_contents WHERE source = ANY($1)
        )`,
        [options.sources],
      )
      await dataSource.query(`DELETE FROM raw_contents WHERE source = ANY($1)`, [options.sources])
    }

    if (options?.tenantIds) {
      await dataSource.query(`DELETE FROM radar_pushes WHERE "tenantId" = ANY($1::uuid[])`, [
        options.tenantIds,
      ])
      await dataSource.query(`DELETE FROM analyzed_contents WHERE "tenantId" = ANY($1::uuid[])`, [
        options.tenantIds,
      ])
      await dataSource.query(`DELETE FROM raw_contents WHERE "tenantId" = ANY($1::uuid[])`, [
        options.tenantIds,
      ])
      await dataSource.query(
        `DELETE FROM organizations WHERE "tenant_id" = ANY($1::uuid[])`,
        [options.tenantIds],
      )
      await dataSource.query(`DELETE FROM tenants WHERE id = ANY($1::uuid[])`, [options.tenantIds])
    }
  } catch (error) {
    console.warn('Cleanup warning:', error.message)
  }
}
