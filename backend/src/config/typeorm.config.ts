import { DataSource } from 'typeorm'
import { config } from 'dotenv'
import { CustomTypeORMLogger } from './typeorm-logger.config'
import { APP_ENTITIES } from './typeorm.entities'

// Load environment variables
config({ path: '.env.development' })

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'csaas',
  entities: [...APP_ENTITIES],
  migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
  synchronize: false, // Migrations will handle schema changes
  logging: true,
  logger: new CustomTypeORMLogger(), // 使用自定义日志器，将 UTC 时间显示为北京时间
  invalidWhereValuesBehavior: {
    null: 'throw',
    undefined: 'throw',
  },
  extra: {
    // 解决Windows PostgreSQL连接ECONNRESET问题
    max: 10, // 最大连接数
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    // 设置时区为中国时区
    options: '--timezone=Asia/Shanghai',
  },
})
