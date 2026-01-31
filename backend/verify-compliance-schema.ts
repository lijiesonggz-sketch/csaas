import { DataSource } from 'typeorm'
import { RawContent } from './src/database/entities/raw-content.entity'
import { AnalyzedContent } from './src/database/entities/analyzed-content.entity'
import { CrawlerLog } from './src/database/entities/crawler-log.entity'
import { RadarSource } from './src/database/entities/radar-source.entity'

/**
 * 验证Story 4.1合规雷达数据库迁移是否已执行
 */

async function verifySchema() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'csaas',
    entities: [RawContent, AnalyzedContent, CrawlerLog, RadarSource],
    synchronize: false,
  })

  try {
    await dataSource.initialize()
    console.log('✅ Database connected\n')

    const queryRunner = dataSource.createQueryRunner()

    // 1. 检查raw_contents.complianceData字段
    console.log('📋 Checking raw_contents.complianceData...')
    const rawTable = await queryRunner.getTable('raw_contents')
    const complianceDataExists = rawTable.columns.some(c => c.name === 'complianceData')
    console.log(`   ${complianceDataExists ? '✅' : '❌'} complianceData column ${complianceDataExists ? 'exists' : 'MISSING'}`)

    // 2. 检查analyzed_contents.complianceAnalysis字段
    console.log('\n📋 Checking analyzed_contents.complianceAnalysis...')
    const analyzedTable = await queryRunner.getTable('analyzed_contents')
    const complianceAnalysisExists = analyzedTable.columns.some(c => c.name === 'complianceAnalysis')
    console.log(`   ${complianceAnalysisExists ? '✅' : '❌'} complianceAnalysis column ${complianceAnalysisExists ? 'exists' : 'MISSING'}`)

    // 3. 检查crawler_logs新字段
    console.log('\n📋 Checking crawler_logs new fields...')
    const crawlerTable = await queryRunner.getTable('crawler_logs')
    const contentIdExists = crawlerTable.columns.some(c => c.name === 'contentId')
    const crawlDurationExists = crawlerTable.columns.some(c => c.name === 'crawlDuration')
    const crawledAtExists = crawlerTable.columns.some(c => c.name === 'crawledAt')
    const executedAtExists = crawlerTable.columns.some(c => c.name === 'executedAt')
    console.log(`   ${contentIdExists ? '✅' : '❌'} contentId column ${contentIdExists ? 'exists' : 'MISSING'}`)
    console.log(`   ${crawlDurationExists ? '✅' : '❌'} crawlDuration column ${crawlDurationExists ? 'exists' : 'MISSING'}`)
    console.log(`   ${crawledAtExists ? '✅' : '❌'} crawledAt column ${crawledAtExists ? 'exists' : 'MISSING'}`)
    console.log(`   ${executedAtExists ? '⚠️' : '✅'} executedAt column ${executedAtExists ? 'still exists (should be renamed)' : 'correctly renamed'}`)

    // 4. 检查radar_sources唯一索引
    console.log('\n📋 Checking radar_sources unique index...')
    const radarTable = await queryRunner.getTable('radar_sources')
    const uniqueIndexExists = radarTable.indices.some(
      idx => idx.name === 'IDX_radar_sources_source_category_unique' && idx.isUnique
    )
    console.log(`   ${uniqueIndexExists ? '✅' : '❌'} source+category unique index ${uniqueIndexExists ? 'exists' : 'MISSING'}`)

    // 5. 检查合规雷达种子数据
    console.log('\n📋 Checking compliance radar sources seed data...')
    const radarSourceRepo = dataSource.getRepository(RadarSource)
    const complianceSources = await radarSourceRepo.find({
      where: { category: 'compliance' as any },
    })
    console.log(`   Found ${complianceSources.length} compliance sources:`)
    complianceSources.forEach(source => {
      console.log(`   - ${source.source} (${source.url})`)
    })

    await queryRunner.release()

    // 汇总
    console.log('\n' + '='.repeat(60))
    const allChecks = [
      complianceDataExists,
      complianceAnalysisExists,
      contentIdExists,
      crawlDurationExists,
      crawledAtExists,
      !executedAtExists,
      uniqueIndexExists,
      complianceSources.length > 0,
    ]

    const passed = allChecks.filter(Boolean).length
    const total = allChecks.length

    if (passed === total) {
      console.log('✅ ALL CHECKS PASSED! Database schema is up to date.')
      console.log(`   ${passed}/${total} checks passed`)
    } else {
      console.log(`⚠️  SOME CHECKS FAILED! ${passed}/${total} checks passed`)
      console.log('\n🔧 To fix missing migrations, run:')
      console.log('   cd backend && npm run migration:run')
      console.log('\n🔧 To seed compliance sources, run:')
      console.log('   cd backend && npm run seed:radar-sources')
    }

  } catch (error) {
    console.error('❌ Verification failed:', error.message)
    console.error('\n💡 Ensure database is running and .env configuration is correct')
  } finally {
    await dataSource.destroy()
  }
}

verifySchema()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
