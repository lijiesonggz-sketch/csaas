import { Logger } from '@nestjs/common'
import { RadarSource } from '../../../database/entities/radar-source.entity'
import { DataSource } from 'typeorm'

const complianceSeedLogger = new Logger('ComplianceSourcesSeed')

/**
 * 合规雷达信息源种子数据
 *
 * Story 4.1: 配置合规雷达信息源
 *
 * 预设信息源：
 * - 银保监会（处罚通报）
 * - 人民银行（政策征求意见）
 * - 北京金融监管局（处罚通报）
 * - 上海金融监管局（处罚通报）
 */
export const complianceSourcesSeed = async (dataSource: DataSource) => {
  const repository = dataSource.getRepository(RadarSource)

  // 检查是否已存在合规雷达信息源
  const existingCount = await repository.count({
    where: { category: 'compliance' },
  })

  if (existingCount > 0) {
    complianceSeedLogger.log('Compliance sources already exist, skipping seed')
    return
  }

  const sources: Partial<RadarSource>[] = [
    {
      source: '银保监会',
      category: 'compliance',
      url: 'http://www.cbrc.gov.cn',
      type: 'website',
      crawlSchedule: '0 2 * * *', // 每日凌晨2:00
      isActive: true,
      lastCrawlStatus: 'pending',
    },
    {
      source: '人民银行',
      category: 'compliance',
      url: 'http://www.pbc.gov.cn',
      type: 'website',
      crawlSchedule: '0 2,10 * * *', // 每日2:00和10:00
      isActive: true,
      lastCrawlStatus: 'pending',
    },
    {
      source: '北京金融监管局',
      category: 'compliance',
      url: 'http://jrj.beijing.gov.cn',
      type: 'website',
      crawlSchedule: '0 3 * * *', // 每日凌晨3:00
      isActive: true,
      lastCrawlStatus: 'pending',
    },
    {
      source: '上海金融监管局',
      category: 'compliance',
      url: 'http://jrj.sh.gov.cn',
      type: 'website',
      crawlSchedule: '0 3 * * *', // 每日凌晨3:00
      isActive: true,
      lastCrawlStatus: 'pending',
    },
  ]

  for (const sourceData of sources) {
    const source = repository.create(sourceData)
    await repository.save(source)
    complianceSeedLogger.log(`Created compliance source: ${sourceData.source}`)
  }

  complianceSeedLogger.log(`Seeded ${sources.length} compliance sources`)
}

/**
 * 可以通过运行以下命令执行种子数据：
 * npm run seed:compliance-sources
 */
