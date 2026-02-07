import { DataSource } from 'typeorm'
import { User, UserRole } from '../../../src/database/entities/user.entity'
import { Organization } from '../../../src/database/entities/organization.entity'
import { OrganizationMember } from '../../../src/database/entities/organization-member.entity'
import { WeaknessSnapshot } from '../../../src/database/entities/weakness-snapshot.entity'
import { WatchedTopic } from '../../../src/database/entities/watched-topic.entity'
import { WeaknessCategory } from '../../../src/constants/categories'
import * as bcrypt from 'bcrypt'

/**
 * Organization Factory
 *
 * 用于创建测试用的组织、用户和相关数据
 * 支持自动清理
 */

export interface CreateOrganizationOptions {
  name?: string
  radarActivated?: boolean
  createUser?: boolean
  userId?: string
  userEmail?: string
  userName?: string
  userRole?: UserRole
  createWeaknesses?: boolean
  weaknessCategories?: WeaknessCategory[]
  createWatchedTopics?: boolean
  watchedTopics?: Array<{ topicName: string; topicType: 'tech' | 'industry' | 'compliance' }>
}

export interface OrganizationTestData {
  organization: Organization
  user?: User
  member?: OrganizationMember
  weaknesses?: WeaknessSnapshot[]
  watchedTopics?: WatchedTopic[]
}

export class OrganizationFactory {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * 创建完整的组织测试数据
   *
   * @param options - 配置选项
   * @returns 组织测试数据
   */
  async create(options: CreateOrganizationOptions = {}): Promise<OrganizationTestData> {
    const {
      name = `Test Org ${Date.now()}`,
      radarActivated = true,
      createUser = true,
      userId,
      userEmail,
      userName = 'Test User',
      userRole = UserRole.RESPONDENT,
      createWeaknesses = false,
      weaknessCategories = [WeaknessCategory.DATA_SECURITY],
      createWatchedTopics = false,
      watchedTopics = [{ topicName: 'AI应用', topicType: 'tech' as const }],
    } = options

    const result: OrganizationTestData = {
      organization: null,
      user: null,
      member: null,
      weaknesses: [],
      watchedTopics: [],
    }

    // 创建组织
    const organization = this.dataSource.getRepository(Organization).create({
      name,
      radarActivated,
    })
    result.organization = await this.dataSource.getRepository(Organization).save(organization)

    // 创建用户
    if (createUser) {
      const finalUserId =
        userId || `10000000-0000-0000-0000-${Date.now().toString().slice(-12).padStart(12, '0')}`
      const finalUserEmail = userEmail || `test-${Date.now()}@example.com`
      const passwordHash = await bcrypt.hash('password123', 10)

      const user = this.dataSource.getRepository(User).create({
        id: finalUserId,
        name: userName,
        email: finalUserEmail,
        passwordHash,
        role: userRole,
      })
      result.user = await this.dataSource.getRepository(User).save(user)

      // 创建组织成员关系
      const member = this.dataSource.getRepository(OrganizationMember).create({
        userId: result.user.id,
        organizationId: result.organization.id,
        role: 'admin',
      })
      result.member = await this.dataSource.getRepository(OrganizationMember).save(member)
    }

    // 创建薄弱项
    if (createWeaknesses) {
      for (const category of weaknessCategories) {
        const weakness = this.dataSource.getRepository(WeaknessSnapshot).create({
          organizationId: result.organization.id,
          category,
          level: 1, // 最薄弱
          projectId: null,
        })
        const savedWeakness = await this.dataSource.getRepository(WeaknessSnapshot).save(weakness)
        result.weaknesses.push(savedWeakness)
      }
    }

    // 创建关注领域
    if (createWatchedTopics) {
      for (const topic of watchedTopics) {
        const watchedTopic = this.dataSource.getRepository(WatchedTopic).create({
          organization: result.organization,
          topicName: topic.topicName,
          topicType: topic.topicType as 'tech' | 'industry',
        })
        const savedTopic = await this.dataSource.getRepository(WatchedTopic).save(watchedTopic)
        result.watchedTopics.push(savedTopic)
      }
    }

    return result
  }

  /**
   * 创建多个组织
   *
   * @param count - 数量
   * @param options - 配置选项
   * @returns 组织测试数据数组
   */
  async createMany(
    count: number,
    options: CreateOrganizationOptions = {},
  ): Promise<OrganizationTestData[]> {
    const results: OrganizationTestData[] = []

    for (let i = 0; i < count; i++) {
      const result = await this.create({
        ...options,
        name: `${options.name || 'Test Org'} ${i + 1}`,
      })
      results.push(result)
    }

    return results
  }

  /**
   * 清理组织测试数据
   *
   * @param organizationId - 组织ID
   */
  async cleanup(organizationId: string): Promise<void> {
    try {
      await this.dataSource.getRepository(WatchedTopic).delete({ organizationId })
      await this.dataSource.getRepository(WeaknessSnapshot).delete({ organizationId })
      await this.dataSource.getRepository(OrganizationMember).delete({ organizationId })
      await this.dataSource.getRepository(Organization).delete({ id: organizationId })
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  /**
   * 清理用户测试数据
   *
   * @param userId - 用户ID
   */
  async cleanupUser(userId: string): Promise<void> {
    try {
      await this.dataSource.getRepository(OrganizationMember).delete({ userId })
      await this.dataSource.getRepository(User).delete({ id: userId })
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  /**
   * 清理所有测试数据
   *
   * @param testData - 组织测试数据
   */
  async cleanupAll(testData: OrganizationTestData): Promise<void> {
    if (testData.organization) {
      await this.cleanup(testData.organization.id)
    }
    if (testData.user) {
      await this.cleanupUser(testData.user.id)
    }
  }
}
