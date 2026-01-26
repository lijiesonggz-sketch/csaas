import { config } from 'dotenv';
import { TongyiClient } from './dist/modules/ai-clients/providers/tongyi.client.js';

// 加载环境变量
config({ path: '.env.development' });

// 创建ConfigService的简单实现
class SimpleConfigService {
  get(key) {
    return process.env[key];
  }
}

const configService = new SimpleConfigService();
const tongyiClient = new TongyiClient(configService);

console.log('=== 检查通义千问配置 ===');
console.log('TONGYI_API_KEY:', process.env.TONGYI_API_KEY ? process.env.TONGYI_API_KEY.substring(0, 15) + '...' : 'MISSING');
console.log('TONGYI_BASE_URL:', process.env.TONGYI_BASE_URL);
console.log('TONGYI_MODEL:', process.env.TONGYI_MODEL);
console.log('');
console.log('=== TongyiClient状态 ===');
console.log('isAvailable():', tongyiClient.isAvailable());
console.log('getModelName():', tongyiClient.getModelName());
