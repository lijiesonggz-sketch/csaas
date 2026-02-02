import { DataSource } from 'typeorm'
import { RadarPushFactory } from '../factories/radar-push.factory'
import { OrganizationFactory } from '../factories/organization.factory'

/**
 * Test Helper
 *
 * 提供测试辅助函数和工厂实例
 */

export class TestHelper {
  public radarPushFactory: RadarPushFactory
  public organizationFactory: OrganizationFactory

  constructor(private readonly dataSource: DataSource) {
    this.radarPushFactory = new RadarPushFactory(dataSource)
    this.organizationFactory = new OrganizationFactory(dataSource)
  }

  /**
   * 清理所有测试数据
   */
  async cleanupAll(): Promise<void> {
    await this.radarPushFactory.cleanupAll()
  }

  /**
   * 等待指定时间
   *
   * @param ms - 毫秒数
   */
  async wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * 生成唯一ID
   *
   * @param prefix - 前缀
   * @returns 唯一ID
   */
  generateId(prefix: string = 'test'): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}`
  }

  /**
   * 生成测试邮箱
   *
   * @returns 测试邮箱
   */
  generateEmail(): string {
    return `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`
  }
}

/**
 * 创建测试helper实例
 *
 * @param dataSource - TypeORM DataSource
 * @returns TestHelper实例
 */
export function createTestHelper(dataSource: DataSource): TestHelper {
  return new TestHelper(dataSource)
}
