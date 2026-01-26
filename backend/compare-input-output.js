const { Client } = require('pg');
const fs = require('fs');

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'csaas',
  user: 'postgres',
  password: 'postgres'
});

(async () => {
  try {
    await client.connect();
    const projectId = '8e815c62-f034-4497-8eab-a6f37d42b3d9';

    let output = '';

    // 1. 获取输入的key_practices
    output += '================================================================================\n';
    output += '📊 PART 1: 输入数据 - cluster_2_3的key_practices\n';
    output += '================================================================================\n\n';

    const matrixResult = await client.query(
      "SELECT result FROM ai_tasks WHERE project_id = $1 AND type = 'matrix' AND result IS NOT NULL ORDER BY created_at DESC LIMIT 1",
      [projectId]
    );

    if (matrixResult.rows.length > 0) {
      const resultData = matrixResult.rows[0].result;
      let content;
      if (typeof resultData.content === 'string') {
        content = JSON.parse(resultData.content);
      } else {
        content = resultData.content;
      }

      const cluster = content.matrix.find(row => row.cluster_id === 'cluster_2_3');

      if (cluster) {
        const levels = ['level_1', 'level_2', 'level_3', 'level_4', 'level_5'];
        levels.forEach(levelKey => {
          const level = cluster.levels[levelKey];
          output += `${level.name}的关键实践:\n`;
          level.key_practices.forEach(practice => {
            output += `  - ${practice}\n`;
          });
          output += '\n';
        });
      }
    }

    // 2. 获取生成的问题
    output += '\n\n';
    output += '================================================================================\n';
    output += '📝 PART 2: 输出数据 - cluster_2_3生成的问卷问题\n';
    output += '================================================================================\n\n';

    const qResult = await client.query(
      "SELECT id, result FROM ai_tasks WHERE project_id = $1 AND type = 'questionnaire' AND result IS NOT NULL ORDER BY created_at LIMIT 1",
      [projectId]
    );

    if (qResult.rows.length > 0) {
      const resultData = qResult.rows[0].result;
      let parsed;
      if (typeof resultData === 'string') {
        parsed = JSON.parse(resultData);
      } else {
        parsed = resultData;
      }

      if (parsed.selectedResult && parsed.selectedResult.questionnaire) {
        const questions = parsed.selectedResult.questionnaire;
        const clusterQuestions = questions.filter(q => q.cluster_id === 'cluster_2_3');

        output += `共 ${clusterQuestions.length} 题\n\n`;

        clusterQuestions.forEach((q, i) => {
          output += '='.repeat(80) + '\n';
          output += `问题${i+1}: ${q.question_id}\n`;
          output += `维度: ${q.dimension}\n`;
          output += `类型: ${q.question_type}\n`;
          output += `题目: ${q.question_text}\n`;
          output += '\n选项:\n';
          q.options.forEach((opt) => {
            output += `  ${opt.option_id}. ${opt.text}\n`;
            if (opt.score !== undefined) output += `     得分: ${opt.score}\n`;
            if (opt.level) output += `     级别: ${opt.level}\n`;
            if (opt.description) output += `     描述: ${opt.description}\n`;
          });
          output += '\n';
        });
      }
    }

    // 3. 分析对比
    output += '\n\n';
    output += '================================================================================\n';
    output += '🔍 PART 3: 分析对比\n';
    output += '================================================================================\n\n';

    output += '❓ AI是否利用了输入的key_practices？\n\n';

    // 重新获取问题进行分析
    if (qResult.rows.length > 0) {
      const resultData = qResult.rows[0].result;
      let parsed;
      if (typeof resultData === 'string') {
        parsed = JSON.parse(resultData);
      } else {
        parsed = resultData;
      }

      if (parsed.selectedResult && parsed.selectedResult.questionnaire) {
        const questions = parsed.selectedResult.questionnaire;
        const clusterQuestions = questions.filter(q => q.cluster_id === 'cluster_2_3');

        // 分析每个问题是否引用了key_practices
        clusterQuestions.forEach((q, i) => {
          output += `问题${i+1} (${q.dimension}):\n`;
          output += `  题目: ${q.question_text.substring(0, 50)}...\n`;

          // 检查选项是否引用了具体实践
          let hasSpecificPractice = false;
          q.options.forEach((opt) => {
            // 检查选项文本是否包含具体的管理体系、审批、脱敏、评估等关键词
            const keywords = ['管理体系', '专职团队', '审批', '脱敏', '评估', '审计', '授权', '监控', '匿名化', '去标识化'];
            if (keywords.some(kw => opt.text.includes(kw))) {
              hasSpecificPractice = true;
            }
          });

          if (hasSpecificPractice) {
            output += `  ✅ 选项中包含了具体的实践关键词\n`;
          } else {
            output += `  ⚠️ 选项较为笼统，未明确引用具体实践\n`;
          }
          output += '\n';
        });
      }
    }

    output += '\n';
    output += '💡 初步结论:\n';
    output += '1. AI是否使用了description（详细描述）：\n';
    output += '   - 需要检查问题文本是否提及"企业级数据服务管理体系"、"脱敏处理"、"审批流程"等具体术语\n\n';
    output += '2. AI是否使用了key_practices（关键实践）：\n';
    output += '   - 需要检查选项是否对应"建立专职团队"、"实施脱敏"、"开展评估"等具体措施\n\n';
    output += '3. 问题的针对性:\n';
    output += '   - 如果选项只是"有/无"、"完善/不完善"，说明AI没有充分利用输入\n';
    output += '   - 如果选项包含具体的管理措施，说明AI较好地利用了输入\n';

    console.log(output);
    fs.writeFileSync('cluster-2-3-comparison.txt', output, 'utf8');
    console.log('\n✅ 详细对比已保存到: cluster-2-3-comparison.txt');

  } finally {
    await client.end();
  }
})();
