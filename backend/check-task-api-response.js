const axios = require('axios');

(async () => {
  try {
    const taskId = 'da4fd487-5646-4fd1-a46f-3433a40a0ae2';
    const response = await axios.get(`http://localhost:3000/ai-tasks/${taskId}`);

    console.log('📡 API响应:');
    console.log('Status:', response.status);
    console.log('Task data:');
    const task = response.data;
    console.log('  id:', task.id);
    console.log('  type:', task.type);
    console.log('  status:', task.status);

    console.log('\n📦 result结构:');
    console.log('  result类型:', typeof task.result);
    console.log('  result键:', Object.keys(task.result || {}));

    if (task.result?.questionnaire) {
      console.log('\n✅ questionnaire字段存在:');
      console.log('  类型:', Array.isArray(task.result.questionnaire) ? '数组' : typeof task.result.questionnaire);
      console.log('  长度:', task.result.questionnaire?.length);
      console.log('  前3题:');
      task.result.questionnaire.slice(0, 3).forEach((q, i) => {
        console.log(`    ${i + 1}. ${q.question_text?.substring(0, 50)}...`);
      });
    }

    if (task.result?.questionnaire_metadata) {
      console.log('\n✅ questionnaire_metadata字段存在:');
      console.log(JSON.stringify(task.result.questionnaire_metadata, null, 2));
    }

    if (task.result?.content) {
      console.log('\n⚠️ content字段存在:');
      console.log('  类型:', typeof task.result.content);
      console.log('  值:', typeof task.result.content === 'string' ? task.result.content.substring(0, 200) : Object.keys(task.result.content));
    }

  } catch (error) {
    console.error('❌ 错误:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
})();
