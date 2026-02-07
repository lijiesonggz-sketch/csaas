import { DataSource } from 'typeorm'
import { Tenant } from '../../../src/database/entities/tenant.entity'
import { faker } from '@faker-js/faker'

/**
 * Branding Factory
 *
 * 用于创建测试用的品牌配置数据
 * 支持自动清理
 */

export interface CreateBrandingOptions {
  tenantId?: string
  brandLogoUrl?: string
  brandPrimaryColor?: string
  brandSecondaryColor?: string
  companyName?: string
  emailSignature?: string
  contactPhone?: string
  contactEmail?: string
}

export interface BrandingTestData {
  tenant: Tenant
  originalBrandConfig?: any
}

export class BrandingFactory {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * 创建品牌配置测试数据
   *
   * @param options - 配置选项
   * @returns 品牌配置测试数据
   */
  async create(options: CreateBrandingOptions = {}): Promise<BrandingTestData> {
    const {
      tenantId,
      brandLogoUrl = faker.image.url(),
      brandPrimaryColor = faker.color.rgb({ format: 'hex' }),
      brandSecondaryColor = faker.color.rgb({ format: 'hex' }),
      companyName = faker.company.name(),
      emailSignature = faker.lorem.sentence(),
      contactPhone = faker.phone.number(),
      contactEmail = faker.internet.email(),
    } = options

    const result: BrandingTestData = {
      tenant: null,
      originalBrandConfig: null,
    }

    // 获取租户
    const tenant = await this.dataSource.getRepository(Tenant).findOne({
      where: { id: tenantId },
    })

    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`)
    }

    // 保存原始品牌配置
    result.originalBrandConfig = tenant.brandConfig

    // 更新品牌配置
    tenant.brandConfig = {
      logo: brandLogoUrl,
      companyName,
      themeColor: brandPrimaryColor,
      secondaryColor: brandSecondaryColor,
      emailSignature,
      contactPhone,
      contactEmail,
    }

    result.tenant = await this.dataSource.getRepository(Tenant).save(tenant)

    return result
  }

  /**
   * 生成随机品牌配置
   *
   * @returns 品牌配置对象
   */
  generateBrandConfig() {
    return {
      logo: faker.image.url(),
      themeColor: faker.color.rgb({ format: 'hex' }),
      secondaryColor: faker.color.rgb({ format: 'hex' }),
      companyName: faker.company.name(),
      emailSignature: faker.lorem.sentence(),
      contactPhone: faker.phone.number(),
      contactEmail: faker.internet.email(),
    }
  }

  /**
   * 生成默认品牌配置
   *
   * @returns 默认品牌配置对象
   */
  generateDefaultBrandConfig() {
    return {
      logo: null,
      themeColor: '#1890ff',
      secondaryColor: null,
      companyName: 'Csaas',
      emailSignature: null,
      contactPhone: null,
      contactEmail: null,
    }
  }

  /**
   * 恢复原始品牌配置
   *
   * @param testData - 品牌配置测试数据
   */
  async restore(testData: BrandingTestData): Promise<void> {
    if (testData.tenant && testData.originalBrandConfig !== undefined) {
      testData.tenant.brandConfig = testData.originalBrandConfig
      await this.dataSource.getRepository(Tenant).save(testData.tenant)
    }
  }

  /**
   * 清理品牌配置测试数据
   *
   * @param testData - 品牌配置测试数据
   */
  async cleanup(testData: BrandingTestData): Promise<void> {
    await this.restore(testData)
  }
}
