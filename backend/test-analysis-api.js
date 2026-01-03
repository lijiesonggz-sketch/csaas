/**
 * 测试成熟度分析API，验证是否返回selected_option_text
 */

const fetch = require('node-fetch');

async function testAnalysis() {
  try {
    console.log('=== 测试成熟度分析API ===\n');

    // 使用一个已提交的问卷ID
    const surveyId = '2708e976-552e-487a-a16f-5e383e46f3f7';

    console.log(`测试 Survey ID: ${surveyId}\n`);

    const response = await fetch(`http://localhost:3000/survey/${surveyId}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ API调用失败:', error);
      return;
    }

    const data = await response.json();

    if (!data.success) {
      console.error('❌ 分析失败:', data.message);
      return;
    }

    console.log('✓ API调用成功\n');

    const result = data.data;

    // 1. 检查聚类间冲突
    console.log('【聚类间冲突检测】');
    console.log(`聚类间冲突数量: ${result.conflicts.interCluster.length}`);
    if (result.conflicts.interCluster.length > 0) {
      console.log('✓ 有聚类间冲突数据:');
      result.conflicts.interCluster.forEach((c, i) => {
        console.log(`  ${i + 1}. ${c.description}`);
        console.log(`     前置: ${c.prerequisiteCluster.cluster_name} (${c.prerequisiteCluster.maturityLevel})`);
        console.log(`     依赖: ${c.dependentCluster.cluster_name} (${c.dependentCluster.maturityLevel})`);
      });
    } else {
      console.log('  无聚类间冲突');
    }
    console.log();

    // 2. 检查问题详情中的selected_option_text
    console.log('【问题详情 - 答案文本检查】');
    const firstCluster = result.clusterMaturity[0];
    console.log(`检查聚类: ${firstCluster.cluster_name}`);
    console.log(`问题数量: ${firstCluster.questions.length}\n`);

    const firstQuestion = firstCluster.questions[0];
    console.log('第一个问题:');
    console.log(`  题目: ${firstQuestion.question_text.substring(0, 50)}...`);
    console.log(`  selected_option: ${firstQuestion.selected_option}`);
    console.log(`  selected_option_text: ${firstQuestion.selected_option_text || '❌ 缺失'}`);
    console.log(`  得分: ${firstQuestion.score}/5`);

    if (firstQuestion.selected_option_text) {
      console.log('\n✓ 后端已正确返回 selected_option_text');
    } else {
      console.log('\n❌ 后端未返回 selected_option_text，需要等待重新编译');
    }

    // 3. 检查成熟度分布
    console.log('\n【成熟度分布】');
    let totalClusters = 0;
    for (let i = 1; i <= 5; i++) {
      const count = result.distribution[`level_${i}`];
      totalClusters += count;
      console.log(`  Level ${i}: ${count} 个聚类`);
    }
    console.log(`  总计: ${totalClusters} 个聚类 (应该=22)`);

    if (totalClusters === 22) {
      console.log('✓ 成熟度分布统计正确');
    } else {
      console.log('❌ 成熟度分布统计错误');
    }

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

testAnalysis();
