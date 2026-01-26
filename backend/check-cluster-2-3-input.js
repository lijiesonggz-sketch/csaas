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
    const outputFile = 'cluster-2-3-input-info.txt';

    let output = '';

    // 1. 查询矩阵任务
    output += '==================================================\n';
    output += '步骤1: 查询矩阵任务\n';
    output += '==================================================\n\n';

    const matrixResult = await client.query(
      "SELECT id, result, input FROM ai_tasks WHERE project_id = $1 AND type = 'matrix' AND status = 'completed' ORDER BY created_at DESC LIMIT 1",
      [projectId]
    );

    if (matrixResult.rows.length > 0) {
      const task = matrixResult.rows[0];
      output += `矩阵任务ID: ${task.id}\n`;
      output += `Result存在: ${!!task.result}\n`;
      output += `Input存在: ${!!task.input}\n\n`;

      // 尝试解析result
      if (task.result) {
        try {
          let parsed;
          if (typeof task.result === 'string') {
            parsed = JSON.parse(task.result);
          } else {
            parsed = task.result;
          }

          output += `Result顶层字段: ${Object.keys(parsed).join(', ')}\n\n`;

          // 查找cluster_2_3
          let matrix = null;
          if (parsed.content && parsed.content.matrix) {
            matrix = parsed.content.matrix;
          } else if (parsed.selectedResult && parsed.selectedResult.matrix) {
            matrix = parsed.selectedResult.matrix;
          }

          if (matrix) {
            output += `矩阵行数: ${matrix.length}\n\n`;

            const targetCluster = matrix.find(row => row.cluster_id === 'cluster_2_3');

            if (targetCluster) {
              output += '✅ 找到cluster_2_3（数据使用、加工与展示）\n';
              output += '==================================================\n\n';
              output += JSON.stringify(targetCluster, null, 2);
              output += '\n\n';
            } else {
              output += '❌ 未找到cluster_2_3\n\n';
              output += '可用的clusters:\n';
              matrix.forEach(row => {
                output += `  - ${row.cluster_id}: ${row.cluster_name}\n`;
              });
              output += '\n';
            }
          }
        } catch (e) {
          output += `解析result失败: ${e.message}\n\n`;
        }
      }
    }

    // 2. 查询问卷任务
    output += '\n\n';
    output += '==================================================\n';
    output += '步骤2: 查询问卷任务输入\n';
    output += '==================================================\n\n';

    const questionnaireResult = await client.query(
      "SELECT id, input FROM ai_tasks WHERE project_id = $1 AND type = 'questionnaire' AND input IS NOT NULL ORDER BY created_at DESC LIMIT 1",
      [projectId]
    );

    if (questionnaireResult.rows.length > 0) {
      const task = questionnaireResult.rows[0];
      output += `问卷任务ID: ${task.id}\n\n`;

      if (task.input) {
        try {
          const inputData = task.input;
          output += `Input顶层字段: ${Object.keys(inputData).join(', ')}\n\n`;

          if (inputData.matrixResult) {
            output += `matrixResult字段: ${Object.keys(inputData.matrixResult).join(', ')}\n\n`;

            if (inputData.matrixResult.selectedResult && inputData.matrixResult.selectedResult.matrix) {
              const matrix = inputData.matrixResult.selectedResult.matrix;
              output += `矩阵行数: ${matrix.length}\n\n`;

              const targetCluster = matrix.find(row => row.cluster_id === 'cluster_2_3');

              if (targetCluster) {
                output += '✅ 在问卷任务的input中找到cluster_2_3\n';
                output += '==================================================\n\n';
                output += JSON.stringify(targetCluster, null, 2);
              }
            }
          }
        } catch (e) {
          output += `解析input失败: ${e.message}\n`;
        }
      }
    }

    // 3. 查询问卷结果中的cluster_2_3题目
    output += '\n\n';
    output += '==================================================\n';
    output += '步骤3: 查询问卷结果中cluster_2_3的题目\n';
    output += '==================================================\n\n';

    const qResultResult = await client.query(
      "SELECT id, result FROM ai_tasks WHERE project_id = $1 AND type = 'questionnaire' AND result IS NOT NULL ORDER BY created_at DESC LIMIT 1",
      [projectId]
    );

    if (qResultResult.rows.length > 0) {
      const task = qResultResult.rows[0];

      if (task.result) {
        try {
          let parsed;
          if (typeof task.result === 'string') {
            parsed = JSON.parse(task.result);
          } else {
            parsed = task.result;
          }

          if (parsed.selectedResult && parsed.selectedResult.questionnaire) {
            const questions = parsed.selectedResult.questionnaire;
            const clusterQuestions = questions.filter(q => q.cluster_id === 'cluster_2_3');

            output += `cluster_2_3的题目数量: ${clusterQuestions.length}\n\n`;

            clusterQuestions.forEach((q, i) => {
              output += `\n问题${i + 1}: ${q.question_id}\n`;
              output += `  维度: ${q.dimension || 'N/A'}\n`;
              output += `  类型: ${q.question_type}\n`;
              output += `  题目: ${q.question_text}\n`;
              output += `  选项数: ${q.options.length}\n`;
            });
          }
        } catch (e) {
          output += `解析问卷结果失败: ${e.message}\n`;
        }
      }
    }

    fs.writeFileSync(outputFile, output, 'utf8');
    console.log('✅ 输出已保存到:', outputFile);
    console.log(output);

  } finally {
    await client.end();
  }
})();
