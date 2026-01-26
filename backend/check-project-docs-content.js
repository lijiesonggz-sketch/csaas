/**
 * 检查项目文档内容详情
 */
const { DataSource } = require('typeorm');

async function checkProjectDocs() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: 'localhost',
    port: 5432,
    username: 'postgres',
    password: 'postgres',
    database: 'csaas',
  });

  try {
    await dataSource.initialize();
    console.log('✅ Database connected\n');

    // 查询所有项目及其文档
    const projects = await dataSource.query(`
      SELECT id, name, created_at
      FROM projects
      ORDER BY created_at DESC
      LIMIT 5
    `);

    console.log(`📊 找到 ${projects.length} 个最近的项目\n`);

    for (const project of projects) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`项目: ${project.name}`);
      console.log(`ID: ${project.id}`);
      console.log(`创建时间: ${project.created_at}`);

      const documents = await dataSource.query(`
        SELECT id, filename, content_type,
               CASE
                 WHEN length(content) > 0 THEN substring(content from 1 for 500)
                 ELSE ''
               END as content_preview,
               char_length(content) as content_length
        FROM project_documents
        WHERE project_id = $1
        ORDER BY uploaded_at DESC
      `, [project.id]);

      if (documents.length === 0) {
        console.log(`  ⚠️  没有文档`);
      } else {
        console.log(`  📄 文档数量: ${documents.length}`);

        documents.forEach((doc, index) => {
          console.log(`\n  [${index + 1}] ${doc.filename}`);
          console.log(`      类型: ${doc.content_type}`);
          console.log(`      内容长度: ${doc.content_length} 字符`);

          if (doc.content_length === 0) {
            console.log(`      ⚠️  ❌ 文档内容为空！`);
          } else if (doc.content_length < 50) {
            console.log(`      ⚠️  ⚠️  内容过短，可能解析失败`);
            console.log(`      内容: "${doc.content_preview}"`);
          } else {
            console.log(`      ✅ 内容正常`);
            console.log(`      预览: ${doc.content_preview.substring(0, 200)}...`);
          }
        });
      }
    }

    await dataSource.destroy();
  } catch (error) {
    console.error('❌ 错误:', error.message);
    console.error('Stack:', error.stack);
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
    process.exit(1);
  }
}

checkProjectDocs();
