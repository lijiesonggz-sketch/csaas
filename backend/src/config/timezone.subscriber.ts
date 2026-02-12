import { DataSource } from 'typeorm'
import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'

@Injectable()
export class TimezoneSubscriber implements OnModuleInit {
  private readonly logger = new Logger(TimezoneSubscriber.name)

  constructor(@InjectDataSource() private dataSource: DataSource) {}

  onModuleInit() {
    // 订阅连接事件
    this.dataSource.driver.afterConnect = async () => {
      // 设置时区为中国时区
      await this.dataSource.query("SET timezone = 'Asia/Shanghai'")
      this.logger.log('数据库时区已设置为 Asia/Shanghai')
    }

    // 如果已经连接，立即设置
    if (this.dataSource.isInitialized) {
      this.dataSource.query("SET timezone = 'Asia/Shanghai'").then(() => {
        this.logger.log('数据库时区已设置为 Asia/Shanghai')
      })
    }
  }
}
