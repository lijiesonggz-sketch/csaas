/**
 * 获取问卷中的所有聚类名称
 */
const axios = require('axios');

async function getClusters() {
  try {
    const response = await axios.get('http://localhost:3000/ai-generation/result/c0724466-1abc-4895-8b08-37f460aada2e');
    const questionnaire = response.data.data.selectedResult.questionnaire;

    const clusters = new Map();

    for (const q of questionnaire) {
      if (q.cluster_name && !clusters.has(q.cluster_id)) {
        clusters.set(q.cluster_id, q.cluster_name);
      }
    }

    console.log('=== 所有聚类名称 ===\n');
    let index = 1;
    for (const [id, name] of clusters.entries()) {
      console.log(`${index}. ${name}`);
      index++;
    }

    console.log(`\n总计: ${clusters.size} 个聚类`);

  } catch (error) {
    console.error('获取失败:', error.message);
  }
}

getClusters();
