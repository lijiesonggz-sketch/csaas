import {
  FileSearch,
  Shield,
  BarChart3,
  Target,
  Users,
  BookOpen,
  ShieldCheck,
  Lock,
  Building2,
  Globe,
  Zap,
  TrendingUp,
  CheckCircle2,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react'

export interface Feature {
  icon: LucideIcon
  title: string
  description: string
  metric: string
}

export interface TrustMetric {
  value: string
  label: string
  icon: LucideIcon
}

export interface Solution {
  title: string
  description: string
  frameworks: string[]
  icon: LucideIcon
}

export interface Certification {
  name: string
  description: string
  icon: LucideIcon
}

export const HERO_CONTENT = {
  badge: '企业级合规解决方案',
  title: 'AI驱动的合规咨询平台',
  subtitle: '基于三模型协同架构，为企业提供标准化合规评估、智能差距分析与精准行动方案',
  ctaPrimary: '预约演示',
  ctaSecondary: '联系销售',
}

export const CORE_FEATURES: Feature[] = [
  {
    icon: FileSearch,
    title: '标准解析',
    description: 'AI驱动解读行业标准条款，自动提取关键合规要求与控制点',
    metric: '99.2% 准确率',
  },
  {
    icon: Shield,
    title: '合规评估',
    description: '全面评估组织合规成熟度，覆盖50+国际与国内合规框架',
    metric: '50+ 框架覆盖',
  },
  {
    icon: BarChart3,
    title: '差距分析',
    description: '可视化展示合规差距，自动生成详细差距分析报告',
    metric: '自动生成报告',
  },
  {
    icon: Target,
    title: '行动计划',
    description: '智能生成改进优先级与实施路径，大幅缩短合规建设周期',
    metric: '缩短 60% 时间',
  },
]

export const TRUST_METRICS: TrustMetric[] = [
  { value: '200+', label: '企业客户', icon: Users },
  { value: '50+', label: '合规框架覆盖', icon: BookOpen },
  { value: 'ISO 27001', label: '数据安全认证', icon: ShieldCheck },
]

export const SOLUTIONS: Solution[] = [
  {
    title: '金融行业合规',
    description: '覆盖银保监、人行等监管要求，助力金融机构满足合规标准',
    frameworks: ['银保监', '人行', '网联'],
    icon: Building2,
  },
  {
    title: '电信行业合规',
    description: '全面覆盖工信部、等保等合规要求，保障通信行业数据安全',
    frameworks: ['工信部', '等保', '国标'],
    icon: Globe,
  },
  {
    title: '能源行业合规',
    description: '针对能源局、国家电网等标准，确保关键基础设施合规运营',
    frameworks: ['能源局', '国标', '行业标'],
    icon: Zap,
  },
]

export const CERTIFICATIONS: Certification[] = [
  { name: 'ISO 27001', description: '信息安全管理体系认证', icon: ShieldCheck },
  { name: 'SOC 2 Type II', description: '服务组织控制报告', icon: Lock },
  { name: 'GDPR', description: '通用数据保护条例合规', icon: Shield },
  { name: '等保三级', description: '信息系统安全等级保护', icon: TrendingUp },
]

export const CLIENT_LOGOS = [
  '中国银行', '中国移动', '国家电网',
  '招商银行', '华为技术', '中兴通讯',
]

export const TESTIMONIALS = [
  {
    quote: 'CSAAS平台帮助我们在3个月内完成了全部合规整改，效率提升了200%。',
    author: '张总监',
    company: '某大型银行信息科技部',
  },
  {
    quote: '智能差距分析功能非常强大，直接指出我们的薄弱环节并给出改进建议。',
    author: '李经理',
    company: '某电信企业安全部',
  },
]

export interface Insight {
  title: string
  category: string
  date: string
  readTime: string
}

export const INSIGHTS: Insight[] = [
  { title: '2024年企业合规成熟度指数报告', category: '研究报告', date: '2024.03', readTime: '15 分钟' },
  { title: 'AI驱动的合规管理：从成本中心到战略资产', category: '白皮书', date: '2024.02', readTime: '20 分钟' },
  { title: '金融行业数据安全合规最佳实践', category: '案例分析', date: '2024.01', readTime: '10 分钟' },
]

export interface Capability {
  title: string
  description: string
  icon: LucideIcon
  status: 'active' | 'beta' | 'coming'
}

export const CAPABILITIES: Capability[] = [
  { title: '合规智能评估', description: 'AI驱动的全面合规成熟度评估，覆盖50+国际与国内框架', icon: Shield, status: 'active' },
  { title: '标准智能解析', description: '深度理解标准条款，自动提取关键合规控制点与要求', icon: FileSearch, status: 'active' },
  { title: '差距智能分析', description: '可视化展示合规差距，自动生成详细差距分析报告', icon: BarChart3, status: 'active' },
  { title: '行动智能规划', description: '智能生成改进优先级与实施路径，大幅缩短合规建设周期', icon: Target, status: 'active' },
  { title: '风险智能预警', description: '持续监控合规风险态势，实时预警潜在合规问题', icon: TrendingUp, status: 'beta' },
  { title: '政策智能解读', description: '自动跟踪解读最新监管政策，评估对企业的影响', icon: BookOpen, status: 'beta' },
  { title: '供应链合规', description: '第三方供应商合规风险评估与管理', icon: Globe, status: 'coming' },
  { title: 'ESG合规', description: '环境、社会与治理合规评估与报告', icon: CheckCircle2, status: 'coming' },
]
