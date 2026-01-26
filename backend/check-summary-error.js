/**
 * 检查综述生成任务错误
 */
const { DataSource } = require('typeorm');

async function checkSummaryError() {
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

    // 查询最新的summary任务
    const [latestTask] = await dataSource.query(`
      SELECT id, status, result, error_message, created_at
      FROM ai_tasks
      WHERE type = 'summary'
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (!latestTask) {
      console.log('❌ 没有找到summary任务');
      await dataSource.destroy();
      return;
    }

    console.log(`📋 最新综述任务: ${latestTask.id}`);
    console.log(`   状态: ${latestTask.status}`);
    console.log(`   创建时间: ${latestTask.created_at}`);

    if (latestTask.error_message) {
      console.log(`\n❌ 错误信息:\n${latestTask.error_message}`);
    }

    if (latestTask.result) {
      const result = typeof latestTask.result === 'string'
        ? JSON.parse(latestTask.result)
        : latestTask.result;

      console.log(`\n📊 结果数据:`);
      console.log(`   - Summary长度: ${result.summary?.length || 0}`);
      console.log(`   - 错误信息: ${result.error || '无'}`);

      if (result.summary && result.summary.length > 0) {
        console.log(`\n📝 综述内容预览:`);
        console.log(result.summary.substring(0, 500));
      }
    }

    // 查询相关项目文档
    const projectId = latestTask.result
      ? (typeof latestTask.result === 'string'
          ? JSON.parse(latestTask.result).project_id
          : latestTask.result.project_id)
      : null;

    if (projectId) {
      console.log(`\n\n📁 项目文档 (Project: ${projectId}):`);
      const documents = await dataSource.query(`
        SELECT id, filename, content_type, char_length(content) as content_length
        FROM project_documents
        WHERE project_id = $1
        ORDER BY filename
      `, [projectId]);

      if (documents.length === 0) {
        console.log('   ⚠️  没有找到项目文档');
      } else {
        documents.forEach(doc => {
          console.log(`   - ${doc.filename}`);
          console.log(`     类型: ${doc.content_type}`);
          console.log(`     内容长度: ${doc.content_length} 字符`);

          // 检查内容是否有效
          if (doc.content_length === 0) {
            console.log(`     ⚠️  文档内容为空！`);
          } else if (doc.content_length < 100) {
            console.log(`     ⚠️  文档内容过短，可能解析失败`);
            console.log(`     内容预览: ${doc.content.substring(0, 200)}`);
          } else {
            console.log(`     内容预览: ${doc.content.substring(0, 200)}...`);
          }
        });
      }
    }

    await dataSource.destroy();
  } catch (error) {
    console.error('❌ 错误:', error.message);
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
    process.exit(1);
  }
}

checkSummaryError();
