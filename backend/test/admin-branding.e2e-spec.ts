import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import { DataSource } from 'typeorm'
import * as request from 'supertest'
import { AppModule } from '../src/app.module'
import { BrandingFactory } from './support/factories'
import { Tenant } from '../src/database/entities/tenant.entity'
import { User, UserRole } from '../src/database/entities/user.entity'
import * as bcrypt from 'bcrypt'
import * as jwt from 'jsonwebtoken'
import * as path from 'path'
import * as fs from 'fs'

/**
 * Story 6.3: 白标输出功能 - E2E 测试
 *
 * 测试所有品牌配置 API 端点
 */
describe('[Story 6.3] Admin Branding Management (E2E)', () => {
  let app: INestApplication
  let dataSource: DataSource
  let brandingFactory: BrandingFactory

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
    brandingFactory = new BrandingFactory(dataSource)

    // 创建测试租户
    testTenant = await dataSource.getRepository(Tenant).save({
      name: `Test Tenant ${Date.now()}`,
      brandConfig: {},
    })

    // 创建管理员用户
    const passwordHash = await bcrypt.hash('admin123', 10)
    adminUser = await dataSource.getRepository(User).save({
      id: `admin-${Date.now()}`,
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

  describe('[P1] GET /api/v1/admin/branding - 获取品牌配置', () => {
    it('[P1] should return current branding configuration', async () => {
      // GIVEN: 管理员已认证
      // WHEN: 请求品牌配置
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/branding')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      // THEN: 返回品牌配置
      expect(response.body).toHaveProperty('brandLogoUrl')
      expect(response.body).toHaveProperty('brandPrimaryColor')
      expect(response.body).toHaveProperty('brandSecondaryColor')
      expect(response.body).toHaveProperty('companyName')
      expect(response.body).toHaveProperty('emailSignature')
      expect(response.body).toHaveProperty('contactPhone')
      expect(response.body).toHaveProperty('contactEmail')
    })

    it('[P2] should return 401 without authentication', async () => {
      // GIVEN: 未认证
      // WHEN: 请求品牌配置
      // THEN: 返回 401
      await request(app.getHttpServer()).get('/api/v1/admin/branding').expect(401)
    })
  })

  describe('[P0] PUT /api/v1/admin/branding - 更新品牌配置', () => {
    let brandingTestData: any

    afterEach(async () => {
      // 恢复原始品牌配置
      if (brandingTestData) {
        await brandingFactory.restore(brandingTestData)
        brandingTestData = null
      }
    })

    it('[P0] should update all branding fields', async () => {
      // GIVEN: 有效的品牌配置数据
      const brandingData = {
        brandPrimaryColor: '#FF5733',
        brandSecondaryColor: '#33FF57',
        companyName: 'Test Company',
        emailSignature: 'Best regards, Test Company',
        contactPhone: '+86 123 4567 8900',
        contactEmail: 'contact@testcompany.com',
      }

      // WHEN: 更新品牌配置
      const response = await request(app.getHttpServer())
        .put('/api/v1/admin/branding')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(brandingData)
        .expect(200)

      // THEN: 返回更新后的品牌配置
      expect(response.body.brandPrimaryColor).toBe(brandingData.brandPrimaryColor)
      expect(response.body.brandSecondaryColor).toBe(brandingData.brandSecondaryColor)
      expect(response.body.companyName).toBe(brandingData.companyName)
      expect(response.body.emailSignature).toBe(brandingData.emailSignature)
      expect(response.body.contactPhone).toBe(brandingData.contactPhone)
      expect(response.body.contactEmail).toBe(brandingData.contactEmail)

      // 保存测试数据用于清理
      brandingTestData = { tenant: testTenant, originalBrandConfig: {} }
    })

    it('[P1] should validate email format', async () => {
      // GIVEN: 无效的邮箱格式
      const brandingData = {
        contactEmail: 'invalid-email',
      }

      // WHEN: 更新品牌配置
      // THEN: 返回 400
      await request(app.getHttpServer())
        .put('/api/v1/admin/branding')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(brandingData)
        .expect(400)
    })

    it('[P1] should validate color format', async () => {
      // GIVEN: 无效的颜色格式
      const brandingData = {
        brandPrimaryColor: 'invalid-color',
      }

      // WHEN: 更新品牌配置
      // THEN: 返回 400
      await request(app.getHttpServer())
        .put('/api/v1/admin/branding')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(brandingData)
        .expect(400)
    })
  })

  describe('[P1] POST /api/v1/admin/branding/logo - 上传 Logo', () => {
    let uploadedLogoPath: string

    afterEach(async () => {
      // 清理上传的文件
      if (uploadedLogoPath && fs.existsSync(uploadedLogoPath)) {
        fs.unlinkSync(uploadedLogoPath)
        uploadedLogoPath = null
      }
    })

    it('[P1] should upload and compress logo image', async () => {
      // GIVEN: 有效的图片文件
      const testImagePath = path.join(__dirname, 'fixtures', 'test-logo.png')

      // WHEN: 上传 logo
      const response = await request(app.getHttpServer())
        .post('/api/v1/admin/branding/logo')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', testImagePath)
        .expect(200)

      // THEN: 返回上传后的 URL
      expect(response.body).toHaveProperty('logoUrl')
      expect(response.body.logoUrl).toContain('/uploads/tenants/')
      expect(response.body.logoUrl).toMatch(/\.(png|jpg|jpeg)$/)

      uploadedLogoPath = path.join(process.cwd(), 'uploads', response.body.logoUrl.split('/uploads/')[1])
    })

    it('[P1] should reject invalid file types', async () => {
      // GIVEN: 无效的文件类型
      const testFilePath = path.join(__dirname, 'fixtures', 'test-file.txt')

      // WHEN: 上传文件
      // THEN: 返回 400
      await request(app.getHttpServer())
        .post('/api/v1/admin/branding/logo')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', testFilePath)
        .expect(400)
    })

    it('[P1] should reject files larger than 2MB', async () => {
      // GIVEN: 超过 2MB 的文件
      const largeBuffer = Buffer.alloc(3 * 1024 * 1024) // 3MB

      // WHEN: 上传文件
      // THEN: 返回 400
      await request(app.getHttpServer())
        .post('/api/v1/admin/branding/logo')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', largeBuffer, 'large-logo.png')
        .expect(400)
    })
  })

  describe('[P1] GET /api/v1/tenant/branding - 公开品牌接口', () => {
    let brandingTestData: any

    beforeAll(async () => {
      // 设置测试品牌配置
      brandingTestData = await brandingFactory.create({
        tenantId: testTenant.id,
        companyName: 'Public Test Company',
        brandPrimaryColor: '#123456',
      })
    })

    afterAll(async () => {
      // 恢复原始品牌配置
      await brandingFactory.restore(brandingTestData)
    })

    it('[P1] should return public branding configuration', async () => {
      // GIVEN: 品牌配置已设置
      // WHEN: 请求公开品牌配置 (无需认证)
      const response = await request(app.getHttpServer())
        .get('/api/v1/tenant/branding')
        .query({ tenantId: testTenant.id })
        .expect(200)

      // THEN: 返回公开的品牌配置
      expect(response.body).toHaveProperty('brandLogoUrl')
      expect(response.body).toHaveProperty('brandPrimaryColor')
      expect(response.body).toHaveProperty('companyName')
      expect(response.body.companyName).toBe('Public Test Company')

      // 不应该包含敏感信息
      expect(response.body).not.toHaveProperty('contactPhone')
      expect(response.body).not.toHaveProperty('contactEmail')
      expect(response.body).not.toHaveProperty('emailSignature')
    })

    it('[P1] should return 400 without tenantId', async () => {
      // GIVEN: 缺少 tenantId
      // WHEN: 请求公开品牌配置
      // THEN: 返回 400
      await request(app.getHttpServer()).get('/api/v1/tenant/branding').expect(400)
    })

    it('[P1] should return 404 for non-existent tenant', async () => {
      // GIVEN: 租户不存在
      const fakeId = '00000000-0000-0000-0000-000000000000'

      // WHEN: 请求公开品牌配置
      // THEN: 返回 404
      await request(app.getHttpServer()).get('/api/v1/tenant/branding').query({ tenantId: fakeId }).expect(404)
    })
  })

  describe('[P2] Email Template Rendering - 邮件模板渲染', () => {
    let brandingTestData: any

    beforeAll(async () => {
      // 设置测试品牌配置
      brandingTestData = await brandingFactory.create({
        tenantId: testTenant.id,
        companyName: 'Email Test Company',
        brandPrimaryColor: '#FF0000',
        emailSignature: 'Best regards,\nEmail Test Company Team',
      })
    })

    afterAll(async () => {
      // 恢复原始品牌配置
      await brandingFactory.restore(brandingTestData)
    })

    it('[P2] should render email template with branding', async () => {
      // GIVEN: 品牌配置已设置
      const templateData = {
        subject: 'Welcome Email',
        content: 'Welcome to {{companyName}}!',
      }

      // WHEN: 渲染邮件模板
      const response = await request(app.getHttpServer())
        .post('/api/v1/admin/branding/email-preview')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(templateData)
        .expect(200)

      // THEN: 返回渲染后的邮件内容
      expect(response.body).toHaveProperty('html')
      expect(response.body.html).toContain('Email Test Company')
      expect(response.body.html).toContain('#FF0000')
      expect(response.body.html).toContain('Best regards')
    })

    it('[P2] should escape HTML in template variables', async () => {
      // GIVEN: 包含 HTML 的品牌配置
      const maliciousData = {
        companyName: '<script>alert("XSS")</script>',
      }

      await dataSource.getRepository(Tenant).update(testTenant.id, {
        brandConfig: { ...testTenant.brandConfig, ...maliciousData },
      })

      const templateData = {
        subject: 'Test Email',
        content: 'Company: {{companyName}}',
      }

      // WHEN: 渲染邮件模板
      const response = await request(app.getHttpServer())
        .post('/api/v1/admin/branding/email-preview')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(templateData)
        .expect(200)

      // THEN: HTML 应该被转义
      expect(response.body.html).not.toContain('<script>')
      expect(response.body.html).toContain('&lt;script&gt;')
    })
  })
})
