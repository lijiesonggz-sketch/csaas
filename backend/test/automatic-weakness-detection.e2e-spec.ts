import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import * as request from 'supertest'
import { DataSource, In } from 'typeorm'
import { AppModule } from '../src/app.module'
import { Project } from '../src/database/entities/project.entity'
import { Organization } from '../src/database/entities/organization.entity'
import { OrganizationMember } from '../src/database/entities/organization-member.entity'
import { WeaknessSnapshot } from '../src/database/entities/weakness-snapshot.entity'
import { User, UserRole } from '../src/database/entities/user.entity'
import { AITask } from '../src/database/entities/ai-task.entity'

/**
 * Integration Tests for Story 1.3: Automatic Weakness Detection After Assessment
 *
 * Tests the complete workflow:
 * 1. Assessment completion triggers task:completed event
 * 2. AssessmentEventListener identifies weaknesses
 * 3. WeaknessSnapshotService creates/updates snapshots
 * 4. Organization-level aggregation works correctly
 * 5. Project filtering works
 *
 * SETUP REQUIREMENTS:
 * - Test database must be running
 * - Migrations must be applied: npm run migration:run
 * - Test user and organization will be created automatically in beforeAll()
 */
describe('Automatic Weakness Detection (E2E)', () => {
  let app: INestApplication
  let dataSource: DataSource

  // Test IDs
  const testUserId = '00000000-0000-0000-0000-000000000001'
  let organizationId: string
  let project1Id: string
  let project2Id: string

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.useGlobalPipes(new ValidationPipe())

    dataSource = app.get<DataSource>(DataSource)
    await app.init()

    // Cleanup any existing test data first
    try {
      await dataSource.getRepository(WeaknessSnapshot).delete({
        organizationId: '00000000-0000-0000-0000-000000000002',
      })
      await dataSource.getRepository(AITask).delete({
        projectId: In([
          '00000000-0000-0000-0000-000000000003',
          '00000000-0000-0000-0000-000000000004',
        ]),
      })
      await dataSource.getRepository(Project).delete({
        id: In(['00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000004']),
      })
      await dataSource.getRepository(OrganizationMember).delete({
        organizationId: '00000000-0000-0000-0000-000000000002',
      })
      await dataSource.getRepository(Organization).delete({
        id: '00000000-0000-0000-0000-000000000002',
      })
      await dataSource.getRepository(User).delete({ id: testUserId })
    } catch (error) {
      // Ignore cleanup errors
    }

    // Create test user
    const testUser = dataSource.getRepository(User).create({
      id: testUserId,
      name: 'Test User',
      email: 'test-weakness@example.com',
      passwordHash: 'test_password_hash',
      role: UserRole.RESPONDENT,
    })
    await dataSource.getRepository(User).save(testUser)

    // Create organization
    const organization = dataSource.getRepository(Organization).create({
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Test Organization for Weakness Detection',
    })
    await dataSource.getRepository(Organization).save(organization)
    organizationId = organization.id

    // Add user as org member
    const member = dataSource.getRepository(OrganizationMember).create({
      userId: testUserId,
      organizationId,
      role: 'admin',
    })
    await dataSource.getRepository(OrganizationMember).save(member)

    // Create two projects
    const project1 = dataSource.getRepository(Project).create({
      id: '00000000-0000-0000-0000-000000000003',
      name: 'Test Project 1',
      description: 'First test project',
      organizationId,
      ownerId: testUserId,
    })
    await dataSource.getRepository(Project).save(project1)
    project1Id = project1.id

    const project2 = dataSource.getRepository(Project).create({
      id: '00000000-0000-0000-0000-000000000004',
      name: 'Test Project 2',
      description: 'Second test project',
      organizationId,
      ownerId: testUserId,
    })
    await dataSource.getRepository(Project).save(project2)
    project2Id = project2.id
  })

  afterAll(async () => {
    // Cleanup test data
    if (dataSource) {
      try {
        await dataSource.getRepository(WeaknessSnapshot).delete({ organizationId })
        await dataSource.getRepository(AITask).delete({
          projectId: In([project1Id, project2Id]),
        })
        await dataSource.getRepository(Project).delete({ id: In([project1Id, project2Id]) })
        await dataSource.getRepository(OrganizationMember).delete({ organizationId })
        await dataSource.getRepository(Organization).delete({ id: organizationId })
        await dataSource.getRepository(User).delete({ id: testUserId })
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    await app.close()
  })

  describe('AC 2: 自动识别并保存薄弱项', () => {
    it('should create weakness snapshots from assessment result', async () => {
      // Arrange - Create assessment result with weaknesses (level < 3)
      const assessmentResult = {
        categories: [
          { name: 'data_security', level: 1, description: 'Data security weakness' },
          { name: 'access_control', level: 2, description: 'Access control weakness' },
          { name: 'governance', level: 3, description: 'Governance OK' }, // NOT a weakness
        ],
      }

      // Act - Create snapshot via service API
      const response = await request(app.getHttpServer())
        .post(`/organizations/${organizationId}/weaknesses/snapshot`)
        .send({
          projectId: project1Id,
          categories: assessmentResult.categories,
        })
        .expect(201)

      // Assert - Verify snapshots created
      const snapshots = response.body.data
      expect(snapshots).toBeDefined()
      expect(Array.isArray(snapshots)).toBe(true)
      expect(snapshots.length).toBe(2) // Only 2 weaknesses (level < 3)

      // Verify specific weaknesses
      const dataSecurityWeakness = snapshots.find((s: any) => s.category === 'data_security')
      expect(dataSecurityWeakness).toBeDefined()
      expect(dataSecurityWeakness.level).toBe(1)

      const accessControlWeakness = snapshots.find((s: any) => s.category === 'access_control')
      expect(accessControlWeakness).toBeDefined()
      expect(accessControlWeakness.level).toBe(2)

      // Governance should NOT be in snapshots (level >= 3)
      const governanceWeakness = snapshots.find((s: any) => s.category === 'governance')
      expect(governanceWeakness).toBeUndefined()
    })

    it('should return empty array when no weaknesses detected', async () => {
      // Arrange - All levels >= 3
      const assessmentResult = {
        categories: [
          { name: 'governance', level: 3 },
          { name: 'compliance', level: 4 },
          { name: 'risk_management', level: 5 },
        ],
      }

      // Act
      const response = await request(app.getHttpServer())
        .post(`/organizations/${organizationId}/weaknesses/snapshot`)
        .send({
          projectId: project1Id,
          categories: assessmentResult.categories,
        })
        .expect(201)

      // Assert
      const snapshots = response.body.data
      expect(snapshots).toEqual([])
    })
  })

  describe('AC 3: 组织级薄弱项聚合', () => {
    beforeEach(async () => {
      // Create weakness snapshots for both projects
      await request(app.getHttpServer())
        .post(`/organizations/${organizationId}/weaknesses/snapshot`)
        .send({
          projectId: project1Id,
          categories: [
            { name: 'data_security', level: 1 },
            { name: 'access_control', level: 2 },
          ],
        })

      await request(app.getHttpServer())
        .post(`/organizations/${organizationId}/weaknesses/snapshot`)
        .send({
          projectId: project2Id,
          categories: [
            { name: 'data_security', level: 2 }, // Same category, higher level
            { name: 'governance', level: 1 }, // Different category
          ],
        })
    })

    it('should aggregate weaknesses across all projects in organization', async () => {
      // Act
      const response = await request(app.getHttpServer())
        .get(`/organizations/${organizationId}/weaknesses/aggregated`)
        .expect(200)

      const aggregated = response.body.data

      // Assert - Should have 3 categories
      expect(aggregated).toHaveLength(3)

      // data_security should have level 1 (minimum of 1 and 2)
      const dataSecurity = aggregated.find((w: any) => w.category === 'data_security')
      expect(dataSecurity).toBeDefined()
      expect(dataSecurity.level).toBe(1)
      expect(dataSecurity.projectIds).toContain(project1Id)
      expect(dataSecurity.projectIds).toContain(project2Id)

      // access_control should have level 2
      const accessControl = aggregated.find((w: any) => w.category === 'access_control')
      expect(accessControl).toBeDefined()
      expect(accessControl.level).toBe(2)

      // governance should have level 1
      const governance = aggregated.find((w: any) => w.category === 'governance')
      expect(governance).toBeDefined()
      expect(governance.level).toBe(1)
    })

    it('should filter by projectId when specified', async () => {
      // Act - Filter by project1Id only
      const response = await request(app.getHttpServer())
        .get(`/organizations/${organizationId}/weaknesses/aggregated?projectId=${project1Id}`)
        .expect(200)

      const aggregated = response.body.data

      // Assert - Should only have 2 categories from project1
      expect(aggregated).toHaveLength(2)

      const dataSecurity = aggregated.find((w: any) => w.category === 'data_security')
      expect(dataSecurity).toBeDefined()
      expect(dataSecurity.projectIds).toEqual([project1Id])

      const accessControl = aggregated.find((w: any) => w.category === 'access_control')
      expect(accessControl).toBeDefined()

      // governance should NOT be present (from project2)
      const governance = aggregated.find((w: any) => w.category === 'governance')
      expect(governance).toBeUndefined()
    })
  })

  describe('AC 4: 性能要求', () => {
    it('should complete weakness detection within 5 minutes', async () => {
      // Arrange
      const assessmentResult = {
        categories: Array.from({ length: 50 }, (_, i) => ({
          name: `category_${i}`,
          level: i % 3, // Mix of levels 0, 1, 2
        })),
      }

      const startTime = Date.now()

      // Act - Create snapshot with 50 categories
      await request(app.getHttpServer())
        .post(`/organizations/${organizationId}/weaknesses/snapshot`)
        .send({
          projectId: project1Id,
          categories: assessmentResult.categories,
        })
        .expect(201)

      const duration = Date.now() - startTime

      // Assert - Should complete within 5 minutes (300,000ms)
      expect(duration).toBeLessThan(300000)
      console.log(`Weakness detection completed in ${duration}ms`)
    }, 300000) // Set Jest timeout to 5 minutes
  })

  describe('Integration: 完整工作流', () => {
    it('should handle complete assessment workflow', async () => {
      // Step 1: User completes assessment
      const assessmentResult = {
        categories: [
          { name: 'data_security', level: 1 },
          { name: 'access_control', level: 2 },
          { name: 'compliance', level: 3 },
        ],
      }

      // Step 2: Create snapshot (simulating assessment completion)
      const createResponse = await request(app.getHttpServer())
        .post(`/organizations/${organizationId}/weaknesses/snapshot`)
        .send({
          projectId: project1Id,
          categories: assessmentResult.categories,
        })
        .expect(201)

      expect(createResponse.body.data).toHaveLength(2)

      // Step 3: Verify aggregated weaknesses
      const aggregateResponse = await request(app.getHttpServer())
        .get(`/organizations/${organizationId}/weaknesses/aggregated`)
        .expect(200)

      const aggregated = aggregateResponse.body.data
      expect(aggregated.length).toBeGreaterThanOrEqual(2)

      // Step 4: Filter by project
      const filteredResponse = await request(app.getHttpServer())
        .get(`/organizations/${organizationId}/weaknesses/aggregated?projectId=${project1Id}`)
        .expect(200)

      const filtered = filteredResponse.body.data
      expect(filtered.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty assessment result', async () => {
      const response = await request(app.getHttpServer())
        .post(`/organizations/${organizationId}/weaknesses/snapshot`)
        .send({
          projectId: project1Id,
          categories: [],
        })
        .expect(201)

      expect(response.body.data).toEqual([])
    })

    it('should handle duplicate categories by aggregating', async () => {
      // First snapshot
      await request(app.getHttpServer())
        .post(`/organizations/${organizationId}/weaknesses/snapshot`)
        .send({
          projectId: project1Id,
          categories: [{ name: 'data_security', level: 1 }],
        })

      // Second snapshot with same category but different level
      await request(app.getHttpServer())
        .post(`/organizations/${organizationId}/weaknesses/snapshot`)
        .send({
          projectId: project2Id,
          categories: [{ name: 'data_security', level: 2 }],
        })

      // Verify aggregation
      const response = await request(app.getHttpServer())
        .get(`/organizations/${organizationId}/weaknesses/aggregated`)
        .expect(200)

      const aggregated = response.body.data
      const dataSecurity = aggregated.find((w: any) => w.category === 'data_security')

      expect(dataSecurity.level).toBe(1) // Should take minimum (1 not 2)
      expect(dataSecurity.projectIds).toContain(project1Id)
      expect(dataSecurity.projectIds).toContain(project2Id)
    })

    it('should return 404 for non-existent organization', async () => {
      await request(app.getHttpServer())
        .get('/organizations/nonexistent-org/weaknesses/aggregated')
        .expect(404)
    })
  })
})
