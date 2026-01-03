/**
 * 测试成熟度分析功能
 * 1. 获取问卷
 * 2. 创建问卷填写记录并随机生成答案
 * 3. 提交问卷
 * 4. 调用成熟度分析API
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const QUESTIONNAIRE_TASK_ID = 'c0724466-1abc-4895-8b08-37f460aada2e';

async function main() {
  try {
    console.log('=== 测试成熟度分析功能 ===\n');

    // 1. 获取问卷内容
    console.log('1. 获取问卷内容...');
    const questionnaireResponse = await axios.get(
      `${BASE_URL}/ai-generation/result/${QUESTIONNAIRE_TASK_ID}`
    );

    const questionnaire = questionnaireResponse.data.data.questionnaire;
    console.log(`✓ 获取成功: ${questionnaire.length} 个问题\n`);

    // 2. 创建问卷填写记录
    console.log('2. 创建问卷填写记录...');
    const createResponse = await axios.post(`${BASE_URL}/survey`, {
      questionnaireTaskId: QUESTIONNAIRE_TASK_ID,
      respondentName: '测试用户',
      respondentEmail: 'test@example.com',
      respondentDepartment: '技术部',
      respondentPosition: '工程师',
    });

    const surveyId = createResponse.data.data.id;
    console.log(`✓ 创建成功, Survey ID: ${surveyId}\n`);

    // 3. 生成随机答案
    console.log('3. 生成随机答案...');
    const answers = {};
    let totalScore = 0;
    let maxScore = 0;

    for (const question of questionnaire) {
      if (!question.options || question.options.length === 0) {
        console.warn(`⚠ 问题 ${question.question_id} 没有选项，跳过`);
        continue;
      }

      if (question.question_type === 'SINGLE_CHOICE') {
        // 单选题: 随机选择一个选项 (倾向选择中等成熟度)
        const randomIndex = Math.floor(Math.random() * 3) + 1; // 倾向选择索引1-3(中等)
        const selectedIndex = Math.min(randomIndex, question.options.length - 1);
        const selectedOption = question.options[selectedIndex];

        answers[question.question_id] = {
          answer: selectedOption.option_id,
          score: selectedOption.score,
        };

        totalScore += selectedOption.score;
        maxScore += 5; // 单选题最高5分
      } else if (question.question_type === 'MULTIPLE_CHOICE') {
        // 多选题: 随机选择1-3个选项
        const numSelections = Math.floor(Math.random() * 3) + 1;
        const selectedOptions = [];
        const selectedIndices = new Set();

        while (selectedIndices.size < numSelections && selectedIndices.size < question.options.length) {
          const randomIndex = Math.floor(Math.random() * question.options.length);
          selectedIndices.add(randomIndex);
        }

        let questionScore = 0;
        for (const index of selectedIndices) {
          const option = question.options[index];
          selectedOptions.push(option.option_id);
          questionScore += option.score;
        }

        answers[question.question_id] = {
          answer: selectedOptions,
          score: questionScore,
        };

        totalScore += questionScore;
        maxScore += 5; // 多选题最高5分
      }
    }

    console.log(`✓ 生成完成: ${Object.keys(answers).length} 个答案`);
    console.log(`  总分: ${totalScore}/${maxScore}\n`);

    // 4. 提交问卷
    console.log('4. 提交问卷...');
    const submitResponse = await axios.post(`${BASE_URL}/survey/${surveyId}/submit`, {
      answers,
      totalScore,
      maxScore,
      notes: '这是一个测试提交',
    });

    console.log(`✓ 提交成功\n`);

    // 5. 调用成熟度分析API
    console.log('5. 调用成熟度分析API...');
    const analysisResponse = await axios.post(`${BASE_URL}/survey/${surveyId}/analyze`);

    const analysis = analysisResponse.data.data;

    console.log('✓ 分析完成\n');
    console.log('=== 成熟度分析结果 ===\n');

    // 输出总体成熟度
    console.log('【总体成熟度】');
    console.log(`  等级: ${analysis.overall.maturityLevel.toFixed(2)} (${analysis.overall.grade})`);
    console.log(`  计算: ${analysis.overall.calculation.formula}`);
    console.log(`  说明: ${analysis.overall.description}\n`);

    // 输出成熟度分布
    console.log('【成熟度分布】');
    console.log(`  Level 1: ${analysis.distribution.level_1} 个聚类`);
    console.log(`  Level 2: ${analysis.distribution.level_2} 个聚类`);
    console.log(`  Level 3: ${analysis.distribution.level_3} 个聚类`);
    console.log(`  Level 4: ${analysis.distribution.level_4} 个聚类`);
    console.log(`  Level 5: ${analysis.distribution.level_5} 个聚类\n`);

    // 输出维度成熟度
    console.log('【维度成熟度】');
    for (const dim of analysis.dimensionMaturity) {
      console.log(`  ${dim.dimension}: ${dim.maturityLevel.toFixed(2)} (${dim.grade}) - ${dim.clusterCount} 个聚类`);
    }
    console.log();

    // 输出冲突检测
    console.log('【冲突检测】');
    console.log(`  聚类内冲突: ${analysis.conflicts.intraClusterConflicts.length} 个`);
    console.log(`  聚类间冲突: ${analysis.conflicts.interClusterConflicts.length} 个`);
    if (analysis.conflicts.intraClusterConflicts.length > 0) {
      console.log('\n  聚类内冲突详情:');
      for (const conflict of analysis.conflicts.intraClusterConflicts) {
        console.log(`    - ${conflict.cluster_name}: ${conflict.description}`);
        console.log(`      方差: ${conflict.variance}, 建议: ${conflict.suggestion}`);
      }
    }
    if (analysis.conflicts.interClusterConflicts.length > 0) {
      console.log('\n  聚类间冲突详情:');
      for (const conflict of analysis.conflicts.interClusterConflicts) {
        console.log(`    - ${conflict.description}`);
        console.log(`      建议: ${conflict.suggestion}`);
      }
    }
    console.log();

    // 输出TOP 5短板
    console.log('【TOP 5 短板】');
    for (const item of analysis.topShortcomings) {
      console.log(`  ${item.rank}. ${item.cluster_name}: ${item.maturityLevel.toFixed(2)} (差距 ${item.gap.toFixed(2)})`);
    }
    console.log();

    // 输出TOP 5优势
    console.log('【TOP 5 优势】');
    for (const item of analysis.topStrengths) {
      console.log(`  ${item.rank}. ${item.cluster_name}: ${item.maturityLevel.toFixed(2)} (优势 ${item.advantage.toFixed(2)})`);
    }
    console.log();

    // 输出统计信息
    console.log('【统计信息】');
    console.log(`  总问题数: ${analysis.statistics.totalQuestions}`);
    console.log(`  总聚类数: ${analysis.statistics.totalClusters}`);
    console.log(`  平均聚类成熟度: ${analysis.statistics.averageClusterMaturity.toFixed(2)}`);
    console.log(`  最高聚类成熟度: ${analysis.statistics.maxClusterMaturity.toFixed(2)}`);
    console.log(`  最低聚类成熟度: ${analysis.statistics.minClusterMaturity.toFixed(2)}`);
    console.log(`  聚类成熟度标准差: ${analysis.statistics.clusterMaturityStdDev.toFixed(2)}`);
    console.log();

    // 输出聚类详情 (显示前3个)
    console.log('【聚类详情】(显示前3个)');
    for (let i = 0; i < Math.min(3, analysis.clusterMaturity.length); i++) {
      const cluster = analysis.clusterMaturity[i];
      console.log(`\n  聚类 ${i + 1}: ${cluster.cluster_name} (${cluster.dimension})`);
      console.log(`    成熟度: ${cluster.maturityLevel.toFixed(2)} (${cluster.grade})`);
      console.log(`    计算: ${cluster.calculation}`);
      console.log(`    问题数: ${cluster.questionsCount}`);
      console.log(`    是否短板: ${cluster.isShortcoming ? '是' : '否'}`);
      console.log(`    问题列表:`);
      for (const q of cluster.questions) {
        console.log(`      - ${q.question_text.substring(0, 50)}... (得分: ${q.score}/5)`);
      }
    }

    console.log('\n=== 测试完成 ===');
    console.log(`Survey ID: ${surveyId}`);
    console.log(`可以使用此ID继续测试前端页面`);

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    if (error.response) {
      console.error('错误响应:', JSON.stringify(error.response.data, null, 2));
    }
    if (error.stack) {
      console.error('错误堆栈:', error.stack);
    }
  }
}

main();
