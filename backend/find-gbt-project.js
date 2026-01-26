/**
 * 查找包含GB/T 43208.1-2023的项目
 */
const { DataSource } = require('typeorm');

async function findGBTProject() {
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

    // 查询所有项目
    const projects = await dataSource.query(`
      SELECT id, name, metadata, created_at
      FROM projects
      ORDER BY created_at DESC
    `);

    console.log(`🔍 搜索包含 "GB/T" 或 "GBT" 的项目...\n`);

    let found = false;
    for (const project of projects) {
      let metadata = project.metadata;
      if (typeof metadata === 'string') {
        try {
          metadata = JSON.parse(metadata);
        } catch (e) {
          continue;
        }
      }

      const uploadedDocs = metadata?.uploadedDocuments || [];

      // 检查文档名称或内容中是否包含GBT
      const hasGBTDoc = uploadedDocs.some((doc) => {
        const name = (doc.name || '').toLowerCase();
        const content = (doc.content || '').toLowerCase();
        return name.includes('gb/t') ||
               name.includes('gbt') ||
               name.includes('43208') ||
               content.includes('gb/t') ||
               content.includes('gbt');
      });

      if (hasGBTDoc) {
        found = true;
        console.log(`${'='.repeat(70)}`);
        console.log(`项目: ${project.name}`);
        console.log(`ID: ${project.id}`);
        console.log(`创建时间: ${project.created_at}`);

        uploadedDocs.forEach((doc) => {
          const name = (doc.name || '').toLowerCase();
          if (name.includes('gb/t') || name.includes('gbt') || name.includes('43208')) {
            console.log(`\n  📄 [GBT文档] ${doc.name}`);
            console.log(`      ID: ${doc.id}`);
            console.log(`      内容长度: ${doc.content ? doc.content.length : 0} 字符`);

            if (!doc.content || doc.content.length === 0) {
              console.log(`      ❌❌❌ 文档内容为空！这就是问题所在！`);
            } else if (doc.content.length < 100) {
              console.log(`      ⚠️  内容过短: "${doc.content}"`);
            } else {
              console.log(`      ✅ 内容正常`);
              console.log(`      预览: ${doc.content.substring(0, 200)}...`);
            }
          }
        });
      }
    }

    if (!found) {
      console.log('❌ 没有找到包含 GB/T 43208.1-2023 的项目');
      console.log('\n可能的原因：');
      console.log('1. 项目已被删除');
      console.log('2. 文档名称不同');
      console.log('3. 这个错误来自另一个数据库或环境');
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

findGBTProject();
