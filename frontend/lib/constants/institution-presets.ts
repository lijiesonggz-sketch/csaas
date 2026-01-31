/**
 * Institution Presets
 *
 * Unified preset data source for frontend institution selection.
 * Replaces scattered hardcoded preset data across components.
 */

export const INSTITUTION_PRESETS = {
  banking: [
    { name: '杭州银行', type: '城商行', desc: '城商行标杆' },
    { name: '绍兴银行', type: '城商行', desc: '区域性城商行' },
    { name: '宁波银行', type: '城商行', desc: '优秀城商行代表' },
    { name: '北京银行', type: '城商行', desc: '首都城商行' },
    { name: '招商银行', type: '股份制银行', desc: '股份制银行领先者' },
    { name: '浦发银行', type: '股份制银行', desc: '全国性股份制银行' },
    { name: '兴业银行', type: '股份制银行', desc: '绿色金融先行者' },
    { name: '中信银行', type: '股份制银行', desc: '综合金融服务商' },
    { name: '微众银行', type: '互联网银行', desc: '互联网银行先行者' },
    { name: '网商银行', type: '互联网银行', desc: '阿里系互联网银行' },
    { name: '新网银行', type: '互联网银行', desc: '四川互联网银行' },
    { name: '亿联银行', type: '互联网银行', desc: '东北首家互联网银行' },
    { name: '工商银行', type: '国有大行', desc: '宇宙第一大行' },
    { name: '建设银行', type: '国有大行', desc: '国有大型商业银行' },
    { name: '农业银行', type: '国有大行', desc: '服务三农' },
    { name: '杭州联合农商行', type: '农商行', desc: '区域性农商行' },
    { name: '上海农商行', type: '农商行', desc: '大型农商行' },
  ],
  securities: [
    { name: '中信证券', type: '券商', desc: '头部券商' },
    { name: '华泰证券', type: '券商', desc: '科技券商' },
    { name: '国泰君安', type: '券商', desc: '综合性券商' },
    { name: '海通证券', type: '券商', desc: '老牌券商' },
    { name: '广发证券', type: '券商', desc: '全国性券商' },
    { name: '易方达基金', type: '基金公司', desc: '公募基金龙头' },
    { name: '华夏基金', type: '基金公司', desc: '老牌基金公司' },
    { name: '南方基金', type: '基金公司', desc: '大型基金公司' },
    { name: '中信期货', type: '期货公司', desc: '头部期货公司' },
    { name: '永安期货', type: '期货公司', desc: '期货行业领先者' },
  ],
  insurance: [
    { name: '中国人寿', type: '寿险公司', desc: '寿险行业领导者' },
    { name: '平安人寿', type: '寿险公司', desc: '综合金融集团' },
    { name: '太平洋人寿', type: '寿险公司', desc: '大型寿险公司' },
    { name: '新华人寿', type: '寿险公司', desc: '全国性寿险公司' },
    { name: '人保财险', type: '财险公司', desc: '财险市场第一' },
    { name: '平安财险', type: '财险公司', desc: '综合财险服务商' },
    { name: '太平洋财险', type: '财险公司', desc: '大型财险公司' },
    { name: '中国再保险', type: '再保险公司', desc: '国内再保险龙头' },
  ],
  enterprise: [
    { name: '华为', type: '制造业', desc: '科技制造标杆' },
    { name: '比亚迪', type: '制造业', desc: '新能源汽车领导者' },
    { name: '格力电器', type: '制造业', desc: '家电制造龙头' },
    { name: '阿里巴巴', type: '零售业', desc: '电商平台领导者' },
    { name: '京东', type: '零售业', desc: '综合零售平台' },
    { name: '苏宁易购', type: '零售业', desc: '全渠道零售商' },
    { name: '顺丰速运', type: '物流业', desc: '快递行业领先者' },
    { name: '中国外运', type: '物流业', desc: '综合物流服务商' },
    { name: '中国石油', type: '能源企业', desc: '能源行业巨头' },
    { name: '国家电网', type: '能源企业', desc: '电力行业领导者' },
  ]
} as const

export const INDUSTRY_LABELS = {
  banking: '银行业',
  securities: '证券业',
  insurance: '保险业',
  enterprise: '传统企业'
} as const

export type IndustryKey = keyof typeof INSTITUTION_PRESETS

/**
 * Get presets for a specific industry
 * @param industry - Industry key
 * @returns Array of preset institutions
 */
export function getIndustryPresets(industry: IndustryKey) {
  return INSTITUTION_PRESETS[industry] || []
}

/**
 * Get display label for an industry
 * @param industry - Industry key
 * @returns Display label in Chinese
 */
export function getIndustryLabel(industry: IndustryKey): string {
  return INDUSTRY_LABELS[industry] || industry
}
