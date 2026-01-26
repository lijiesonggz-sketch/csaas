import { NestFactory } from '@nestjs/core';
import { AppModule } from './dist/src/app.module.js';
import { AIOrchestrator } from './dist/src/modules/ai-clients/ai-orchestrator.service.js';
import { AIModel } from './dist/src/database/entities/ai-generation-event.entity.js';

async function testTongyiCall() {
  console.log('=== 测试AI Orchestrator调用通义千问 ===\n');

  const app = await NestFactory.createApplicationContext(AppModule);
  const aiOrchestrator = app.get(AIOrchestrator);

  console.log('[1] 检查可用Providers:');
  const providers = aiOrchestrator.getAvailableProviders();
  providers.forEach(p => {
    console.log(`  - ${p.name}: ${p.model} (available: ${p.available})`);
  });
  console.log('');

  console.log('[2] 尝试调用通义千问模型（AIModel.DOMESTIC）:');
  try {
    const response = await aiOrchestrator.generate(
      {
        prompt: '请简单介绍一下你自己，用一句话回复。',
        temperature: 0.7,
        maxTokens: 100,
      },
      AIModel.DOMESTIC
    );

    console.log('✅ 成功调用通义千问！');
    console.log(`  Model: ${response.model}`);
    console.log(`  Content: ${response.content.substring(0, 100)}...`);
    console.log(`  Tokens: ${response.tokens.total}`);
    console.log(`  Cost: ¥${response.cost.toFixed(4)}`);
  } catch (error) {
    console.log('❌ 调用失败:', error.message);
  }

  console.log('\n');
  await app.close();
  process.exit(0);
}

testTongyiCall().catch(error => {
  console.error('测试失败:', error);
  process.exit(1);
});
