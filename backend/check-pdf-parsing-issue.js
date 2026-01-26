/**
 * 检查PDF解析和文档保存问题
 */
const { DataSource } = require('typeorm');

async function checkPDFParsingIssue() {
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

    // 查询最新项目的metadata
    const projects = await dataSource.query(`
      SELECT id, name, metadata, created_at
      FROM projects
      ORDER BY created_at DESC
      LIMIT 3
    `);

    console.log(`📊 检查最近 ${projects.length} 个项目的文档上传情况\n`);

    for (const project of projects) {
      console.log(`${'='.repeat(70)}`);
      console.log(`项目: ${project.name}`);
      console.log(`ID: ${project.id}`);
      console.log(`创建时间: ${project.created_at}`);

      let metadata = project.metadata;
      if (typeof metadata === 'string') {
        try {
          metadata = JSON.parse(metadata);
        } catch (e) {
          console.log('  ⚠️  Metadata解析失败');
          continue;
        }
      }

      const uploadedDocs = metadata?.uploadedDocuments;

      if (!uploadedDocs || !Array.isArray(uploadedDocs) || uploadedDocs.length === 0) {
        console.log('  ⚠️  没有上传的文档');
        continue;
      }

      console.log(`  📄 上传文档数量: ${uploadedDocs.length}\n`);

      uploadedDocs.forEach((doc, index) => {
        console.log(`  [${index + 1}] ${doc.name || '未命名'}`);
        console.log(`      ID: ${doc.id}`);

        const contentLength = doc.content ? doc.content.length : 0;
        console.log(`      内容长度: ${contentLength} 字符`);

        if (contentLength === 0) {
          console.log(`      ❌ 文档内容为空！这是主要问题！`);
          console.log(`      🔧 可能原因：`);
          console.log(`         1. PDF解析失败（后端/pdf-parse错误）`);
          console.log(`         2. PDF文件是扫描件（图片而非文本）`);
          console.log(`         3. PDF文件已加密或损坏`);
          console.log(`         4. 文件上传时解析超时`);
        } else if (contentLength < 100) {
          console.log(`      ⚠️  文档内容过短（${contentLength} < 100字符）`);
          console.log(`      内容: "${doc.content}"`);
        } else {
          console.log(`      ✅ 内容长度正常`);
          console.log(`      预览: ${doc.content.substring(0, 150)}...`);
        }

        console.log('');
      });
    }

    console.log(`\n${'='.repeat(70)}`);
    console.log('📋 问题总结：');
    console.log('');
    console.log('如果看到"文档内容为空"，说明：');
    console.log('1. PDF文件上传成功');
    console.log('2. 但PDF解析功能没有正确提取文本内容');
    console.log('');
    console.log('可能的原因：');
    console.log('• PDF文件是扫描件（包含图片而非可选择的文本）');
    console.log('• PDF文件使用了特殊编码');
    console.log('• 后端PDF解析API调用失败');
    console.log('• 前端没有正确处理解析结果');
    console.log('');
    console.log('解决方案：');
    console.log('1. 检查后端日志：/files/parse-pdf 的调用记录');
    console.log('2. 测试PDF文件：使用 test-integration-pdf-parse.js');
    console.log('3. 尝试重新上传PDF文件');
    console.log('4. 如果是扫描PDF，使用OCR工具转换');

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

checkPDFParsingIssue();
