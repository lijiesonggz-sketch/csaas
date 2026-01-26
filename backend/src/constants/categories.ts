/**
 * Weakness categories for Radar Service
 * Source: Csaas assessment maturity domains
 *
 * These categories represent different areas of IT maturity that can be
 * identified as weaknesses during assessments (maturity level < 3).
 *
 * @module backend/src/constants/categories
 */

/**
 * Enum representing all weakness categories used in Radar Service
 *
 * Categories are derived from Csaas assessment maturity domains and represent
 * areas where an organization may have low maturity (level < 3).
 */
export enum WeaknessCategory {
  /**
   * Data security - Information protection, encryption, access control
   */
  DATA_SECURITY = 'data_security',

  /**
   * Network security - Infrastructure security, firewall, intrusion detection
   */
  NETWORK_SECURITY = 'network_security',

  /**
   * Cloud native - Containerization, orchestration, microservices
   */
  CLOUD_NATIVE = 'cloud_native',

  /**
   * AI application - Machine learning, AI adoption in financial services
   */
  AI_APPLICATION = 'ai_application',

  /**
   * Mobile financial security - Mobile banking, app security
   */
  MOBILE_FINANCIAL = 'mobile_financial',

  /**
   * DevOps - CI/CD, automation, deployment practices
   */
  DEVOPS = 'devops',

  /**
   * Cost optimization - Resource efficiency, cloud cost management
   */
  COST_OPTIMIZATION = 'cost_optimization',

  /**
   * Compliance - Regulatory compliance, risk management
   */
  COMPLIANCE = 'compliance',
}

/**
 * Display names in Chinese for UI rendering
 *
 * Maps each category enum to its Chinese display name for user-facing UI.
 */
export const WEAKNESS_CATEGORY_DISPLAY: Record<WeaknessCategory, string> = {
  [WeaknessCategory.DATA_SECURITY]: '数据安全',
  [WeaknessCategory.NETWORK_SECURITY]: '网络安全',
  [WeaknessCategory.CLOUD_NATIVE]: '云原生',
  [WeaknessCategory.AI_APPLICATION]: 'AI应用',
  [WeaknessCategory.MOBILE_FINANCIAL]: '移动金融安全',
  [WeaknessCategory.DEVOPS]: 'DevOps',
  [WeaknessCategory.COST_OPTIMIZATION]: '成本优化',
  [WeaknessCategory.COMPLIANCE]: '合规管理',
}

/**
 * Reverse lookup map: Chinese name → WeaknessCategory enum
 *
 * Useful for mapping user-friendly category names back to enum values.
 */
export const DISPLAY_NAME_TO_CATEGORY: Record<string, WeaknessCategory> = {
  '数据安全': WeaknessCategory.DATA_SECURITY,
  '网络安全': WeaknessCategory.NETWORK_SECURITY,
  '云原生': WeaknessCategory.CLOUD_NATIVE,
  'AI应用': WeaknessCategory.AI_APPLICATION,
  '移动金融安全': WeaknessCategory.MOBILE_FINANCIAL,
  'DevOps': WeaknessCategory.DEVOPS,
  '成本优化': WeaknessCategory.COST_OPTIMIZATION,
  '合规管理': WeaknessCategory.COMPLIANCE,
}

/**
 * Category descriptions for tooltips and help text
 *
 * Provides detailed descriptions of what each category encompasses.
 */
export const WEAKNESS_CATEGORY_DESCRIPTIONS: Record<WeaknessCategory, string> = {
  [WeaknessCategory.DATA_SECURITY]:
    '数据加密、访问控制、数据防泄露、安全审计等数据安全领域的成熟度',

  [WeaknessCategory.NETWORK_SECURITY]:
    '网络架构、防火墙、入侵检测、DDoS防护、网络分段等网络安全基础设施',

  [WeaknessCategory.CLOUD_NATIVE]:
    '容器化、微服务架构、容器编排（K8s）、云原生应用开发等云原生技术',

  [WeaknessCategory.AI_APPLICATION]:
    '机器学习模型应用、智能风控、AI客服、自动化决策等AI技术在金融服务中的应用',

  [WeaknessCategory.MOBILE_FINANCIAL]:
    '移动银行应用安全、移动支付安全、APP加固、移动设备管理等移动金融安全',

  [WeaknessCategory.DEVOPS]:
    '持续集成/部署（CI/CD）、自动化测试、基础设施即代码、DevOps文化和流程',

  [WeaknessCategory.COST_OPTIMIZATION]:
    '云资源成本优化、资源利用率提升、 FinOps、成本监控和优化策略',

  [WeaknessCategory.COMPLIANCE]:
    '监管合规、风险评估、合规检查、监管报告等合规管理和风险控制',
}

/**
 * Validates if a given string is a valid WeaknessCategory
 *
 * @param value - String value to validate
 * @returns true if value is a valid WeaknessCategory enum value
 */
export function isValidWeaknessCategory(value: string): value is WeaknessCategory {
  return Object.values(WeaknessCategory).includes(value as WeaknessCategory)
}

/**
 * Gets display name for a WeaknessCategory
 *
 * @param category - WeaknessCategory enum value
 * @returns Chinese display name, or original value if not found
 */
export function getCategoryDisplayName(category: WeaknessCategory): string {
  return WEAKNESS_CATEGORY_DISPLAY[category] || category
}

/**
 * Parses a Chinese display name to WeaknessCategory enum
 *
 * @param displayName - Chinese display name
 * @returns WeaknessCategory enum value, or undefined if not found
 */
export function parseDisplayNameToCategory(displayName: string): WeaknessCategory | undefined {
  return DISPLAY_NAME_TO_CATEGORY[displayName]
}
