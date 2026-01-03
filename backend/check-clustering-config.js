const { Client } = require('pg');

async function checkTaskConfig() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  // 获取最新的聚类任务
  const res = await client.query(`
    SELECT t.id, t.input, t.created_at
    FROM ai_tasks t
    WHERE t.type = 'clustering'
    ORDER BY t.created_at DESC
    LIMIT 1
  `);

  if (res.rows.length > 0) {
    const task = res.rows[0];
    const input = typeof task.input === 'string' ? JSON.parse(task.input) : task.input;

    console.log('=== 聚类任务配置 ===\n');
    console.log('Task ID:', task.id);
    console.log('Created At:', task.created_at);
    console.log('\n输入参数:');
    console.log('  temperature:', input.temperature || '未设置（使用默认值0.7）');
    console.log('  maxTokens:', input.maxTokens || '未设置（使用默认值16000）');

    console.log('\n文档信息:');
    input.documents.forEach((doc, idx) => {
      const clauseMatches = doc.content.match(/第[一二三四五六七八九十百千]+条/g) || [];
      const uniqueClauses = [...new Set(clauseMatches)];
      console.log(`  文档${idx + 1}: ${doc.name}`);
      console.log(`    内容长度: ${doc.content.length} 字符`);
      console.log(`    条款数量: ${uniqueClauses.length} 个`);
    });

    console.log('\n预估Token使用:');
    const totalContent = input.documents.reduce((sum, doc) => sum + doc.content.length, 0);
    const estimatedInputTokens = Math.ceil(totalContent / 2);
    const maxTokens = input.maxTokens || 16000;
    console.log(`  文档总字符数: ${totalContent}`);
    console.log(`  预估输入Token: ${estimatedInputTokens} (约${(estimatedInputTokens / 1000).toFixed(1)}K tokens)`);
    console.log(`  maxTokens设置: ${maxTokens} (输出限制)`);
    console.log(`  总Token容量: ${estimatedInputTokens + maxTokens} (约${((estimatedInputTokens + maxTokens) / 1000).toFixed(1)}K tokens)`);

    console.log('\n分析:');
    if (maxTokens < 16000) {
      console.log('  ⚠️ maxTokens设置较低，可能导致输出被截断');
    }
    if (estimatedInputTokens > 50000) {
      console.log('  ⚠️ 输入Token过大，可能超出模型上下文窗口');
    }
    console.log(`  💡 建议: 对于${input.documents.length}个文档包含${input.documents.reduce((sum, doc) => {
      const matches = doc.content.match(/第[一二三四五六七八九十百千]+条/g) || [];
      return sum + [...new Set(matches)].length;
    }, 0)}个条款的任务，maxTokens应该设置在24000-32000之间`);
  }

  await client.end();
}

checkTaskConfig().catch(console.error);
