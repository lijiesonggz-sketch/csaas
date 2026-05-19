import { TypeOrmModuleOptions } from '@nestjs/typeorm'
import { CustomTypeORMLogger } from './typeorm-logger.config'
import { APP_ENTITIES } from './typeorm.entities'

export const databaseConfig = (): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'csaas',
  entities: [...APP_ENTITIES],
  migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
  synchronize: false, // Use migrations for schema changes
  logging: process.env.NODE_ENV === 'development',
  logger: new CustomTypeORMLogger(), // 使用自定义日志器，将 UTC 时间显示为北京时间
  invalidWhereValuesBehavior: {
    null: 'throw',
    undefined: 'throw',
  },
  extra: {
    // 设置时区为中国时区
    options: '--timezone=Asia/Shanghai',
  },
})
