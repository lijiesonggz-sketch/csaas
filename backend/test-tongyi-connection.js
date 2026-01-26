// 测试通义千问配置是否正确
require('dotenv').config({ path: '.env.development' });

const apiKey = process.env.TONGYI_API_KEY;
const baseUrl = process.env.TONGYI_BASE_URL;
const model = process.env.TONGYI_MODEL;

console.log('=== 通义千问配置检查 ===\n');
console.log('TONGYI_API_KEY:', apiKey ? `${apiKey.substring(0, 10)}...` : '❌ 未配置');
console.log('TONGYI_BASE_URL:', baseUrl || '❌ 未配置');
console.log('TONGYI_MODEL:', model || '❌ 未配置');

if (!apiKey || apiKey === 'dummy-key') {
  console.log('\n⚠️ TONGYI_API_KEY未配置或为dummy值');
  console.log('   TongyiClient.isAvailable()将返回false');
  console.log('   这就是为什么通义千问从未被调用的原因！');
} else {
  console.log('\n✅ 配置看起来正常，应该可以调用');
}
