type ControlPointLike = {
  controlCode: string
  controlName: string
  controlDesc?: string | null
  controlFamily: string
  aliases?: string[] | null
  keywords?: string[] | null
  canonicalTheme?: string | null
}

export type SemanticControlProfile = {
  canonicalTheme: string | null
  aliases: string[]
  keywords: string[]
  tokens: string[]
  haystack: string
}

export type ControlThemeMatch = {
  score: number
  reason: string
  profile: SemanticControlProfile
}

const CLAUSE_SPLIT_PATTERN = /[；;。！？!\n]/g
const SUBCLAUSE_SPLIT_PATTERN = /[，,、]/g
const NEGATIVE_HINT_PATTERN =
  /(未及时|未按规定|未按|未能|未履行|未建立|未设置|未配备|未保存|未报告|未披露|未核查|未复核|未监测|未上报|未办理|未关注|未核实|未执行|未落实|未|不足|不到位|缺失|不健全|不完善|不准确|不完整|不规范|不合规|不充分|缺乏|存在缺陷|存在重大缺陷|存在较大缺陷)/
const POSITIVE_RISK_PATTERN =
  /(承诺收益|传播虚假或误导性信息|泄露[^；;。！？!\n，,、]{2,20}|误导性信息|虚假信息|虚假记载|误导性陈述)/
const IRRELEVANT_CLAUSE_PATTERNS = [
  /^你公司在[^，,；;。]{0,20}过程中$/,
  /^根据《.+》/,
  /^违反《.+》/,
  /^不符合《.+》/,
  /^我局/,
  /^可以在收到本决定书之日起/,
  /^复议与诉讼期间/,
  /^中国证券监督管理委员会/,
  /^中国人民银行/,
  /^国家金融监督管理总局/,
]
const WEAK_THEME_PATTERNS = [
  /^你公司/,
  /^你分公司/,
  /^我局/,
  /^根据《/,
  /^违反《/,
  /^不符合《/,
  /^截至/,
  /^其岗位职责/,
  /^综合$/,
  /^财务$/,
  /^证券$/,
  /^相关规定$/,
]
const THEME_PREFIX_PATTERN =
  /^(一是|二是|三是|四是|五是|六是|七是|八是|九是|十是|其中|同时|并且|且|以及|个别|部分|相关|其|你公司|你分公司|公司|机构)/
const NOISE_PHRASES = [
  '相关',
  '运行情况',
  '业务条线',
  '情况反映出',
  '上述情况反映出',
  '等规定',
  '有关规定',
  '专项检查',
]
const STOPWORDS = new Set([
  '相关',
  '公司',
  '机构',
  '人员',
  '管理',
  '控制',
  '情况',
  '业务',
  '规定',
  '要求',
  '进行',
  '落实',
  '建立',
  '开展',
  '其中',
  '部分',
  '个别',
  '你公司',
  '你分公司',
  '我局',
])

const CANONICAL_THEME_RULES: Array<{ pattern: RegExp; theme: string }> = [
  { pattern: /(尽职调查|尽调|内核|质控验收|立项意见|第三方意见核查|对外担保核查|核查有效性)/, theme: '尽职调查控制' },
  { pattern: /(信息披露|披露准确|披露督促|监管报送|报送数据|报送口径)/, theme: '信息披露管理' },
  { pattern: /(反洗钱|可疑交易|客户身份识别|洗钱)/, theme: '反洗钱管理' },
  { pattern: /(风险管理|风控|风险容忍度|风险指标|动态监测|风险控制指标)/, theme: '风险管理控制' },
  { pattern: /(投资者|承诺收益|投资建议|误导性信息|销售业务|基金销售)/, theme: '销售行为管理' },
  { pattern: /(记录保存|留痕|档案|监控记录|保存微信监控记录|资料保存)/, theme: '记录留痕管理' },
  { pattern: /(内部控制|内控|独立性)/, theme: '内部控制管理' },
  { pattern: /(经营场所|业务场所)/, theme: '营业场所管理' },
  { pattern: /(从业人员|岗位职责|专职风险管理人员|委员职责)/, theme: '人员与职责管理' },
  { pattern: /(资产管理|资管业务|投资决策委员会|信用交易|经纪业务)/, theme: '业务运营控制' },
  { pattern: /(数据|数据采集|数据报送|固定资产变动|股权质押)/, theme: '数据管理' },
  { pattern: /(外包|第三方|接收方)/, theme: '外包与第三方管理' },
  { pattern: /(审计|日志|复核|核查记录)/, theme: '审计留痕管理' },
  { pattern: /(应急|事件|事故|响应)/, theme: '事件响应管理' },
]

