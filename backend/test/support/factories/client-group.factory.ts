import { DataSource } from 'typeorm'
import { ClientGroup } from '../../../src/database/entities/client-group.entity'
import { ClientGroupMembership } from '../../../src/database/entities/client-group-membership.entity'
import { faker } from '@faker-js/faker'

/**
 * Client Group Factory
 *
 * 用于创建测试用的客户分组数据
 * 支持自动清理
 */

export interface CreateClientGroupOptions {
  name?: string
  description?: string
  tenantId?: string
  organizationIds?: string[]
}

export interface ClientGroupTestData {
  group: ClientGroup
  memberships?: ClientGroupMembership[]
}

export class ClientGroupFactory {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * 创建单个客户分组测试数据
   *
   * @param options - 配置选项
   * @returns 客户分组测试数据
   */
  async create(options: CreateClientGroupOptions = {}): Promise<ClientGroupTestData> {
    const {
      name = faker.company.buzzPhrase(),
      description = faker.company.catchPhrase(),
      tenantId,
      organizationIds = [],
    } = options

    const result: ClientGroupTestData = {
      group: null,
      memberships: [],
    }

    // 创建客户分组
    const group = this.dataSource.getRepository(ClientGroup).create({
      name,
      description,
      tenantId,
    })
    result.group = await this.dataSource.getRepository(ClientGroup).save(group)

    // 创建分组成员关系
    if (organizationIds.length > 0) {
      for (const organizationId of organizationIds) {
        const membership = this.dataSource.getRepository(ClientGroupMembership).create({
          groupId: result.group.id,
          organizationId,
        })
        const savedMembership = await this.dataSource.getRepository(ClientGroupMembership).save(membership)
        result.memberships.push(savedMembership)
      }
    }

    return result
  }

  /**
   * 创建多个客户分组
   *
   * @param count - 数量
   * @param options - 配置选项
   * @returns 客户分组测试数据数组
   */
  async createMany(count: number, options: CreateClientGroupOptions = {}): Promise<ClientGroupTestData[]> {
    const results: ClientGroupTestData[] = []

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
   * 添加客户到分组
   *
   * @param groupId - 分组ID
   * @param organizationIds - 客户ID数组
   * @returns 分组成员关系数组
   */
  async addClients(groupId: string, organizationIds: string[]): Promise<ClientGroupMembership[]> {
    const memberships: ClientGroupMembership[] = []

    for (const organizationId of organizationIds) {
      const membership = this.dataSource.getRepository(ClientGroupMembership).create({
        groupId,
        organizationId,
      })
      const savedMembership = await this.dataSource.getRepository(ClientGroupMembership).save(membership)
      memberships.push(savedMembership)
    }

    return memberships
  }

  /**
   * 清理客户分组测试数据
   *
   * @param groupId - 分组ID
   */
  async cleanup(groupId: string): Promise<void> {
    try {
      await this.dataSource.getRepository(ClientGroupMembership).delete({ groupId })
      await this.dataSource.getRepository(ClientGroup).delete({ id: groupId })
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  /**
   * 清理所有测试数据
   *
   * @param testData - 客户分组测试数据
   */
  async cleanupAll(testData: ClientGroupTestData): Promise<void> {
    if (testData.group) {
      await this.cleanup(testData.group.id)
    }
  }

  /**
   * 批量清理
   *
   * @param testDataArray - 客户分组测试数据数组
   */
  async cleanupMany(testDataArray: ClientGroupTestData[]): Promise<void> {
    for (const testData of testDataArray) {
      await this.cleanupAll(testData)
    }
  }
}
