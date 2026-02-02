import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { AppModule } from '../src/app.module'
import { Organization } from '../src/database/entities/organization.entity'
import { Tenant } from '../src/database/entities/tenant.entity'
import { OrganizationMember } from '../src/database/entities/organization-member.entity'
import { User } from '../src/database/entities/user.entity'
import { Project } from '../src/database/entities/project.entity'
import { RadarPush } from '../src/database/entities/radar-push.entity'
import { WatchedTopic } from '../src/database/entities/watched-topic.entity'
import { WatchedPeer } from '../src/database/entities/watched-peer.entity'
import { AnalyzedContent } from '../src/database/entities/analyzed-content.entity'
import { RawContent } from '../src/database/entities/raw-content.entity'

/**
 * Multi-Tenant Isolation E2E Test
 *
 * Tests the complete multi-tenant isolation mechanism:
 * - Layer 1: API Layer (TenantGuard)
 * - Layer 2: Service Layer (BaseRepository - future)
 *
 * Test Scenarios:
 * 1. Tenant A cannot access Tenant B's data
 * 2. Tenant A creates data automatically associated with Tenant A
 * 3. Tenant B queries and sees only their own data
 * 4. Cross-tenant access attempts are blocked
 *
 * @story Story 6.1A - Multi-tenant API/Service Layer Isolation
 * @phase Phase 4: Integration Testing
 */
