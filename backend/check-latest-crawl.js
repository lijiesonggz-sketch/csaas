const { Client } = require('pg')

async function checkLatestCrawl() {
  const client = new Client({
    host: '127.0.0.1',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas',
  })

  try {
    await client.connect()

    const result = await client.query(`
      SELECT id, source, title, summary, "fullContent", url, "createdAt"
      FROM raw_contents
      WHERE source = '信通院'
      ORDER BY "createdAt" DESC
      LIMIT 1
    `)

    if (result.rows.length === 0) {
      console.log('未找到内容')
      return
    }

    const content = result.rows[0]
    console.log('=== 最新爬取的信通院内容 ===\n')
    console.log('ID:', content.id)
    console.log('来源:', content.source)
    console.log('标题:', content.title)
    console.log('URL:', content.url)
    console.log('爬取时间:', new Date(content.createdAt).toLocaleString('zh-CN'))
    console.log('\n摘要:')
    console.log(content.summary || 'N/A')
    console.log('\n完整内容长度:', content.fullContent ? content.fullContent.length : 0, '字符')
    console.log('\n内容前1000字符:')
    console.log(content.fullContent ? content.fullContent.substring(0, 1000) : 'N/A')

  } catch (error) {
    console.error('Error:', error.message)
  } finally {
    await client.end()
  }
}

checkLatestCrawl()
