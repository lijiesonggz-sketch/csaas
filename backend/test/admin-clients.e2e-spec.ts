import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import { DataSource } from 'typeorm'
import * as request from 'supertest'
import { AppModule } from '../src/app.module'
import { ClientFactory, ClientGroupFactory } from './support/factories'
import { OrganizationFactory } from './support/factories/organization.factory'
import { Tenant } from '../src/database/entities/tenant.entity'
import { User, UserRole } from '../src/database/entities/user.entity'
import * as bcrypt from 'bcrypt'
import * as jwt from 'jsonwebtoken'

/**
 * Story 6.2: 咨询公司批量客户管理后台 - E2E 测试
 *
 * 测试所有客户管理 API 端点
 */
describe('[Story 6.2] Admin Clients Management (E2E)', () => {
  let app: INestApplication
  let dataSource: DataSource
  let clientFactory: ClientFactory
  let clientGroupFactory: ClientGroupFactory
  let organizationFactory: OrganizationFactory

  let testTenant: Tenant
  let adminUser: User
  let adminToken: string

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    await app.init()

    dataSource = moduleFixture.get<DataSource>(DataSource)
    clientFactory = new ClientFactory(dataSource)
    clientGroupFactory = new ClientGroupFactory(dataSource)
    organizationFactory = new OrganizationFactory(dataSource)

    // 创建测试租户
    testTenant = await dataSource.getRepository(Tenant).save({
      name: `Test Tenant ${Date.now()}`,
    })

    // 创建管理员用户
    const passwordHash = await bcrypt.hash('admin123', 10)
    adminUser = await dataSource.getRepository(User).save({
      name: 'Admin User',
      email: `admin-${Date.now()}@example.com`,
      passwordHash,
      role: UserRole.ADMIN,
      tenantId: testTenant.id,
    })

    // 生成 JWT token
    adminToken = jwt.sign(
      { userId: adminUser.id, email: adminUser.email, role: adminUser.role, tenantId: testTenant.id },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' },
    )
  })

  afterAll(async () => {
    // 清理测试数据
    await dataSource.getRepository(User).delete({ id: adminUser.id })
    await dataSource.getRepository(Tenant).delete({ id: testTenant.id })
    await app.close()
  })

  describe('[P1] GET /api/v1/admin/clients - 获取客户列表', () => {
    let testClients: any[]

    beforeAll(async () => {
      // 创建测试客户
      testClients = await clientFactory.createMany(5, { tenantId: testTenant.id })
    })

    afterAll(async () => {
      // 清理测试客户
      await clientFactory.cleanupMany(testClients)
    })

    it('[P1] should return all clients for the tenant', async () => {
      // GIVEN: 管理员已认证
      // WHEN: 请求客户列表
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/clients')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      // THEN: 返回客户列表
      expect(response.body).toBeInstanceOf(Array)
      expect(response.body.length).toBeGreaterThanOrEqual(5)
      expect(response.body[0]).toHaveProperty('id')
      expect(response.body[0]).toHaveProperty('name')
      expect(response.body[0]).toHaveProperty('contactPerson')
      expect(response.body[0]).toHaveProperty('contactEmail')
      expect(response.body[0]).toHaveProperty('industryType')
      expect(response.body[0]).toHaveProperty('scale')
      expect(response.body[0]).toHaveProperty('status')
    })

    it('[P1] should filter clients by status', async () => {
      // GIVEN: 有不同状态的客户
      // WHEN: 按状态筛选
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/clients?status=active')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      // THEN: 只返回 active 状态的客户
      expect(response.body).toBeInstanceOf(Array)
      response.body.forEach((client: any) => {
        expect(client.status).toBe('active')
      })
    })

    it('[P1] should filter clients by industry type', async () => {
      // GIVEN: 有不同行业的客户
      // WHEN: 按行业筛选
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/clients?industryType=banking')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      // THEN: 只返回 banking 行业的客户
      expect(response.body).toBeInstanceOf(Array)
      response.body.forEach((client: any) => {
        expect(client.industryType).toBe('banking')
      })
    })

    it('[P2] should return 401 without authentication', async () => {
      // GIVEN: 未认证
      // WHEN: 请求客户列表
      // THEN: 返回 401
      await request(app.getHttpServer()).get('/api/v1/admin/clients').expect(401)
    })
  })

  describe('[P0] POST /api/v1/admin/clients - 创建客户', () => {
    let createdClientId: string

    afterEach(async () => {
      // 清理创建的客户
      if (createdClientId) {
        await clientFactory.cleanup(createdClientId)
        createdClientId = null
      }
    })

    it('[P0] should create a new client with valid data', async () => {
      // GIVEN: 有效的客户数据
      const clientData = {
        name: 'Test Bank',
        contactPerson: 'John Doe',
        contactEmail: 'john@testbank.com',
        industryType: 'banking',
        scale: 'large',
      }

      // WHEN: 创建客户
      const response = await request(app.getHttpServer())
        .post('/api/v1/admin/clients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(clientData)
        .expect(201)

      // THEN: 返回创建的客户
      expect(response.body).toHaveProperty('id')
      expect(response.body.name).toBe(clientData.name)
      expect(response.body.contactPerson).toBe(clientData.contactPerson)
      expect(response.body.contactEmail).toBe(clientData.contactEmail)
      expect(response.body.industryType).toBe(clientData.industryType)
      expect(response.body.scale).toBe(clientData.scale)
      expect(response.body.status).toBe('active')
      expect(response.body.tenantId).toBe(testTenant.id)

      createdClientId = response.body.id
    })

    it('[P1] should return 400 with invalid email format', async () => {
      // GIVEN: 无效的邮箱格式
      const clientData = {
        name: 'Test Bank',
        contactPerson: 'John Doe',
        contactEmail: 'invalid-email',
        industryType: 'banking',
        scale: 'large',
      }

      // WHEN: 创建客户
      // THEN: 返回 400
      await request(app.getHttpServer())
        .post('/api/v1/admin/clients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(clientData)
        .expect(400)
    })

    it('[P1] should return 400 with missing required fields', async () => {
      // GIVEN: 缺少必填字段
      const clientData = {
        name: 'Test Bank',
        // 缺少 contactPerson, contactEmail
      }

      // WHEN: 创建客户
      // THEN: 返回 400
      await request(app.getHttpServer())
        .post('/api/v1/admin/clients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(clientData)
        .expect(400)
    })
  })

  describe('[P1] GET /api/v1/admin/clients/:id - 获取客户详情', () => {
    let testClient: any

    beforeAll(async () => {
      // 创建测试客户
      testClient = await clientFactory.create({ tenantId: testTenant.id })
    })

    afterAll(async () => {
      // 清理测试客户
      await clientFactory.cleanupAll(testClient)
    })

    it('[P1] should return client details with statistics', async () => {
      // GIVEN: 客户已存在
      // WHEN: 请求客户详情
      const response = await request(app.getHttpServer())
        .get(`/api/v1/admin/clients/${testClient.client.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      // THEN: 返回客户详情和统计数据
      expect(response.body).toHaveProperty('id', testClient.client.id)
      expect(response.body).toHaveProperty('name')
      expect(response.body).toHaveProperty('contactPerson')
      expect(response.body).toHaveProperty('contactEmail')
      expect(response.body).toHaveProperty('weaknessCount')
      expect(response.body).toHaveProperty('watchedTopicCount')
      expect(response.body).toHaveProperty('watchedPeerCount')
    })

    it('[P1] should return 404 for non-existent client', async () => {
      // GIVEN: 客户不存在
      const fakeId = '00000000-0000-0000-0000-000000000000'

      // WHEN: 请求客户详情
      // THEN: 返回 404
      await request(app.getHttpServer())
        .get(`/api/v1/admin/clients/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404)
    })
  })

  describe('[P1] PUT /api/v1/admin/clients/:id - 更新客户', () => {
    let testClient: any

    beforeAll(async () => {
      // 创建测试客户
      testClient = await clientFactory.create({ tenantId: testTenant.id })
    })

    afterAll(async () => {
      // 清理测试客户
      await clientFactory.cleanupAll(testClient)
    })

    it('[P1] should update client information', async () => {
      // GIVEN: 客户已存在
      const updateData = {
        name: 'Updated Bank Name',
        contactPerson: 'Jane Smith',
        scale: 'medium',
      }

      // WHEN: 更新客户
      const response = await request(app.getHttpServer())
        .put(`/api/v1/admin/clients/${testClient.client.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200)

      // THEN: 返回更新后的客户
      expect(response.body.name).toBe(updateData.name)
      expect(response.body.contactPerson).toBe(updateData.contactPerson)
      expect(response.body.scale).toBe(updateData.scale)
    })

    it('[P1] should return 404 for non-existent client', async () => {
      // GIVEN: 客户不存在
      const fakeId = '00000000-0000-0000-0000-000000000000'
      const updateData = { name: 'Updated Name' }

      // WHEN: 更新客户
      // THEN: 返回 404
      await request(app.getHttpServer())
        .put(`/api/v1/admin/clients/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(404)
    })
  })

  describe('[P1] POST /api/v1/admin/clients/bulk-csv - CSV 批量导入', () => {
    let createdClientIds: string[] = []

    afterEach(async () => {
      // 清理创建的客户
      for (const clientId of createdClientIds) {
        await clientFactory.cleanup(clientId)
      }
      createdClientIds = []
    })

    it('[P1] should import clients from CSV file', async () => {
      // GIVEN: 有效的 CSV 数据
      const csvData = clientFactory.createCsvData(3)

      // WHEN: 上传 CSV 文件
      const response = await request(app.getHttpServer())
        .post('/api/v1/admin/clients/bulk-csv')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', Buffer.from(csvData), 'clients.csv')
        .expect(201)

      // THEN: 返回导入结果
      expect(response.body).toHaveProperty('success')
      expect(response.body.success).toBeInstanceOf(Array)
      expect(response.body.success.length).toBe(3)
      expect(response.body).toHaveProperty('failed')
      expect(response.body.failed).toBeInstanceOf(Array)

      // 保存创建的客户 ID 用于清理
      createdClientIds = response.body.success.map((client: any) => client.id)
    })

    it('[P1] should return 400 with invalid CSV format', async () => {
      // GIVEN: 无效的 CSV 数据
      const invalidCsv = 'invalid,csv,format\n1,2'

      // WHEN: 上传 CSV 文件
      // THEN: 返回 400
      await request(app.getHttpServer())
        .post('/api/v1/admin/clients/bulk-csv')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', Buffer.from(invalidCsv), 'clients.csv')
        .expect(400)
    })
  })

  describe('[P1] POST /api/v1/admin/clients/bulk-config - 批量配置', () => {
    let testClients: any[]

    beforeAll(async () => {
      // 创建测试客户
      testClients = await clientFactory.createMany(3, { tenantId: testTenant.id })
    })

    afterAll(async () => {
      // 清理测试客户
      await clientFactory.cleanupMany(testClients)
    })

    it('[P1] should apply bulk configuration to multiple clients', async () => {
      // GIVEN: 多个客户已存在
      const organizationIds = testClients.map((tc) => tc.client.id)
      const configData = {
        organizationIds,
        pushStartTime: '08:00',
        pushEndTime: '20:00',
        maxPushPerDay: 10,
        relevanceFilter: 'high',
      }

      // WHEN: 批量配置
      const response = await request(app.getHttpServer())
        .post('/api/v1/admin/clients/bulk-config')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(configData)
        .expect(200)

      // THEN: 返回配置结果
      expect(response.body).toHaveProperty('updated')
      expect(response.body.updated).toBe(3)
    })

    it('[P1] should return 400 with empty organization IDs', async () => {
      // GIVEN: 空的客户 ID 列表
      const configData = {
        organizationIds: [],
        pushStartTime: '08:00',
        pushEndTime: '20:00',
        maxPushPerDay: 10,
      }

      // WHEN: 批量配置
      // THEN: 返回 400
      await request(app.getHttpServer())
        .post('/api/v1/admin/clients/bulk-config')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(configData)
        .expect(400)
    })
  })

  describe('[P2] POST /api/v1/admin/client-groups - 创建客户分组', () => {
    let createdGroupId: string

    afterEach(async () => {
      // 清理创建的分组
      if (createdGroupId) {
        await clientGroupFactory.cleanup(createdGroupId)
        createdGroupId = null
      }
    })

    it('[P2] should create a new client group', async () => {
      // GIVEN: 有效的分组数据
      const groupData = {
        name: 'Test Group',
        description: 'Test group description',
      }

      // WHEN: 创建分组
      const response = await request(app.getHttpServer())
        .post('/api/v1/admin/client-groups')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(groupData)
        .expect(201)

      // THEN: 返回创建的分组
      expect(response.body).toHaveProperty('id')
      expect(response.body.name).toBe(groupData.name)
      expect(response.body.description).toBe(groupData.description)
      expect(response.body.tenantId).toBe(testTenant.id)

      createdGroupId = response.body.id
    })

    it('[P2] should return 400 with missing name', async () => {
      // GIVEN: 缺少名称
      const groupData = {
        description: 'Test group description',
      }

      // WHEN: 创建分组
      // THEN: 返回 400
      await request(app.getHttpServer())
        .post('/api/v1/admin/client-groups')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(groupData)
        .expect(400)
    })
  })

  describe('[P2] POST /api/v1/admin/client-groups/:id/clients - 添加客户到分组', () => {
    let testGroup: any
    let testClients: any[]

    beforeAll(async () => {
      // 创建测试分组和客户
      testGroup = await clientGroupFactory.create({ tenantId: testTenant.id })
      testClients = await clientFactory.createMany(2, { tenantId: testTenant.id })
    })

    afterAll(async () => {
      // 清理测试数据
      await clientGroupFactory.cleanupAll(testGroup)
      await clientFactory.cleanupMany(testClients)
    })

    it('[P2] should add clients to group', async () => {
      // GIVEN: 分组和客户已存在
      const organizationIds = testClients.map((tc) => tc.client.id)

      // WHEN: 添加客户到分组
      const response = await request(app.getHttpServer())
        .post(`/api/v1/admin/client-groups/${testGroup.group.id}/clients`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ organizationIds })
        .expect(200)

      // THEN: 返回添加结果
      expect(response.body).toHaveProperty('added')
      expect(response.body.added).toBe(2)
    })

    it('[P2] should return 404 for non-existent group', async () => {
      // GIVEN: 分组不存在
      const fakeId = '00000000-0000-0000-0000-000000000000'
      const organizationIds = testClients.map((tc) => tc.client.id)

      // WHEN: 添加客户到分组
      // THEN: 返回 404
      await request(app.getHttpServer())
        .post(`/api/v1/admin/client-groups/${fakeId}/clients`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ organizationIds })
        .expect(404)
    })
  })

  describe('[P0] Multi-tenancy Isolation - 多租户隔离验证', () => {
    let otherTenant: Tenant
    let otherTenantClient: any
    let otherAdminUser: User
    let otherAdminToken: string

    beforeAll(async () => {
      // 创建另一个租户
      otherTenant = await dataSource.getRepository(Tenant).save({
        name: `Other Tenant ${Date.now()}`,
      })

      // 创建另一个租户的客户
      otherTenantClient = await clientFactory.create({ tenantId: otherTenant.id })

      // 创建另一个租户的管理员
      const passwordHash = await bcrypt.hash('admin123', 10)
      otherAdminUser = await dataSource.getRepository(User).save({
        id: `other-admin-${Date.now()}`,
        name: 'Other Admin',
        email: `other-admin-${Date.now()}@example.com`,
        passwordHash,
        role: UserRole.ADMIN,
        tenantId: otherTenant.id,
      })

      // 生成 JWT token
      otherAdminToken = jwt.sign(
        {
          userId: otherAdminUser.id,
          email: otherAdminUser.email,
          role: otherAdminUser.role,
          tenantId: otherTenant.id,
        },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' },
      )
    })

    afterAll(async () => {
      // 清理测试数据
      await clientFactory.cleanupAll(otherTenantClient)
      await dataSource.getRepository(User).delete({ id: otherAdminUser.id })
      await dataSource.getRepository(Tenant).delete({ id: otherTenant.id })
    })

    it('[P0] should not access other tenant clients', async () => {
      // GIVEN: 两个不同租户的管理员
      // WHEN: 租户 A 的管理员请求客户列表
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/clients')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      // THEN: 不应该看到租户 B 的客户
      const clientIds = response.body.map((client: any) => client.id)
      expect(clientIds).not.toContain(otherTenantClient.client.id)
    })

    it('[P0] should not access other tenant client details', async () => {
      // GIVEN: 租户 B 的客户
      // WHEN: 租户 A 的管理员请求租户 B 的客户详情
      // THEN: 返回 404 (因为租户隔离)
      await request(app.getHttpServer())
        .get(`/api/v1/admin/clients/${otherTenantClient.client.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404)
    })

    it('[P0] should not update other tenant clients', async () => {
      // GIVEN: 租户 B 的客户
      const updateData = { name: 'Hacked Name' }

      // WHEN: 租户 A 的管理员尝试更新租户 B 的客户
      // THEN: 返回 404 (因为租户隔离)
      await request(app.getHttpServer())
        .put(`/api/v1/admin/clients/${otherTenantClient.client.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(404)
    })
  })
})
