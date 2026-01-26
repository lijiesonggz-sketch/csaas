/**
 * 检查NestJS实际加载的配置
 */
require('dotenv').config({ path: '.env.development' });

console.log('通过dotenv直接加载的配置:');
console.log('='.repeat(70));
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY?.substring(0, 20) + '...');
console.log('ANTHROPIC_BASE_URL:', process.env.ANTHROPIC_BASE_URL);
console.log('ANTHROPIC_MODEL:', process.env.ANTHROPIC_MODEL);
console.log('');
console.log('TONGYI_API_KEY:', process.env.TONGYI_API_KEY?.substring(0, 20) + '...');
console.log('TONGYI_BASE_URL:', process.env.TONGYI_BASE_URL);
console.log('TONGYI_MODEL:', process.env.TONGYI_MODEL);
