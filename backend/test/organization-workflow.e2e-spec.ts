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
import { getDefaultAuthHeaders, getAuthHeaders } from './helpers/auth.helper'
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor'

/**
 * Integration Tests for Story 1.1: Organization Auto-Creation
 *
 * Tests the complete workflow:
 * 1. User creates first project → Organization auto-created
 * 2. User creates second project → Reuses existing organization
 * 3. Assessment completes → WeaknessSnapshot auto-created
 * 4. Weakness aggregation across projects
 *
 * SETUP REQUIREMENTS:
 * - Test database must be running
 * - Migrations must be applied: npm run migration:run
 * - Test user will be created automatically in beforeAll()
 *
 * TODO: Set up CI/CD pipeline with test database
 */
describe('Organization Workflow (E2E)', () => {
  let app: INestApplication
  let dataSource: DataSource

  // Test user and project IDs (using valid UUIDs)
  const testUserId = '00000000-0000-0000-0000-000000000001'
  const testUserEmail = 'test-integration@example.com'
  let firstProjectId: string
  let secondProjectId: string
  let organizationId: string
  let authHeaders: { Authorization: string; 'x-user-id'?: string }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.useGlobalPipes(new ValidationPipe())
    app.useGlobalInterceptors(new TransformInterceptor())

    // Get DataSource for database cleanup
    dataSource = app.get<DataSource>(DataSource)

    await app.init()

    // Create test user with required fields
    const testUser = dataSource.getRepository(User).create({
      id: testUserId,
      name: 'Test Integration User',
      email: testUserEmail,
      passwordHash: 'test_password_hash', // Required field
      role: UserRole.CLIENT_PM,
    })
    await dataSource.getRepository(User).save(testUser)

    // Generate auth headers for test user
    authHeaders = await getAuthHeaders({
      id: testUserId,
      email: testUserEmail,
      role: 'CLIENT_PM',
    })
  })

  afterAll(async () => {
    // Cleanup test data
    if (dataSource && organizationId) {
      await cleanupTestData()
    }
    await app.close()
  })

  async function cleanupTestData() {
    if (!dataSource) return

    try {
      // Clean up in correct order due to foreign keys
      // 1. Delete weakness snapshots (references organization)
      if (organizationId) {
        await dataSource.getRepository(WeaknessSnapshot).delete({
          organizationId,
        })
      }

      // 2. Delete ALL projects for this organization (not just tracked ones)
      if (organizationId) {
        await dataSource.getRepository(Project).delete({
          organizationId,
        })
      }

      // 3. Delete organization members (references organization and user)
      if (organizationId) {
        await dataSource.getRepository(OrganizationMember).delete({
          organizationId,
        })
      }

      // 4. Delete organization
      if (organizationId) {
        await dataSource.getRepository(Organization).delete({ id: organizationId })
      }

      // 5. Finally delete test user (no longer referenced)
      await dataSource.getRepository(User).delete({ id: testUserId })
    } catch (error) {
      console.error('Cleanup error:', error)
      // Don't throw - allow tests to complete
    }
  }

  describe('AC 1.1: First Project Auto-Creates Organization', () => {
    it('should automatically create organization when user creates first project', async () => {
      // Arrange
      const createProjectDto = {
        name: 'Test Project 1',
        description: 'First test project',
        clientName: 'Test Client',
        standardName: 'ISO 27001',
      }

      // Act - Create project via API
      const response = await request(app.getHttpServer())
        .post('/projects')
        .set(authHeaders)
        .send(createProjectDto)
        .expect(201)

      // Assert - Project created
      const project = response.body.data
      expect(project).toBeDefined()
      expect(project.name).toBe(createProjectDto.name)
      expect(project.organizationId).toBeDefined()

      firstProjectId = project.id
      organizationId = project.organizationId

      // Assert - Organization was created
      const orgResponse = await request(app.getHttpServer())
        .get(`/organizations/${organizationId}`)
        .set(authHeaders)
        .expect(200)

      const organization = orgResponse.body.data
      expect(organization).toBeDefined()
      expect(organization.id).toBe(organizationId)
      expect(organization.name).toContain('组织') // Chinese for "Organization"

      // Assert - User is admin member
      const membersResponse = await request(app.getHttpServer())
        .get(`/organizations/${organizationId}/members`)
        .set(authHeaders)
        .expect(200)

      const membersData = membersResponse.body.data
      expect(membersData.data).toBeDefined()
      expect(membersData.data).toHaveLength(1)
      expect(membersData.data[0].userId).toBe(testUserId)
      expect(membersData.data[0].role).toBe('admin')
    })
  })

  describe('AC 1.2: Second Project Reuses Organization', () => {
    it("should reuse existing organization for user's second project", async () => {
      // Arrange
      const createProjectDto = {
        name: 'Test Project 2',
        description: 'Second test project',
        clientName: 'Test Client 2',
        standardName: 'ISO 22301',
      }

      // Act - Create second project
      const response = await request(app.getHttpServer())
        .post('/projects')
        .set(authHeaders)
        .send(createProjectDto)
        .expect(201)

      // Assert - Project created
      const project = response.body.data
      expect(project).toBeDefined()
      expect(project.name).toBe(createProjectDto.name)

      secondProjectId = project.id

      // Assert - Reused same organization
      expect(project.organizationId).toBe(organizationId)

      // Assert - Still only one organization for user
      const userOrgsResponse = await request(app.getHttpServer())
        .get('/organizations/me')
        .set(authHeaders)
        .expect(200)

      const userOrgData = userOrgsResponse.body.data
      expect(userOrgData).toBeDefined()
      expect(userOrgData.organization).toBeDefined()
      expect(userOrgData.organization.id).toBe(organizationId)
      expect(userOrgData.role).toBe('admin')
    })
  })

  describe('AC 1.3 & 1.4: Weakness Snapshot Auto-Creation and Aggregation', () => {
    it('should auto-create weakness snapshot from assessment results', async () => {
      // Arrange - Simulate assessment completion by calling the service
      const assessmentResult = {
        projectId: firstProjectId,
        categories: [
          {
            name: 'data_security',
            level: 2,
          },
        ],
      }

      // Act - Trigger weakness snapshot creation via service
      const snapshotResponse = await request(app.getHttpServer())
        .post(`/organizations/${organizationId}/weaknesses/snapshot`)
        .set(authHeaders)
        .send(assessmentResult)
        .expect(201)

      const snapshots = snapshotResponse.body.data
      expect(snapshots).toBeDefined()
      expect(Array.isArray(snapshots)).toBe(true)
      expect(snapshots.length).toBeGreaterThan(0)
      expect(snapshots[0].category).toBe('data_security')
      expect(snapshots[0].level).toBe(2)
      expect(snapshots[0].organizationId).toBe(organizationId)
    })

    it('should aggregate weaknesses across multiple projects', async () => {
      // Arrange - Create weakness for second project
      await request(app.getHttpServer())
        .post(`/organizations/${organizationId}/weaknesses/snapshot`)
        .set(authHeaders)
        .send({
          projectId: secondProjectId,
          categories: [
            {
              name: 'data_security', // Same category, lower level
              level: 1,
            },
          ],
        })
        .expect(201)

      // Create different category weakness
      await request(app.getHttpServer())
        .post(`/organizations/${organizationId}/weaknesses/snapshot`)
        .set(authHeaders)
        .send({
          projectId: firstProjectId,
          categories: [
            {
              name: 'network_security',
              level: 2,
            },
          ],
        })
        .expect(201)

      // Act - Get aggregated weaknesses
      const aggregatedResponse = await request(app.getHttpServer())
        .get(`/organizations/${organizationId}/weaknesses/aggregated`)
        .set(authHeaders)
        .expect(200)

      const aggregated = aggregatedResponse.body.data

      // Assert - Should have 2 categories (data_security and network_security)
      expect(aggregated.byCategory).toBeDefined()
      expect(Object.keys(aggregated.byCategory)).toHaveLength(2)

      // Assert - data_security should exist
      expect(aggregated.byCategory.data_security).toBeDefined()
      expect(aggregated.byCategory.data_security.count).toBeGreaterThanOrEqual(1)

      // Assert - network_security should exist
      expect(aggregated.byCategory.network_security).toBeDefined()
      expect(aggregated.byCategory.network_security.count).toBeGreaterThanOrEqual(1)
    })
  })

  describe('API Endpoint Validation', () => {
    it.skip('should return 401 for unauthorized requests', async () => {
      // TODO: Skip until auth guards are implemented
      await request(app.getHttpServer()).get('/organizations/me').expect(401)
    })

    it('should return paginated results for organization projects', async () => {
      const response = await request(app.getHttpServer())
        .get(`/organizations/${organizationId}/projects?page=1&limit=10`)
        .set(authHeaders)
        .expect(200)

      const result = response.body.data
      expect(result.data).toBeDefined()
      expect(result.pagination).toBeDefined()
      expect(result.pagination.page).toBe(1)
      expect(result.pagination.limit).toBe(10)
      expect(result.pagination.total).toBeGreaterThanOrEqual(2)
    })

    it('should return paginated results for organization members', async () => {
      const response = await request(app.getHttpServer())
        .get(`/organizations/${organizationId}/members?page=1&limit=10`)
        .set(authHeaders)
        .expect(200)

      const result = response.body.data
      expect(result.data).toBeDefined()
      expect(result.pagination).toBeDefined()
      expect(result.pagination.page).toBe(1)
      expect(result.pagination.limit).toBe(10)
    })

    it('should validate pagination parameters', async () => {
      // Invalid page (< 1)
      await request(app.getHttpServer())
        .get(`/organizations/${organizationId}/projects?page=0&limit=10`)
        .set(authHeaders)
        .expect(400)

      // Invalid limit (> 100)
      await request(app.getHttpServer())
        .get(`/organizations/${organizationId}/projects?page=1&limit=101`)
        .set(authHeaders)
        .expect(400)
    })
  })
})
