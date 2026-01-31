const { Client } = require('pg')

async function checkFullContent() {
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
      SELECT "fullContent", url, title
      FROM raw_contents
      WHERE source = '信通院'
      LIMIT 1
    `)

    if (result.rows.length === 0) {
      console.log('未找到内容')
      return
    }

    const content = result.rows[0]
    console.log('URL:', content.url)
    console.log('标题:', content.title)
    console.log('\n完整内容长度:', content.fullContent.length, '字符')
    console.log('\n前1000字符:')
    console.log(content.fullContent.substring(0, 1000))
    console.log('\n...')

  } catch (error) {
    console.error('Error:', error.message)
  } finally {
    await client.end()
  }
}

checkFullContent()
