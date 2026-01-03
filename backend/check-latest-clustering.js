/**
 * 检查最新的聚类任务和文档信息
 */
const { DataSource } = require('typeorm');

async function checkLatestClustering() {
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

    // 查询最新的聚类任务
    const tasks = await dataSource.query(`
      SELECT
        id,
        type,
        status,
        input,
        created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai' as created_time,
        updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai' as updated_time
      FROM ai_tasks
      WHERE type = 'clustering'
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (tasks.length === 0) {
      console.log('❌ 没有找到聚类任务\n');
      return;
    }

    const task = tasks[0];
    console.log('=== 最新聚类任务 ===');
    console.log('Task ID:', task.id);
    console.log('Status:', task.status);
    console.log('Created At:', task.created_time);
    console.log('Updated At:', task.updated_time);

    // 解析输入文档
    if (task.input) {
      const inputData = typeof task.input === 'string' ? JSON.parse(task.input) : task.input;
      console.log('\n=== 任务输入文档 ===');

      if (inputData.documents && Array.isArray(inputData.documents)) {
        inputData.documents.forEach((doc, idx) => {
          console.log(`\n文档 ${idx + 1}:`);
          console.log('  ID:', doc.id);
          console.log('  名称:', doc.name);
          console.log('  内容长度:', doc.content.length, '字符');

          // 检测条款
          const clauseMatches = doc.content.match(/第[一二三四五六七八九十百千]+条/g);
          if (clauseMatches) {
            const uniqueClauses = [...new Set(clauseMatches)];
            console.log('  检测到的条款数:', uniqueClauses.length);

            // 如果是人民银行文档，显示详细信息
            if (doc.name.includes('人民银行')) {
              console.log('  ✅ 这是人民银行文档');
              console.log('  条款列表 (全部):', uniqueClauses.join(', '));
              console.log('  内容预览 (前500字符):');
              console.log('  ' + doc.content.substring(0, 500).replace(/\n/g, '\\n  '));
            }
          } else {
            console.log('  ⚠️ 未检测到任何条款');
          }
        });
      }
    }

    // 查询生成结果和覆盖率
    const results = await dataSource.query(`
      SELECT
        selected_model,
        confidence_level,
        coverage_report
      FROM ai_generation_results
      WHERE task_id = $1
    `, [task.id]);

    if (results.length > 0) {
      const result = results[0];
      console.log('\n=== 生成结果 ===');
      console.log('Selected Model:', result.selected_model);
      console.log('Confidence Level:', result.confidence_level);

      if (result.coverage_report) {
        const coverage = JSON.parse(result.coverage_report);
        console.log('\n=== 覆盖率报告 ===');
        console.log('总体覆盖率:', (coverage.overall.coverage_rate * 100).toFixed(1) + '%');
        console.log('总条款数:', coverage.overall.total_clauses);
        console.log('已提取条款数:', coverage.overall.clustered_clauses);

        if (coverage.by_document) {
          console.log('\n按文档覆盖率:');
          Object.entries(coverage.by_document).forEach(([docId, stats]) => {
            // 找到文档名称
            const doc = inputData.documents.find(d => d.id === docId);
            console.log(`  ${doc?.name || docId}:`);
            console.log('    总条款数:', stats.total_clauses);
            console.log('    已提取:', stats.clustered_clauses);
            console.log('    覆盖率:', ((stats.clustered_clauses / stats.total_clauses) * 100).toFixed(1) + '%');
            if (stats.missing_clause_ids && stats.missing_clause_ids.length > 0) {
              console.log('    缺失条款:', stats.missing_clause_ids.join(', '));
            }
          });
        }
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await dataSource.destroy();
  }
}

checkLatestClustering();
