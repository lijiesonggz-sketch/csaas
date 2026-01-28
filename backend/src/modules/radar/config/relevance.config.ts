/**
 * 相关性计算配置
 *
 * Story 2.3: 推送系统与调度 - 相关性算法配置
 *
 * 这些配置参数控制推送系统的相关性计算行为
 */

/**
 * 相关性计算权重配置
 */
export const RELEVANCE_WEIGHTS = {
  /** 薄弱项匹配权重 (默认: 0.6) */
  WEAKNESS: 0.6,
  /** 关注领域匹配权重 (默认: 0.4) */
  TOPIC: 0.4,
} as const

/**
 * 相关性评分阈值配置
 */
export const RELEVANCE_THRESHOLDS = {
  /** 高相关阈值 - 达到此分数将创建推送 (默认: 0.9) */
  HIGH: 0.9,
  /** 中相关阈值 (默认: 0.7) */
  MEDIUM: 0.7,
} as const

/**
 * 优先级计算阈值配置
 */
export const PRIORITY_THRESHOLDS = {
  /** 高优先级阈值 (默认: 0.95) */
  HIGH: 0.95,
  /** 中优先级阈值 (默认: 0.9) */
  MEDIUM: 0.9,
} as const

/**
 * 关注领域匹配权重配置
 */
export const TOPIC_MATCH_WEIGHTS = {
  /** 完全匹配权重 (默认: 1.0) */
  EXACT: 1.0,
  /** 模糊匹配权重 (默认: 0.7) */
  FUZZY: 0.7,
} as const

/**
 * 薄弱项级别权重配置
 */
export const WEAKNESS_LEVEL_CONFIG = {
  /** 最大薄弱项级别 (默认: 5) */
  MAX_LEVEL: 5,
  /** 权重计算除数 (默认: 4)
   * 权重计算公式: (MAX_LEVEL - level) / WEIGHT_DIVISOR
   * level 1 → weight 1.0
   * level 2 → weight 0.75
   * level 3 → weight 0.5
   * level 4 → weight 0.25
   * level 5 → weight 0.0
   */
  WEIGHT_DIVISOR: 4,
} as const

/**
 * 推送频率控制配置
 */
export const PUSH_FREQUENCY_CONFIG = {
  /** 每个组织每次推送的最大数量 (默认: 5) */
  MAX_PUSHES_PER_SCHEDULE: 5,
} as const

/**
 * 时区配置
 */
export const TIMEZONE_CONFIG = {
  /** 中国标准时间偏移（分钟） UTC+8 = 8 * 60 */
  CHINA_OFFSET_MINUTES: 8 * 60,
} as const

/**
 * 推送调度时间配置
 */
export const SCHEDULE_CONFIG = {
  /** 技术雷达推送时间 */
  TECH: {
    /** 星期几 (0=周日, 5=周五) */
    DAY_OF_WEEK: 5,
    /** 小时 (24小时制) */
    HOUR: 17,
  },
  /** 行业雷达推送时间 */
  INDUSTRY: {
    DAY_OF_WEEK: 3, // 周三
    HOUR: 17,
  },
  /** 合规雷达推送时间 */
  COMPLIANCE: {
    DAY_OF_WEEK: null, // null表示每日
    HOUR: 9,
  },
} as const
