const { Client } = require('pg');

async function checkResult() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  const taskId = '01b153b7-a93a-4d87-8b71-5b55a02ed1bb';

  const result = await client.query(
    'SELECT result FROM ai_tasks WHERE id = $1',
    [taskId]
  );

  if (result.rows.length > 0 && result.rows[0].result) {
    const taskResult = result.rows[0].result;
    
    console.log('✅ 任务结果存在\n');
    
    let content = null;
    if (taskResult.content) {
      content = typeof taskResult.content === 'string' 
        ? JSON.parse(taskResult.content) 
        : taskResult.content;
    } else if (taskResult.gpt4) {
      content = taskResult.gpt4;
    }
    
    if (content) {
      console.log('标题:', content.title);
      console.log('有document_comparison字段:', !!content.document_comparison);
      
      if (content.document_comparison) {
        console.log('');
        console.log('📊 文档对比分析:');
        console.log('  关系:', content.document_comparison.relationships?.substring(0, 100) + '...');
        console.log('  冲突数量:', content.document_comparison.conflicts?.length || 0);
        console.log('  相似之处数量:', content.document_comparison.similarities?.length || 0);
        
        if (content.document_comparison.conflicts && content.document_comparison.conflicts.length > 0) {
          console.log('\n  冲突示例:');
          content.document_comparison.conflicts.slice(0, 2).forEach((c, i) => {
            console.log(`    ${i+1}. ${c.topic} (${c.severity})`);
          });
        }
      } else {
        console.log('\n❌ 没有document_comparison字段（旧任务）');
      }
    }
  }

  await client.end();
}

checkResult();