const CONTROL_FAMILY_HINTS: Array<{
  familyPattern: RegExp
  canonicalTheme: string
  aliases: string[]
  keywords: string[]
}> = [
  { familyPattern: /^REG_REPORTING$/, canonicalTheme: '信息披露管理', aliases: ['监管报送管理', '信息披露管理'], keywords: ['监管报送', '信息披露', '报送准确', '报送及时'] },
  { familyPattern: /^SEC_(TRADING|SETTLEMENT|MARKET_DATA|MONITOR)$/, canonicalTheme: '证券交易管理', aliases: ['证券交易管理', '证券业务管理'], keywords: ['证券交易', '结算', '市场数据', '交易监测'] },
  { familyPattern: /^ONLINE_TRADING_/, canonicalTheme: '线上交易管理', aliases: ['线上交易管理'], keywords: ['线上交易', '交易风控', '交易监测'] },
  { familyPattern: /^FUND_SALES$/, canonicalTheme: '销售行为管理', aliases: ['基金销售管理', '销售行为管理'], keywords: ['基金销售', '销售行为', '投资者适当性'] },
  { familyPattern: /^FUND_(CUSTODY|NAV)$/, canonicalTheme: '基金运营管理', aliases: ['基金运营管理'], keywords: ['基金托管', '估值', '净值'] },
  { familyPattern: /^OUTSOURCING_/, canonicalTheme: '外包与第三方管理', aliases: ['外包管理', '第三方管理'], keywords: ['外包', '第三方', '尽职调查', '持续监测'] },
  { familyPattern: /^GOV_RISK$/, canonicalTheme: '风险管理控制', aliases: ['风险管理控制', '风控管理'], keywords: ['风险管理', '风控', '风险指标'] },
  { familyPattern: /^(GOV_AUDIT|LOG_AUDIT|PI_AUDIT|OPS_RECORD)$/, canonicalTheme: '审计留痕管理', aliases: ['审计留痕管理', '审计管理'], keywords: ['审计', '日志', '留痕', '记录保存'] },
  { familyPattern: /^PI_/, canonicalTheme: '个人信息保护', aliases: ['个人信息保护'], keywords: ['个人信息', '敏感个人信息', '最小必要', '共享'] },
  { familyPattern: /^(DATA_|IMPORTANT_DATA_)/, canonicalTheme: '数据管理', aliases: ['数据管理'], keywords: ['数据治理', '数据分类', '数据出境', '重要数据'] },
  { familyPattern: /^(OPS_MONITOR|CIIO_MONITOR)$/, canonicalTheme: '监测管理', aliases: ['监测管理'], keywords: ['监测', '动态监测', '运行监测'] },
  { familyPattern: /^CHANGE_/, canonicalTheme: '变更管理', aliases: ['变更管理'], keywords: ['变更', '审批', '回滚'] },
  { familyPattern: /^(BCP_|CRITICAL_SYSTEM_(DR|HA))$/, canonicalTheme: '业务连续性管理', aliases: ['业务连续性管理', '灾备管理'], keywords: ['连续性', '灾备', 'RTO', 'RPO', '高可用'] },
  { familyPattern: /^(NET_BOUNDARY|CLOUD_SECURITY|PUBLIC_APP_SECURITY)$/, canonicalTheme: '安全防护管理', aliases: ['安全防护管理'], keywords: ['安全防护', '边界安全', '应用安全'] },
  { familyPattern: /^INCIDENT_/, canonicalTheme: '事件响应管理', aliases: ['事件响应管理'], keywords: ['事件响应', '事故处置', '事后复盘'] },
  { familyPattern: /^(GOV_ORG|GOVERNANCE_COMMITTEE)$/, canonicalTheme: '治理与职责管理', aliases: ['治理与职责管理'], keywords: ['治理', '委员会', '岗位职责', '组织架构'] },
  { familyPattern: /^AI_HUMAN_REVIEW$/, canonicalTheme: '人工复核管理', aliases: ['人工复核管理'], keywords: ['人工复核', '人工审核'] },
]

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, '').trim()
}

