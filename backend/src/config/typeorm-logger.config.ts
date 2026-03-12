import { Logger as TypeORMLogger, QueryRunner } from 'typeorm'
import { Logger as NestJSLogger } from '@nestjs/common'

/**
 * 自定义 TypeORM 日志器
 * 将 UTC 时间格式化为北京时间 (UTC+8) 显示
 */
export class CustomTypeORMLogger implements TypeORMLogger {
  private readonly logger = new NestJSLogger('TypeORM')

  /**
   * 将 UTC 时间格式化为北京时间
   */
  private formatToBeijingTime(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  }

  /**
   * 检查值是否为日期字符串（ISO 8601 格式）
   */
  private isISODateString(value: any): boolean {
    if (typeof value !== 'string') return false
    // 匹配 ISO 8601 格式，如 "2026-02-12T09:50:00.149Z"
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(value)
  }

  /**
   * 格式化查询参数，将 UTC 时间转换为北京时间
   */
  private formatParameters(parameters?: any[]): string {
    if (!parameters || parameters.length === 0) return ''

    const formatted = parameters.map((param) => {
      if (param instanceof Date) {
        return this.formatToBeijingTime(param)
      }
      if (this.isISODateString(param)) {
        return this.formatToBeijingTime(param)
      }
      if (typeof param === 'object') {
        return JSON.stringify(param)
      }
      return String(param)
    })

    return ` -- PARAMETERS: [${formatted.map((p) => `"${p}"`).join(', ')}]`
  }

  logQuery(query: string, parameters?: any[], queryRunner?: QueryRunner) {
    if (this.isQueryLogDisabled(queryRunner)) return

    const formattedParams = this.formatParameters(parameters)
    this.logger.log(`query: ${query}${formattedParams}`)
  }

  logQueryError(
    error: string | Error,
    query: string,
    parameters?: any[],
    queryRunner?: QueryRunner,
  ) {
    const formattedParams = this.formatParameters(parameters)
    const errorMessage = error instanceof Error ? error.message : error
    this.logger.error(`query failed: ${errorMessage}`)
    this.logger.error(`query: ${query}${formattedParams}`)
  }

  logQuerySlow(
    time: number,
    query: string,
    parameters?: any[],
    queryRunner?: QueryRunner,
  ) {
    const formattedParams = this.formatParameters(parameters)
    this.logger.warn(`query is slow: ${time} ms`)
    this.logger.warn(`query: ${query}${formattedParams}`)
  }

  logSchemaBuild(message: string, queryRunner?: QueryRunner) {
    this.logger.log(message)
  }

  logMigration(message: string, queryRunner?: QueryRunner) {
    this.logger.log(message)
  }

  log(level: 'log' | 'info' | 'warn', message: any, queryRunner?: QueryRunner) {
    switch (level) {
      case 'log':
      case 'info':
        this.logger.log(message)
        break
      case 'warn':
        this.logger.warn(message)
        break
    }
  }

  /**
   * 检查是否禁用了查询日志
   */
  private isQueryLogDisabled(queryRunner?: QueryRunner): boolean {
    // 可以通过 queryRunner 的 data 属性来控制特定查询的日志
    return false
  }
}
