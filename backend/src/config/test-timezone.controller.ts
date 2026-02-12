import { Controller, Get } from '@nestjs/common'
import { DataSource } from 'typeorm'

@Controller('test-timezone')
export class TestTimezoneController {
  constructor(private dataSource: DataSource) {}

  @Get()
  async testTimezone() {
    // 查询数据库时区（不手动设置，验证订阅器是否生效）
    const result = await this.dataSource.query(`
      SELECT
        now() as db_time_with_tz,
        now()::timestamp as db_time_without_tz,
        now()::text as db_time_text,
        current_setting('timezone') as timezone
    `)

    // 查询一个实际的表看时间字段
    const projectResult = await this.dataSource.query(`
      SELECT
        created_at,
        created_at::text as created_at_text,
        pg_typeof(created_at) as created_at_type
      FROM projects
      ORDER BY created_at DESC
      LIMIT 1
    `)

    return {
      serverTime: new Date().toISOString(),
      localTime: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
      dbInfo: {
        timezone: result[0].timezone,
        nowWithTz: result[0].db_time_with_tz,
        nowWithoutTz: result[0].db_time_without_tz,
        nowText: result[0].db_time_text,
      },
      projectTimeInfo: projectResult[0] || null,
      serverTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }
  }
}
