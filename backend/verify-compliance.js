const { Client } = require('pg')

async function verifySchema() {
  // 使用测试数据库配置
  const client = new Client({
    host: '127.0.0.1',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas',
  })

  try {
    await client.connect()
    console.log('✅ Database connected\n')

    // 1. 检查raw_contents.complianceData字段
    console.log('📋 Checking raw_contents.complianceData...')
    const result1 = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'raw_contents' AND column_name = 'complianceData'
    `)
    console.log(`   ${result1.rowCount > 0 ? '✅' : '❌'} complianceData column ${result1.rowCount > 0 ? 'exists' : 'MISSING'}`)

    // 2. 检查analyzed_contents.complianceAnalysis字段
    console.log('\n📋 Checking analyzed_contents.complianceAnalysis...')
    const result2 = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'analyzed_contents' AND column_name = 'complianceAnalysis'
    `)
    console.log(`   ${result2.rowCount > 0 ? '✅' : '❌'} complianceAnalysis column ${result2.rowCount > 0 ? 'exists' : 'MISSING'}`)

    // 3. 检查crawler_logs新字段
    console.log('\n📋 Checking crawler_logs new fields...')
    const result3 = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'crawler_logs'
      AND column_name IN ('contentId', 'crawlDuration', 'crawledAt')
      ORDER BY column_name
    `)
    console.log(`   Found ${result3.rowCount}/3 expected columns:`)
    result3.rows.forEach(row => {
      console.log(`   - ${row.column_name}`)
    })

    // 检查executedAt是否已重命名
    const result3b = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'crawler_logs' AND column_name = 'executedAt'
    `)
    console.log(`   ${result3b.rowCount === 0 ? '✅' : '⚠️'} executedAt ${result3b.rowCount === 0 ? 'correctly renamed to crawledAt' : 'still exists (should be renamed)'}`)

    // 4. 检查radar_sources唯一索引
    console.log('\n📋 Checking radar_sources unique index...')
    const result4 = await client.query(`
      SELECT indexname, indisunique as is_unique
      FROM pg_indexes pg
      JOIN pg_class pc ON pg.indexname = pc.relname
      JOIN pg_index pi ON pc.oid = pi.indexrelid
      WHERE pg.indexname = 'IDX_radar_sources_source_category_unique'
    `)
    if (result4.rowCount > 0) {
      console.log(`   ✅ Unique index exists (${result4.rows[0].is_unique ? 'UNIQUE' : 'NOT UNIQUE'})`)
    } else {
      console.log('   ❌ Unique index MISSING')
    }

    // 5. 检查合规雷达种子数据
    console.log('\n📋 Checking compliance radar sources seed data...')
    const result5 = await client.query(`
      SELECT source, url, category, "isActive", "crawlSchedule"
      FROM radar_sources
      WHERE category = 'compliance'
      ORDER BY source
    `)
    console.log(`   Found ${result5.rowCount} compliance sources:`)
    result5.rows.forEach(row => {
      console.log(`   - ${row.source} (${row.url})`)
    })

    // 汇总
    console.log('\n' + '='.repeat(60))
    const allChecks = [
      result1.rowCount > 0,  // complianceData
      result2.rowCount > 0,  // complianceAnalysis
      result3.rowCount >= 3, // crawler_logs new fields
      result3b.rowCount === 0, // executedAt renamed
      result4.rowCount > 0,  // unique index
      result5.rowCount >= 4,  // seed data (至少4个合规信息源)
    ]

    const passed = allChecks.filter(Boolean).length
    const total = allChecks.length

    if (passed === total) {
      console.log('✅ ALL CHECKS PASSED! Database schema is up to date.')
      console.log(`   ${passed}/${total} checks passed\n`)
    } else {
      console.log(`⚠️  SOME CHECKS FAILED! ${passed}/${total} checks passed\n`)
      console.log('🔧 To fix missing migrations, run:')
      console.log('   cd backend && npm run migration:run\n')
      console.log('🔧 To seed compliance sources, run:')
      console.log('   cd backend && npm run seed:radar-sources\n')
    }

  } catch (error) {
    console.error('❌ Verification failed:', error.message)
    console.error('\n💡 Ensure database is running and .env configuration is correct')
  } finally {
    await client.end()
  }
}

verifySchema()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
