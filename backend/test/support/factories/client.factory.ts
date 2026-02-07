import { DataSource } from 'typeorm'
import { Organization } from '../../../src/database/entities/organization.entity'
import { PushPreference } from '../../../src/database/entities/push-preference.entity'
import { Tenant } from '../../../src/database/entities/tenant.entity'
import { faker } from '@faker-js/faker'

/**
 * Client Factory
 *
 * 用于创建测试用的客户(Organization)数据
 * 支持自动清理
 */

export interface CreateClientOptions {
  name?: string
  contactPerson?: string
  contactEmail?: string
  industryType?: 'banking' | 'insurance' | 'securities' | 'other'
  scale?: 'large' | 'medium' | 'small'
  status?: 'active' | 'inactive' | 'trial'
  tenantId?: string
  createPushPreference?: boolean
}

export interface ClientTestData {
  client: Organization
  pushPreference?: PushPreference
}

export class ClientFactory {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * 创建单个客户测试数据
   *
   * @param options - 配置选项
   * @returns 客户测试数据
   */
  async create(options: CreateClientOptions = {}): Promise<ClientTestData> {
    const {
      name = faker.company.name(),
      contactPerson = faker.person.fullName(),
      contactEmail = faker.internet.email(),
      industryType = 'banking',
      scale = 'medium',
      status = 'active',
      tenantId,
      createPushPreference = true,
    } = options

    const result: ClientTestData = {
      client: null,
      pushPreference: null,
    }

    // 创建客户
    const client = this.dataSource.getRepository(Organization).create({
      name,
      contactPerson,
      contactEmail,
      industryType,
      scale,
      status,
      tenantId,
      activatedAt: status === 'active' ? new Date() : null,
    })
    result.client = await this.dataSource.getRepository(Organization).save(client)

    // 创建推送偏好
    if (createPushPreference) {
      const pushPreference = this.dataSource.getRepository(PushPreference).create({
        organizationId: result.client.id,
        tenantId,
        pushStartTime: '09:00:00',
        pushEndTime: '18:00:00',
        dailyPushLimit: 5,
        relevanceFilter: 'high_medium',
      })
      result.pushPreference = await this.dataSource.getRepository(PushPreference).save(pushPreference)
    }

    return result
  }

  /**
   * 创建多个客户
   *
   * @param count - 数量
   * @param options - 配置选项
   * @returns 客户测试数据数组
   */
  async createMany(count: number, options: CreateClientOptions = {}): Promise<ClientTestData[]> {
    const results: ClientTestData[] = []

    for (let i = 0; i < count; i++) {
      const result = await this.create({
        ...options,
        name: options.name ? `${options.name} ${i + 1}` : undefined,
      })
      results.push(result)
    }

    return results
  }

  /**
   * 创建 CSV 导入测试数据
   *
   * @param count - 数量
   * @returns CSV 字符串
   */
  createCsvData(count: number = 3): string {
    const headers = 'name,contactPerson,contactEmail,industryType,scale'
    const rows: string[] = []

    for (let i = 0; i < count; i++) {
      rows.push(
        [
          faker.company.name(),
          faker.person.fullName(),
          faker.internet.email(),
          faker.helpers.arrayElement(['banking', 'insurance', 'securities', 'other']),
          faker.helpers.arrayElement(['large', 'medium', 'small']),
        ].join(','),
      )
    }

    return [headers, ...rows].join('\n')
  }

  /**
   * 清理客户测试数据
   *
   * @param clientId - 客户ID
   */
  async cleanup(clientId: string): Promise<void> {
    try {
      await this.dataSource.getRepository(PushPreference).delete({ organizationId: clientId })
      await this.dataSource.getRepository(Organization).delete({ id: clientId })
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  /**
   * 清理所有测试数据
   *
   * @param testData - 客户测试数据
   */
  async cleanupAll(testData: ClientTestData): Promise<void> {
    if (testData.client) {
      await this.cleanup(testData.client.id)
    }
  }

  /**
   * 批量清理
   *
   * @param testDataArray - 客户测试数据数组
   */
  async cleanupMany(testDataArray: ClientTestData[]): Promise<void> {
    for (const testData of testDataArray) {
      await this.cleanupAll(testData)
    }
  }
}
