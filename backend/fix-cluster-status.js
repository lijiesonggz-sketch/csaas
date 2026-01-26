const { Pool } = require('pg');

async function fixTask() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'csaas',
  });

  try {
    // 获取最新的问卷任务
    const result = await pool.query(`
      SELECT id, status, result, cluster_generation_status
      FROM ai_tasks
      WHERE type = 'questionnaire'
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      console.log('❌ 没有找到问卷任务');
      return;
    }

    const task = result.rows[0];
    console.log('✅ 找到问卷任务:', task.id);
    console.log('状态:', task.status);
    console.log('是否有 result:', !!task.result);
    console.log('是否有 clusterGenerationStatus:', !!task.cluster_generation_status);

    if (task.cluster_generation_status) {
      console.log('✅ 任务已有 clusterGenerationStatus，无需更新');
      return;
    }

    let clusterStatus = null;

    // 尝试从 result 中推断聚类状态
    if (task.result) {
      try {
        const resultData = typeof task.result === 'string' ? JSON.parse(task.result) : task.result;

        if (resultData.selectedResult && resultData.selectedResult.questionnaire) {
          const questionnaire = resultData.selectedResult.questionnaire;

          // 统计每个聚类的问题数
          const clusterStats = {};
          questionnaire.forEach((q) => {
            const clusterId = q.cluster_id || 'unknown';
            if (!clusterStats[clusterId]) {
              clusterStats[clusterId] = {
                clusterId,
                clusterName: q.cluster_name || `聚类 ${clusterId}`,
                questions: 0,
              };
            }
            clusterStats[clusterId].questions++;
          });

          const totalClusters = Object.keys(clusterStats).length;
          const completedClusters = Object.keys(clusterStats);

          clusterStatus = {
            totalClusters,
            completedClusters,
            failedClusters: [],
            pendingClusters: [],
            clusterProgress: {}
          };

          Object.values(clusterStats).forEach((stat) => {
            clusterStatus.clusterProgress[stat.clusterId] = {
              clusterId: stat.clusterId,
              clusterName: stat.clusterName,
              status: 'completed',
              questionsGenerated: stat.questions,
              questionsExpected: 5,
              completedAt: new Date(task.completed_at || task.updated_at).toISOString(),
            };
          });

          console.log('📊 从result推断出的聚类状态:');
          console.log(JSON.stringify(clusterStatus, null, 2));
        }
      } catch (err) {
        console.log('⚠️ 无法解析result:', err.message);
      }
    }

    // 如果无法从result推断，创建模拟状态
    if (!clusterStatus) {
      console.log('📝 创建模拟的部分完成状态以测试断点续跑功能...');

      const totalClusters = 22;
      const completedCount = 9;

      clusterStatus = {
        totalClusters,
        completedClusters: [],
        failedClusters: ['cluster_10'],
        pendingClusters: [],
        clusterProgress: {}
      };

      // 填充进度信息
      for (let i = 1; i <= totalClusters; i++) {
        const clusterId = `cluster_${i}`;
        if (i <= completedCount) {
          clusterStatus.completedClusters.push(clusterId);
          clusterStatus.clusterProgress[clusterId] = {
            clusterId,
            clusterName: `聚类 ${i}`,
            status: 'completed',
            questionsGenerated: 5,
            questionsExpected: 5,
            completedAt: new Date().toISOString(),
          };
        } else if (i === 10) {
          clusterStatus.clusterProgress[clusterId] = {
            clusterId,
            clusterName: `聚类 ${i}`,
            status: 'failed',
            questionsGenerated: 0,
            questionsExpected: 5,
            error: 'AI调用超时',
          };
        } else {
          clusterStatus.pendingClusters.push(clusterId);
          clusterStatus.clusterProgress[clusterId] = {
            clusterId,
            clusterName: `聚类 ${i}`,
            status: 'pending',
            questionsGenerated: 0,
            questionsExpected: 5,
          };
        }
      }

      console.log('📊 模拟的部分完成状态（9/22 完成，1 失败，12 待生成）:');
      console.log(JSON.stringify(clusterStatus, null, 2));
    }

    // 更新数据库
    await pool.query(`
      UPDATE ai_tasks
      SET cluster_generation_status = $1
      WHERE id = $2
    `, [JSON.stringify(clusterStatus), task.id]);

    console.log('✅ 已更新任务的 clusterGenerationStatus');
    console.log('✅ 完成！请刷新问卷页面查看效果');

  } catch (err) {
    console.error('❌ 错误:', err);
  } finally {
    await pool.end();
  }
}

fixTask();
