import { DataSource } from 'typeorm'
import { RadarSource } from '../src/database/entities/radar-source.entity'

/**
 * Seed Script for Radar Sources
 *
 * Story 3.1: 配置行业雷达信息源
 *
 * 从默认配置导入信息源到数据库
 *
 * 使用方法：
 * npm run seed:radar-sources
 */

// 默认信息源配置
const defaultSources = [
  // 技术雷达信息源
  {
    source: 'GARTNER',
    category: 'tech' as const,
    url: 'https://www.gartner.com/en/newsroom',
    type: 'website' as const,
    isActive: true,
    crawlSchedule: '0 2 * * *', // 每日凌晨2:00
  },
  {
    source: '信通院',
    category: 'tech' as const,
    url: 'http://www.caict.ac.cn/kxyj/qwfb/',
    type: 'website' as const,
    isActive: true,
    crawlSchedule: '0 2 * * *',
  },
  {
    source: 'IDC',
    category: 'tech' as const,
    url: 'https://www.idc.com/research',
    type: 'website' as const,
    isActive: true,
    crawlSchedule: '0 2 * * *',
  },

  // 行业雷达信息源（示例）
  {
    source: '杭州银行金融科技',
    category: 'industry' as const,
    url: 'https://mp.weixin.qq.com/s/example',
    type: 'wechat' as const,
    peerName: '杭州银行',
    isActive: true,
    crawlSchedule: '0 3 * * *', // 每日凌晨3:00
  },
  {
    source: '拉勾网-金融机构招聘',
    category: 'industry' as const,
    url: 'https://www.lagou.com/gongsi/j1234.html',
    type: 'recruitment' as const,
    peerName: '招商银行',
    isActive: true,
    crawlSchedule: '0 4 * * *', // 每日凌晨4:00
  },

  // 合规雷达信息源（Story 4.1配置）
  {
    source: '银保监会',
    category: 'compliance' as const,
    url: 'http://www.cbrc.gov.cn',
    type: 'website' as const,
    isActive: true,
    crawlSchedule: '0 2 * * *', // 每日凌晨2:00
  },
  {
    source: '人民银行',
    category: 'compliance' as const,
    url: 'http://www.pbc.gov.cn',
    type: 'website' as const,
    isActive: true,
    crawlSchedule: '0 2,10 * * *', // 每日2:00和10:00（政策征求意见需要更频繁）
  },
  {
    source: '北京金融监管局',
    category: 'compliance' as const,
    url: 'http://jrj.beijing.gov.cn',
    type: 'website' as const,
    isActive: true,
    crawlSchedule: '0 3 * * *', // 每日凌晨3:00
  },
  {
    source: '上海金融监管局',
    category: 'compliance' as const,
    url: 'http://jrj.sh.gov.cn',
    type: 'website' as const,
    isActive: true,
    crawlSchedule: '0 3 * * *', // 每日凌晨3:00
  },
]

async function seed() {
  // 创建数据库连接
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'csaas',
    entities: [RadarSource],
    synchronize: false,
  })

  try {
    console.log('Connecting to database...')
    await dataSource.initialize()
    console.log('Database connected')

    const radarSourceRepository = dataSource.getRepository(RadarSource)

    // 检查是否已有数据
    const existingCount = await radarSourceRepository.count()
    if (existingCount > 0) {
      console.log(`Database already has ${existingCount} radar sources`)
      const answer = await askQuestion(
        'Do you want to clear existing data and re-seed? (yes/no): ',
      )
      if (answer.toLowerCase() !== 'yes') {
        console.log('Seed cancelled')
        return
      }
      // 清空现有数据
      await radarSourceRepository.clear()
      console.log('Existing data cleared')
    }

    // 插入默认数据
    console.log(`Seeding ${defaultSources.length} radar sources...`)
    for (const sourceData of defaultSources) {
      const source = radarSourceRepository.create({
        ...sourceData,
        lastCrawlStatus: 'pending',
      })
      await radarSourceRepository.save(source)
      console.log(`✓ Created: ${source.source} (${source.category})`)
    }

    console.log('\n✅ Seed completed successfully!')
    console.log(`Total sources created: ${defaultSources.length}`)
  } catch (error) {
    console.error('❌ Seed failed:', error)
    throw error
  } finally {
    await dataSource.destroy()
    console.log('Database connection closed')
  }
}

// 辅助函数：从命令行读取输入
function askQuestion(question: string): Promise<string> {
  const readline = require('readline')
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question(question, (answer: string) => {
      rl.close()
      resolve(answer)
    })
  })
}

// 执行 seed
seed()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
