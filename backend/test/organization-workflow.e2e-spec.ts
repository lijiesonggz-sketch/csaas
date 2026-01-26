import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import * as request from 'supertest'
import { DataSource, In } from 'typeorm'
import { AppModule } from '../src/app.module'
import { Project } from '../src/database/entities/project.entity'
import { Organization } from '../src/database/entities/organization.entity'
import { OrganizationMember } from '../src/database/entities/organization-member.entity'
import { WeaknessSnapshot } from '../src/database/entities/weakness-snapshot.entity'
import { User } from '../src/database/entities/user.entity'

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
  let firstProjectId: string
  let secondProjectId: string
  let organizationId: string

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.useGlobalPipes(new ValidationPipe())

    // Get DataSource for database cleanup
    dataSource = app.get<DataSource>(DataSource)

    await app.init()

    // Create test user
    const testUser = dataSource.getRepository(User).create({
      id: testUserId,
      name: 'Test Integration User',
      email: 'test-integration@example.com',
    })
    await dataSource.getRepository(User).save(testUser)
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

    // Clean up in correct order due to foreign keys
    await dataSource.getRepository(WeaknessSnapshot).delete({
      organizationId,
    })
    await dataSource.getRepository(OrganizationMember).delete({
      organizationId,
    })
    await dataSource.getRepository(Project).delete({
      id: In([firstProjectId, secondProjectId]),
    })
    await dataSource.getRepository(Organization).delete({ id: organizationId })

    // Clean up test user
    await dataSource.getRepository(User).delete({ id: testUserId })
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
        .set('x-user-id', testUserId)
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
        .set('x-user-id', testUserId)
        .expect(200)

      const organization = orgResponse.body.data
      expect(organization).toBeDefined()
      expect(organization.id).toBe(organizationId)
      expect(organization.name).toContain('组织') // Chinese for "Organization"

      // Assert - User is admin member
      const membersResponse = await request(app.getHttpServer())
        .get(`/organizations/${organizationId}/members`)
        .set('x-user-id', testUserId)
        .expect(200)

      const members = membersResponse.body.data
      expect(members).toHaveLength(1)
      expect(members[0].userId).toBe(testUserId)
      expect(members[0].role).toBe('admin')
    })
  })

  describe('AC 1.2: Second Project Reuses Organization', () => {
    it('should reuse existing organization for user\'s second project', async () => {
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
        .set('x-user-id', testUserId)
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
        .set('x-user-id', testUserId)
        .expect(200)

      const userOrgs = userOrgsResponse.body.data
      expect(userOrgs).toHaveLength(1)
      expect(userOrgs[0].id).toBe(organizationId)
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
        .set('x-user-id', testUserId)
        .send(assessmentResult)
        .expect(201)

      const snapshots = snapshotResponse.body
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
        .set('x-user-id', testUserId)
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
        .set('x-user-id', testUserId)
        .send({
          projectId: firstProjectId,
          categories: [
            {
              name: 'access_control',
              level: 2,
            },
          ],
        })
        .expect(201)

      // Act - Get aggregated weaknesses
      const aggregatedResponse = await request(app.getHttpServer())
        .get(`/organizations/${organizationId}/weaknesses/aggregated`)
        .set('x-user-id', testUserId)
        .expect(200)

      const aggregated = aggregatedResponse.body.data

      // Assert - Should have 2 categories (data_security and access_control)
      expect(aggregated).toHaveLength(2)

      // Assert - data_security should have level 1 (minimum of the two)
      const dataSecurity = aggregated.find((w: any) => w.category === 'data_security')
      expect(dataSecurity).toBeDefined()
      expect(dataSecurity.level).toBe(1)
      expect(dataSecurity.projectIds).toContain(firstProjectId)
      expect(dataSecurity.projectIds).toContain(secondProjectId)

      // Assert - access_control should have level 2
      const accessControl = aggregated.find((w: any) => w.category === 'access_control')
      expect(accessControl).toBeDefined()
      expect(accessControl.level).toBe(2)
    })
  })

  describe('API Endpoint Validation', () => {
    it.skip('should return 401 for unauthorized requests', async () => {
      // TODO: Skip until auth guards are implemented
      await request(app.getHttpServer())
        .get('/organizations/me')
        .expect(401)
    })

    it('should return paginated results for organization projects', async () => {
      const response = await request(app.getHttpServer())
        .get(`/organizations/${organizationId}/projects?page=1&limit=10`)
        .set('x-user-id', testUserId)
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
        .set('x-user-id', testUserId)
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
        .set('x-user-id', testUserId)
        .expect(400)

      // Invalid limit (> 100)
      await request(app.getHttpServer())
        .get(`/organizations/${organizationId}/projects?page=1&limit=101`)
        .set('x-user-id', testUserId)
        .expect(400)
    })
  })
})
