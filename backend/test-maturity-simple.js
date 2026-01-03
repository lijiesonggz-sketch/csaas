/**
 * 简化版成熟度分析测试 - 使用Node.js内置fetch
 */

const BASE_URL = 'http://localhost:3000';
const QUESTIONNAIRE_TASK_ID = 'c0724466-1abc-4895-8b08-37f460aada2e';

async function test() {
  try {
    console.log('=== 成熟度分析测试 ===\n');

    // 1. 获取问卷
    console.log('1. 获取问卷内容...');
    const questionnaireRes = await fetch(`${BASE_URL}/ai-generation/result/${QUESTIONNAIRE_TASK_ID}`);
    const questionnaireData = await questionnaireRes.json();

    console.log('API响应结构:', Object.keys(questionnaireData));
    if (questionnaireData.data) {
      console.log('data字段结构:', Object.keys(questionnaireData.data));
    }

    // 检查questionnaire是直接在data下还是在data.selectedResult下
    let questionnaire;
    if (questionnaireData.data?.questionnaire) {
      questionnaire = questionnaireData.data.questionnaire;
    } else if (questionnaireData.data?.selectedResult?.questionnaire) {
      questionnaire = questionnaireData.data.selectedResult.questionnaire;
    } else {
      console.error('无法找到questionnaire数据');
      console.log('完整响应:', JSON.stringify(questionnaireData, null, 2).substring(0, 500));
      return;
    }

    console.log(`✓ 获取到 ${questionnaire.length} 个问题\n`);

    // 2. 创建问卷填写
    console.log('2. 创建问卷填写记录...');
    const createRes = await fetch(`${BASE_URL}/survey`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionnaireTaskId: QUESTIONNAIRE_TASK_ID,
        respondentName: '测试用户',
        respondentEmail: 'test@test.com',
        respondentDepartment: '技术部',
        respondentPosition: '工程师'
      })
    });
    const createData = await createRes.json();
    const surveyId = createData.data.id;
    console.log(`✓ 创建成功: ${surveyId}\n`);

    // 3. 生成答案 (随机选择,倾向中等成熟度)
    console.log('3. 生成测试答案...');
    const answers = {};
    let totalScore = 0;
    let maxScore = 0;

    for (const q of questionnaire) {
      if (!q.options || q.options.length === 0) continue;

      if (q.question_type === 'SINGLE_CHOICE') {
        // 倾向选择中间的选项 (索引1-3)
        const idx = Math.min(Math.floor(Math.random() * 3) + 1, q.options.length - 1);
        const opt = q.options[idx];
        answers[q.question_id] = {
          answer: opt.option_id,
          score: opt.score
        };
        totalScore += opt.score;
        maxScore += 5;
      } else if (q.question_type === 'MULTIPLE_CHOICE') {
        // 随机选1-2个选项
        const numSel = Math.floor(Math.random() * 2) + 1;
        const selectedOpts = [];
        let qScore = 0;

        for (let i = 0; i < Math.min(numSel, q.options.length); i++) {
          const idx = Math.floor(Math.random() * q.options.length);
          if (!selectedOpts.includes(q.options[idx].option_id)) {
            selectedOpts.push(q.options[idx].option_id);
            qScore += q.options[idx].score;
          }
        }

        answers[q.question_id] = {
          answer: selectedOpts,
          score: qScore
        };
        totalScore += qScore;
        maxScore += 5;
      }
    }

    console.log(`✓ 生成 ${Object.keys(answers).length} 个答案, 总分: ${totalScore}/${maxScore}\n`);

    // 4. 提交问卷
    console.log('4. 提交问卷...');
    const submitRes = await fetch(`${BASE_URL}/survey/${surveyId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        answers,
        totalScore,
        maxScore,
        notes: '自动化测试数据'
      })
    });
    const submitData = await submitRes.json();
    console.log(`✓ 提交成功\n`);

    // 5. 调用成熟度分析
    console.log('5. 调用成熟度分析API...');
    const analysisRes = await fetch(`${BASE_URL}/survey/${surveyId}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const analysisData = await analysisRes.json();

    if (!analysisData.success) {
      console.error('❌ 分析失败:', analysisData);
      return;
    }

    const result = analysisData.data;
    console.log('✓ 分析完成!\n');

    // 6. 输出结果
    console.log('=== 成熟度分析结果 ===\n');
    console.log(`【总体成熟度】`);
    console.log(`  等级: ${result.overall.maturityLevel.toFixed(2)} (${result.overall.grade})`);
    console.log(`  计算: ${result.overall.calculation.formula}`);
    console.log(`  说明: ${result.overall.description}\n`);

    console.log(`【成熟度分布】`);
    console.log(`  Level 1: ${result.distribution.level_1} 个聚类`);
    console.log(`  Level 2: ${result.distribution.level_2} 个聚类`);
    console.log(`  Level 3: ${result.distribution.level_3} 个聚类`);
    console.log(`  Level 4: ${result.distribution.level_4} 个聚类`);
    console.log(`  Level 5: ${result.distribution.level_5} 个聚类\n`);

    console.log(`【维度成熟度】`);
    for (const dim of result.dimensionMaturity) {
      console.log(`  ${dim.dimension}: ${dim.maturityLevel.toFixed(2)} (${dim.grade})`);
    }
    console.log();

    console.log(`【冲突检测】`);
    console.log(`  聚类内冲突: ${result.conflicts.intraCluster.length} 个`);
    console.log(`  聚类间冲突: ${result.conflicts.interCluster.length} 个`);
    console.log(`  冲突严重程度: ${result.conflicts.severity}`);
    if (result.conflicts.intraCluster.length > 0) {
      console.log(`\n  聚类内冲突:`);
      result.conflicts.intraCluster.slice(0, 3).forEach(c => {
        console.log(`    - ${c.cluster_name}: 方差=${c.variance.toFixed(2)}`);
      });
    }
    console.log();

    console.log(`【TOP 5 短板】`);
    result.topShortcomings.forEach(item => {
      console.log(`  ${item.rank}. ${item.cluster_name}: ${item.maturityLevel.toFixed(2)}`);
    });
    console.log();

    console.log(`【TOP 5 优势】`);
    result.topStrengths.forEach(item => {
      console.log(`  ${item.rank}. ${item.cluster_name}: ${item.maturityLevel.toFixed(2)}`);
    });
    console.log();

    console.log(`【统计信息】`);
    console.log(`  总问题数: ${result.statistics.totalQuestions}`);
    console.log(`  总聚类数: ${result.statistics.totalClusters}`);
    console.log(`  平均聚类成熟度: ${result.statistics.averageClusterMaturity.toFixed(2)}`);
    console.log(`  聚类成熟度标准差: ${result.statistics.clusterMaturityStdDev.toFixed(2)}\n`);

    console.log(`【聚类详情】(前3个)`);
    result.clusterMaturity.slice(0, 3).forEach((c, i) => {
      console.log(`\n  ${i+1}. ${c.cluster_name} (${c.dimension})`);
      console.log(`     成熟度: ${c.maturityLevel.toFixed(2)} (${c.grade})`);
      console.log(`     计算: ${c.calculation}`);
      console.log(`     问题数: ${c.questionsCount}`);
      console.log(`     是否短板: ${c.isShortcoming ? '是' : '否'}`);
    });

    console.log('\n\n=== 测试成功 ===');
    console.log(`Survey ID: ${surveyId}`);
    console.log(`成熟度: ${result.overall.maturityLevel.toFixed(2)} (${result.overall.grade})`);
    console.log(`冲突: ${result.conflicts.conflictCount} 个`);

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

test();