function cleanClausePrefix(value: string): string {
  return normalizeWhitespace(value)
    .replace(/^[（(]?[一二三四五六七八九十0-9]+[)）.、]/, '')
    .replace(THEME_PREFIX_PATTERN, '')
    .replace(/^在/, '')
    .trim()
}

function splitIntoClauses(text: string): string[] {
  return text
    .split(CLAUSE_SPLIT_PATTERN)
    .flatMap((sentence) => sentence.split(SUBCLAUSE_SPLIT_PATTERN))
    .map((clause) => cleanClausePrefix(clause))
    .filter((clause) => clause.length >= 4)
}

function isIrrelevantClause(clause: string): boolean {
  return IRRELEVANT_CLAUSE_PATTERNS.some((pattern) => pattern.test(clause))
}

function stripNoise(value: string): string {
  let next = value

  for (const noise of NOISE_PHRASES) {
    next = next.replaceAll(noise, '')
  }

  return next
}

function cleanViolationTheme(theme: string): string {
  return stripNoise(
    normalizeWhitespace(theme)
      .replace(THEME_PREFIX_PATTERN, '')
      .replace(/^(对)?发行人/, '发行人')
      .replace(/^对/, '')
      .replace(/不符合《.+》相关规定/g, '')
      .replace(/根据《.+》/g, '')
      .replace(/违反《.+》/g, '')
      .replace(/[,，；;。]+$/g, ''),
  ).trim()
}

function dedupeOrdered(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.length > 0)))
}

function extractKeywordFallback(text: string): string[] {
  const tokens = tokenizeText(text)
  return dedupeOrdered(tokens.filter((token) => !STOPWORDS.has(token))).slice(0, 5)
}

export function isWeakTheme(theme: string): boolean {
  return WEAK_THEME_PATTERNS.some((pattern) => pattern.test(theme))
}

export function extractViolationThemesFromText(text: string): string[] {
  const clauses = splitIntoClauses(text)
  const extracted = clauses
    .filter((clause) => !isIrrelevantClause(clause))
    .filter((clause) => NEGATIVE_HINT_PATTERN.test(clause) || POSITIVE_RISK_PATTERN.test(clause))
    .map((clause) => cleanViolationTheme(clause))
    .filter((theme) => theme.length >= 4 && !isWeakTheme(theme))

  if (extracted.length > 0) {
    return dedupeOrdered(extracted).slice(0, 5)
  }

  const fallbackKeywords = extractKeywordFallback(text)
  return fallbackKeywords.length > 0 ? fallbackKeywords : ['待人工确认']
}

function sanitizeForCanonical(theme: string): string {
  return normalizeWhitespace(theme)
    .replace(/(未及时|未按规定|未按|未能|未履行|未建立|未设置|未配备|未保存|未报告|未披露|未核查|未复核|未监测|未上报|未办理|未关注|未核实|未执行|未落实|未)/g, '')
    .replace(/(不足|不到位|缺失|不健全|不完善|不准确|不完整|不规范|不合规|不充分|缺乏|存在重大缺陷|存在较大缺陷|存在缺陷)/g, '')
    .replace(/(准确性|有效性|相关)/g, '')
    .trim()
}

function fallbackCanonicalTheme(theme: string): string {
  const cleaned = sanitizeForCanonical(theme)

  if (cleaned.length === 0) {
    return '待人工确认'
  }

  if (/(核查|尽调|调查|内核|质控)/.test(cleaned)) {
    return '尽职调查控制'
  }

  if (/(披露|报送)/.test(cleaned)) {
    return '信息披露管理'
  }

  if (/(反洗钱|可疑交易|身份识别)/.test(cleaned)) {
    return '反洗钱管理'
  }

  if (/(风险|风控)/.test(cleaned)) {
    return '风险管理控制'
  }

  if (/(销售|投资者|投资建议|收益)/.test(cleaned)) {
    return '销售行为管理'
  }

  if (/(记录|留痕|档案)/.test(cleaned)) {
    return '记录留痕管理'
  }

  if (/(内控|内部控制|独立性)/.test(cleaned)) {
    return '内部控制管理'
  }

  return cleaned
}

export function normalizeViolationThemes(themes: string[]): string[] {
  const normalized = themes
    .map((theme) => cleanViolationTheme(theme))
    .filter((theme) => theme.length >= 2)
    .map((theme) => {
      const matchedRule = CANONICAL_THEME_RULES.find((rule) => rule.pattern.test(theme))
      return matchedRule?.theme ?? fallbackCanonicalTheme(theme)
    })
    .filter((theme) => theme.length >= 2)

  return dedupeOrdered(normalized).slice(0, 5)
}

