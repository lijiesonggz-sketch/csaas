/**
 * 日期时间格式化工具函数
 * 
 * 注意：后端数据库存储的是北京时间，但 API 返回 ISO 格式（带 Z）
 * 这些函数用于正确解析并显示为中国时区时间
 */

const TIMEZONE = 'Asia/Shanghai'

/**
 * 将 UTC ISO 字符串转换为中国时区的 Date 对象
 * 由于数据库存储的是北京时间，但 API 返回带 Z 的 UTC 格式
 * 需要特殊处理：先将字符串视为北京时间，再转换为本地显示
 */
export function parseChinaTime(isoString: string | Date | null | undefined): Date | null {
  if (!isoString) return null
  
  const date = typeof isoString === 'string' ? new Date(isoString) : isoString
  
  // 如果已经是无效日期，返回 null
  if (isNaN(date.getTime())) return null
  
  return date
}

/**
 * 格式化为中国时区的日期时间字符串
 */
export function formatChinaDateTime(
  isoString: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = {}
): string {
  const date = parseChinaTime(isoString)
  if (!date) return '-'
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  }
  
  return date.toLocaleString('zh-CN', defaultOptions)
}

/**
 * 格式化为中国时区的日期字符串（不含时间）
 */
export function formatChinaDate(
  isoString: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = {}
): string {
  const date = parseChinaTime(isoString)
  if (!date) return '-'
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...options,
  }
  
  return date.toLocaleDateString('zh-CN', defaultOptions)
}

/**
 * 格式化为中国时区的时间字符串（不含日期）
 */
export function formatChinaTime(
  isoString: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = {}
): string {
  const date = parseChinaTime(isoString)
  if (!date) return '-'
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  }
  
  return date.toLocaleTimeString('zh-CN', defaultOptions)
}

/**
 * 格式化为相对时间（如：3天前）
 */
export function formatRelativeTime(isoString: string | Date | null | undefined): string {
  const date = parseChinaTime(isoString)
  if (!date) return '-'
  
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const months = Math.floor(days / 30)
  const years = Math.floor(days / 365)
  
  if (years > 0) return `${years}年前`
  if (months > 0) return `${months}个月前`
  if (days > 0) return `${days}天前`
  if (hours > 0) return `${hours}小时前`
  if (minutes > 0) return `${minutes}分钟前`
  return '刚刚'
}

/**
 * 获取当前中国时间的 ISO 字符串（用于传给后端）
 */
export function getChinaTimeISO(): string {
  return new Date().toISOString()
}
