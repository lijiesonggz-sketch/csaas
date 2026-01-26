const { Client } = require('pg');

async function showResult() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  const result = await client.query(
    "SELECT result FROM ai_tasks WHERE id = '01b153b7-a93a-4d87-8b71-5b55a02ed1bb'"
  );

  if (result.rows.length > 0 && result.rows[0].result) {
    const taskResult = result.rows[0].result;
    let content = taskResult.content ? JSON.parse(taskResult.content) : taskResult.gpt4;
    
    console.log('='.repeat(70));
    console.log('📝 综述标题:', content.title);
    console.log('='.repeat(70));
    console.log('\n📊 文档对比分析:\n');
    
    if (content.document_comparison) {
      const dc = content.document_comparison;
      
      console.log('1. 文档关系:');
      console.log('   ', dc.relationships);
      
      if (dc.conflicts && dc.conflicts.length > 0) {
        console.log('\n2. 冲突与差异 (共' + dc.conflicts.length + '项):');
        dc.conflicts.forEach((c, i) => {
          console.log(`   ${i+1}. ${c.topic} [${c.severity}]`);
          console.log('      ', c.description.substring(0, 80) + '...');
          console.log('      涉及: ' + c.documents_involved.join(', '));
        });
      }
      
      if (dc.similarities && dc.similarities.length > 0) {
        console.log('\n3. 相似之处 (共' + dc.similarities.length + '项):');
        dc.similarities.forEach((s, i) => {
          console.log(`   ${i+1}. ${s.topic}`);
          console.log('      ', s.description);
        });
      }
    }
  }

  await client.end();
}

showResult();