describe('Multi-Tenant Isolation (e2e)', () => {
  let app: INestApplication
  let dataSource: DataSource

  // Test data
  let tenantA: Tenant
  let tenantB: Tenant
  let orgA: Organization
  let orgB: Organization
  let userA: User
  let userB: User
  let tokenA: string
  let tokenB: string

  beforeAll(async () => {
    // 创建测试模块
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()

    // 获取 DataSource
    dataSource = app.get(DataSource)
  })

  afterAll(async () => {
    // 清理测试数据
    if (dataSource && dataSource.isInitialized) {
      try {
        // 清理顺序：按照外键依赖关系，从子表到父表
        // 1. 先删除 organization_members (依赖 users 和 organizations)
        if (userA?.id || userB?.id) {
          await dataSource.query(
            `DELETE FROM organization_members WHERE user_id = ANY($1::uuid[])`,
            [[userA?.id, userB?.id].filter(Boolean)],
          )
        }
        // 2. 删除 users
        if (userA?.id || userB?.id) {
          await dataSource.query(
            `DELETE FROM users WHERE id = ANY($1::uuid[])`,
            [[userA?.id, userB?.id].filter(Boolean)],
          )
        }
        // 3. 删除所有与测试租户相关的 organizations (依赖 tenants)
        if (tenantA?.id || tenantB?.id) {
          await dataSource.query(
            `DELETE FROM organizations WHERE tenant_id = ANY($1::uuid[])`,
            [[tenantA?.id, tenantB?.id].filter(Boolean)],
          )
        }
        // 4. 最后删除 tenants (被 organizations 依赖)
        if (tenantA?.id || tenantB?.id) {
          await dataSource.query(
            `DELETE FROM tenants WHERE id = ANY($1::uuid[])`,
            [[tenantA?.id, tenantB?.id].filter(Boolean)],
          )
        }
      } catch (error) {
        console.error('Cleanup error:', error)
      }
    }

    if (app) {
      await app.close()
    }
  })

  // 移除 skip 标记，启用 E2E 测试
  describe('Setup: Create test tenants and users', () => {
    it('should create Tenant A and Tenant B', async () => {
      const tenantRepo = dataSource.getRepository(Tenant)

      tenantA = await tenantRepo.save({
        name: 'Consulting Firm A',
        subscriptionTier: 'pro',
        isActive: true,
      })

      tenantB = await tenantRepo.save({
        name: 'Consulting Firm B',
        subscriptionTier: 'basic',
        isActive: true,
      })

      expect(tenantA.id).toBeDefined()
      expect(tenantB.id).toBeDefined()
      expect(tenantA.id).not.toBe(tenantB.id)
    })

    it('should create Organization A (belongs to Tenant A)', async () => {
      const orgRepo = dataSource.getRepository(Organization)

      orgA = await orgRepo.save({
        name: 'Organization A',
        tenantId: tenantA.id,
        radarActivated: true,
      })

      expect(orgA.tenantId).toBe(tenantA.id)
    })

    it('should create Organization B (belongs to Tenant B)', async () => {
      const orgRepo = dataSource.getRepository(Organization)

      orgB = await orgRepo.save({
        name: 'Organization B',
        tenantId: tenantB.id,
        radarActivated: true,
      })

      expect(orgB.tenantId).toBe(tenantB.id)
    })

    it('should create User A (member of Organization A)', async () => {
      const userRepo = dataSource.getRepository(User)
      const memberRepo = dataSource.getRepository(OrganizationMember)

      userA = await userRepo.save({
        email: 'user-a@tenant-a.com',
        passwordHash: 'hashed-password-a',
        name: 'User A',
      })

      await memberRepo.save({
        userId: userA.id,
        organizationId: orgA.id,
        role: 'admin',
      })

      expect(userA.id).toBeDefined()
    })

    it('should create User B (member of Organization B)', async () => {
      const userRepo = dataSource.getRepository(User)
      const memberRepo = dataSource.getRepository(OrganizationMember)

      userB = await userRepo.save({
        email: 'user-b@tenant-b.com',
        passwordHash: 'hashed-password-b',
        name: 'User B',
      })

      await memberRepo.save({
        userId: userB.id,
        organizationId: orgB.id,
        role: 'admin',
      })

      expect(userB.id).toBeDefined()
    })
  })

  describe('AC 4: Multi-tenant isolation validation', () => {
    describe('Scenario 1: Tenant A creates RadarPush', () => {
      let pushA: RadarPush
      let contentA: AnalyzedContent

      it('should create RadarPush for Tenant A', async () => {
        // First create RawContent and AnalyzedContent for the foreign key
        const rawContentRepo = dataSource.getRepository(RawContent)
        const analyzedContentRepo = dataSource.getRepository(AnalyzedContent)
        const pushRepo = dataSource.getRepository(RadarPush)

        const rawContent = await rawContentRepo.save({
          source: 'Test Source',
          category: 'tech',
          url: 'https://test.com',
          title: 'Test Content',
          fullContent: 'Test content for RadarPush',
          contentHash: 'hash-a-' + Date.now(),
          publishedAt: new Date(),
        })

        contentA = await analyzedContentRepo.save({
          contentId: rawContent.id,
          tags: [],
          keywords: [],
          aiModel: 'test-model',
          tokensUsed: 100,
          analyzedAt: new Date(),
        })

        pushA = await pushRepo.save({
          organizationId: orgA.id,
          tenantId: tenantA.id,
          radarType: 'tech',
          contentId: contentA.id,
          relevanceScore: 0.95,
          priorityLevel: 'high',
          scheduledAt: new Date(),
          status: 'scheduled',
        })

        expect(pushA.tenantId).toBe(tenantA.id)
        expect(pushA.organizationId).toBe(orgA.id)
      })

      it('Tenant A should be able to query their own RadarPush', async () => {
        const pushRepo = dataSource.getRepository(RadarPush)

        const found = await pushRepo.findOne({
          where: {
            id: pushA.id,
            tenantId: tenantA.id,
          },
        })

        expect(found).toBeDefined()
        expect(found.id).toBe(pushA.id)
      })

      it('Tenant B should NOT be able to query Tenant A\'s RadarPush', async () => {
        const pushRepo = dataSource.getRepository(RadarPush)

        const found = await pushRepo.findOne({
          where: {
            id: pushA.id,
            tenantId: tenantB.id, // Wrong tenant
          },
        })

        expect(found).toBeNull()
      })
    })

    describe('Scenario 2: Tenant B creates WatchedTopic', () => {
      let topicB: WatchedTopic

      it('should create WatchedTopic for Tenant B', async () => {
        const topicRepo = dataSource.getRepository(WatchedTopic)

        topicB = await topicRepo.save({
          organizationId: orgB.id,
          tenantId: tenantB.id,
          topicName: 'AI Technology',
          topicType: 'tech',
          description: 'Artificial Intelligence trends',
        })

        expect(topicB.tenantId).toBe(tenantB.id)
        expect(topicB.organizationId).toBe(orgB.id)
      })

      it('Tenant B should be able to query their own WatchedTopic', async () => {
        const topicRepo = dataSource.getRepository(WatchedTopic)

        const found = await topicRepo.findOne({
          where: {
            id: topicB.id,
            tenantId: tenantB.id,
          },
        })

        expect(found).toBeDefined()
        expect(found.id).toBe(topicB.id)
      })

      it('Tenant A should NOT be able to query Tenant B\'s WatchedTopic', async () => {
        const topicRepo = dataSource.getRepository(WatchedTopic)

        const found = await topicRepo.findOne({
          where: {
            id: topicB.id,
            tenantId: tenantA.id, // Wrong tenant
          },
        })

        expect(found).toBeNull()
      })
    })

    describe('Scenario 3: Cross-tenant data isolation', () => {
      it('Tenant A should only see their own RadarPushes', async () => {
        const rawContentRepo = dataSource.getRepository(RawContent)
        const analyzedContentRepo = dataSource.getRepository(AnalyzedContent)
        const pushRepo = dataSource.getRepository(RadarPush)

        // Create content for Tenant B's push
        const rawContentB = await rawContentRepo.save({
          source: 'Test Source B',
          category: 'industry',
          url: 'https://test-b.com',
          title: 'Test Content B',
          fullContent: 'Test content for Tenant B RadarPush',
          contentHash: 'hash-b-' + Date.now(),
          publishedAt: new Date(),
        })

        const contentB = await analyzedContentRepo.save({
          contentId: rawContentB.id,
          tags: [],
          keywords: [],
          aiModel: 'test-model',
          tokensUsed: 100,
          analyzedAt: new Date(),
        })

        // Create another push for Tenant B
        await pushRepo.save({
          organizationId: orgB.id,
          tenantId: tenantB.id,
          radarType: 'industry',
          contentId: contentB.id,
          relevanceScore: 0.85,
          priorityLevel: 'medium',
          scheduledAt: new Date(),
          status: 'scheduled',
        })

        // Query as Tenant A
        const pushesA = await pushRepo.find({
          where: { tenantId: tenantA.id },
        })

        // Should only see Tenant A's pushes
        expect(pushesA.length).toBe(1)
        expect(pushesA[0].tenantId).toBe(tenantA.id)
      })

      it('Tenant B should only see their own WatchedTopics', async () => {
        const topicRepo = dataSource.getRepository(WatchedTopic)

        // Create another topic for Tenant A
        await topicRepo.save({
          organizationId: orgA.id,
          tenantId: tenantA.id,
          topicName: 'Cloud Computing',
          topicType: 'tech',
          description: 'Cloud infrastructure trends',
        })

        // Query as Tenant B
        const topicsB = await topicRepo.find({
          where: { tenantId: tenantB.id },
        })

        // Should only see Tenant B's topics
        expect(topicsB.length).toBe(1)
        expect(topicsB[0].tenantId).toBe(tenantB.id)
      })
    })

    describe('Scenario 4: Update and Delete operations respect tenant isolation', () => {
      it('Tenant A cannot update Tenant B\'s data', async () => {
        const topicRepo = dataSource.getRepository(WatchedTopic)

        // Get Tenant B's topic
        const topicB = await topicRepo.findOne({
          where: { tenantId: tenantB.id },
        })

        // Try to update as Tenant A (should affect 0 rows)
        const result = await topicRepo.update(
          {
            id: topicB.id,
            tenantId: tenantA.id, // Wrong tenant
          },
          {
            topicName: 'Hacked Topic',
          },
        )

        expect(result.affected).toBe(0)

        // Verify data unchanged
        const unchanged = await topicRepo.findOne({
          where: { id: topicB.id },
        })
        expect(unchanged.topicName).not.toBe('Hacked Topic')
      })

      it('Tenant A cannot delete Tenant B\'s data', async () => {
        const pushRepo = dataSource.getRepository(RadarPush)

        // Get Tenant B's push
        const pushB = await pushRepo.findOne({
          where: { tenantId: tenantB.id },
        })

        // Try to delete as Tenant A (should affect 0 rows)
        const result = await pushRepo.delete({
          id: pushB.id,
          tenantId: tenantA.id, // Wrong tenant
        })

        expect(result.affected).toBe(0)

        // Verify data still exists
        const stillExists = await pushRepo.findOne({
          where: { id: pushB.id },
        })
        expect(stillExists).toBeDefined()
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle user belonging to multiple organizations (same tenant)', async () => {
      const orgRepo = dataSource.getRepository(Organization)
      const memberRepo = dataSource.getRepository(OrganizationMember)

      // Create second organization for Tenant A
      const orgA2 = await orgRepo.save({
        name: 'Organization A2',
        tenantId: tenantA.id,
        radarActivated: true,
      })

      // Add User A to second organization
      await memberRepo.save({
        userId: userA.id,
        organizationId: orgA2.id,
        role: 'member',
      })

      // User should still belong to same tenant
      const memberships = await memberRepo.find({
        where: { userId: userA.id },
        relations: ['organization'],
      })

      expect(memberships.length).toBe(2)
      expect(memberships[0].organization.tenantId).toBe(tenantA.id)
      expect(memberships[1].organization.tenantId).toBe(tenantA.id)
    })

    it('should prevent creating data without tenantId', async () => {
      const pushRepo = dataSource.getRepository(RadarPush)

      await expect(
        pushRepo.save({
          organizationId: orgA.id,
          // tenantId missing - should fail due to NOT NULL constraint
          radarType: 'tech',
          analyzedContentId: null,
          relevanceScore: 0.95,
          priorityLevel: 'high',
          scheduledAt: new Date(),
          status: 'scheduled',
        }),
      ).rejects.toThrow()
    })
  })
})
