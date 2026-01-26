// 测试通义千问的maxTokens限制问题
require('dotenv').config({ path: '.env.development' });

const TONGYI_MODEL = process.env.TONGYI_MODEL || 'qwen-plus';
const clusteringMaxTokens = 60000; // ClusteringGenerator使用的默认值

console.log('=== 通义千问maxTokens配置分析 ===\n');
console.log('环境变量配置:');
console.log(`  TONGYI_MODEL: ${TONGYI_MODEL}`);
console.log(`  请求的maxTokens: ${clusteringMaxTokens}\n`);

console.log('TongyiClient中的模型限制:');
console.log('  qwen-long: 32768 tokens');
console.log('  qwen-max: 8192 tokens');
console.log('  其他模型（包括qwen3-max）: 6144 tokens（默认）\n');

// 模拟tongyi.client.ts的逻辑
const modelMaxTokens = TONGYI_MODEL === 'qwen-long' ? 32768 :
                      TONGYI_MODEL === 'qwen-max' ? 8192 : 6144;
const actualMaxTokens = Math.min(clusteringMaxTokens, modelMaxTokens);

console.log(`实际maxTokens将被设置为: ${actualMaxTokens}\n`);

if (TONGYI_MODEL === 'qwen3-max') {
  console.log('⚠️ 检测到问题！');
  console.log('  1. TONGYI_MODEL配置为qwen3-max');
  console.log('  2. 但TongyiClient代码中没有qwen3-max的分支');
  console.log('  3. 因此使用了默认的6144 tokens限制');
  console.log('  4. 这可能导致输出被截断或请求失败\n');
  console.log('💡 建议：将TONGYI_MODEL改为qwen-long以获得更大的输出容量');
} else {
  console.log('✅ 模型配置正常');
}
