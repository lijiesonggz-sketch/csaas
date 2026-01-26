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

    // 1. 输入：key_practices
    output += '================================================================================\n';
    output += 'PART 1: 输入 - cluster_2_3的key_practices\n';
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

    // 2. 输出：生成的问题
    output += '\n\n';
    output += '================================================================================\n';
    output += 'PART 2: 输出 - cluster_2_3生成的问卷问题\n';
    output += '================================================================================\n\n';

    const qResult = await client.query(
      "SELECT result FROM ai_tasks WHERE project_id = $1 AND type = 'questionnaire' AND result IS NOT NULL ORDER BY created_at",
      [projectId]
    );

    let found = false;
    for (const row of qResult.rows) {
      if (found) break;

      let parsed;
      if (typeof row.result === 'string') {
        parsed = JSON.parse(row.result);
      } else {
        parsed = row.result;
      }

      let questions = null;
      if (parsed.questionnaire) {
        questions = parsed.questionnaire;
      } else if (parsed.content && parsed.content.questionnaire) {
        questions = parsed.content.questionnaire;
      } else if (parsed.selectedResult && parsed.selectedResult.questionnaire) {
        questions = parsed.selectedResult.questionnaire;
      }

      if (questions) {
        const clusterQuestions = questions.filter(q => q.cluster_id === 'cluster_2_3');

        if (clusterQuestions.length > 0) {
          found = true;
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
    }

    if (!found) {
      output += '❌ 未找到cluster_2_3的问题\n';
    }

    // 3. 分析
    output += '\n\n';
    output += '================================================================================\n';
    output += 'PART 3: 分析对比\n';
    output += '================================================================================\n\n';

    // 重新获取问题进行分析
    for (const row of qResult.rows) {
      let parsed;
      if (typeof row.result === 'string') {
        parsed = JSON.parse(row.result);
      } else {
        parsed = row.result;
      }

      let questions = null;
      if (parsed.questionnaire) {
        questions = parsed.questionnaire;
      } else if (parsed.content && parsed.content.questionnaire) {
        questions = parsed.content.questionnaire;
      } else if (parsed.selectedResult && parsed.selectedResult.questionnaire) {
        questions = parsed.selectedResult.questionnaire;
      }

      if (questions) {
        const clusterQuestions = questions.filter(q => q.cluster_id === 'cluster_2_3');

        if (clusterQuestions.length > 0) {
          // 关键词列表（从key_practices中提取）
          const keywords = [
            '数据服务管理体系',
            '专职团队',
            '脱敏',
            '审批',
            '授权',
            '审计',
            '安全评估',
            '匿名化',
            '去标识化',
            '敏感性标识',
            '数据保存期限',
            '终端存储',
            '移动介质'
          ];

          clusterQuestions.forEach((q, i) => {
            output += `问题${i+1}分析:\n`;
            output += `  维度: ${q.dimension}\n`;
            output += `  题目: ${q.question_text}\n`;

            // 检查题目是否包含关键词
            const questionKeywords = keywords.filter(kw => q.question_text.includes(kw));
            if (questionKeywords.length > 0) {
              output += `  ✅ 题目包含关键词: ${questionKeywords.join(', ')}\n`;
            } else {
              output += `  ⚠️  题目较为笼统，未包含具体实践术语\n`;
            }

            // 检查选项是否包含关键词
            const optionsWithKeywords = [];
            q.options.forEach((opt) => {
              const optKeywords = keywords.filter(kw => opt.text.includes(kw));
              if (optKeywords.length > 0) {
                optionsWithKeywords.push({
                  opt: opt.option_id,
                  keywords: optKeywords
                });
              }
            });

            if (optionsWithKeywords.length > 0) {
              output += `  ✅ ${optionsWithKeywords.length}/${q.options.length}个选项包含具体实践\n`;
              optionsWithKeywords.forEach(({opt, keywords: kws}) => {
                output += `     选项${opt}: ${kws.join(', ')}\n`;
              });
            } else {
              output += `  ⚠️ 所有选项都较为笼统，未引用具体实践措施\n`;
            }

            output += '\n';
          });

          break;
        }
      }
    }

    console.log(output);
    fs.writeFileSync('cluster-2-3-analysis.txt', output, 'utf8');
    console.log('\n✅ 完整分析已保存到: cluster-2-3-analysis.txt');

  } finally {
    await client.end();
  }
})();