export function tokenizeText(text: string): string[] {
  return dedupeOrdered(
    (normalizeWhitespace(text).match(/[\u4e00-\u9fa5A-Za-z0-9]{2,12}/g) ?? [])
      .flatMap((token) => {
        const expanded: Array<string | null> = [token, token.length >= 4 ? token.slice(0, 4) : null]

        if (/^[\u4e00-\u9fa5]+$/.test(token) && token.length >= 4) {
          for (let size = 2; size <= Math.min(4, token.length); size += 1) {
            for (let index = 0; index <= token.length - size; index += 1) {
              expanded.push(token.slice(index, index + size))
            }
          }
        }

        return expanded
      })
      .filter((token): token is string => Boolean(token) && !STOPWORDS.has(token)),
  )
}

function extractPhrasesFromDescription(text?: string | null): string[] {
  if (!text) {
    return []
  }

  return splitIntoClauses(text)
    .map((clause) => sanitizeForCanonical(clause))
    .filter((clause) => clause.length >= 2 && !isWeakTheme(clause))
    .slice(0, 6)
}

function resolveControlFamilyHint(controlFamily: string) {
  return CONTROL_FAMILY_HINTS.find((hint) => hint.familyPattern.test(controlFamily)) ?? null
}

export function buildSemanticControlProfile(controlPoint: ControlPointLike): SemanticControlProfile {
  const familyHint = resolveControlFamilyHint(controlPoint.controlFamily)
  const derivedAliases = extractPhrasesFromDescription(controlPoint.controlDesc)
  const canonicalTheme =
    controlPoint.canonicalTheme ?? familyHint?.canonicalTheme ?? derivedAliases[0] ?? null
  const aliases = dedupeOrdered([
    ...(controlPoint.aliases ?? []),
    ...(familyHint?.aliases ?? []),
    ...derivedAliases,
  ])
  const keywords = dedupeOrdered([
    ...(controlPoint.keywords ?? []),
    ...(familyHint?.keywords ?? []),
    ...tokenizeText(`${controlPoint.controlName} ${controlPoint.controlDesc ?? ''}`),
  ])
  const tokens = dedupeOrdered([
    ...(canonicalTheme ? tokenizeText(canonicalTheme) : []),
    ...aliases.flatMap((alias) => tokenizeText(alias)),
    ...keywords,
  ])
  const haystack = normalizeWhitespace(
    [
      controlPoint.controlCode,
      controlPoint.controlName,
      controlPoint.controlDesc ?? '',
      canonicalTheme ?? '',
      ...aliases,
      ...keywords,
    ].join(' '),
  )

  return {
    canonicalTheme,
    aliases,
    keywords,
    tokens,
    haystack,
  }
}

export function scoreThemeAgainstControl(
  normalizedTheme: string,
  controlPoint: ControlPointLike,
): ControlThemeMatch {
  const profile = buildSemanticControlProfile(controlPoint)
  const theme = normalizeWhitespace(normalizedTheme)

  if (profile.canonicalTheme && theme === profile.canonicalTheme) {
    return { score: 0.95, reason: 'matched canonicalTheme exactly', profile }
  }

  if (profile.canonicalTheme && (profile.canonicalTheme.includes(theme) || theme.includes(profile.canonicalTheme))) {
    return { score: 0.88, reason: 'matched canonicalTheme loosely', profile }
  }

  const aliasMatch = profile.aliases.find((alias) => alias === theme || alias.includes(theme) || theme.includes(alias))
  if (aliasMatch) {
    return { score: 0.85, reason: `matched alias ${aliasMatch}`, profile }
  }

  const themeTokens = tokenizeText(theme)
  const matchedTokens = themeTokens.filter((token) => profile.tokens.includes(token))

  if (matchedTokens.length > 0) {
    const ratio = matchedTokens.length / Math.max(1, themeTokens.length)
    const score = Number(
      Math.min(0.8, 0.32 + ratio * 0.28 + matchedTokens.length * 0.04).toFixed(2),
    )
    return {
      score,
      reason: `matched semantic tokens: ${matchedTokens.join(', ')}`,
      profile,
    }
  }

  if (profile.haystack.includes(theme)) {
    return { score: 0.58, reason: 'matched control haystack text', profile }
  }

  return { score: 0, reason: 'no semantic match', profile }
}
