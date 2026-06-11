import {
  extractAlignableUnits,
  alignUnits,
  computeFingerprint,
  normalizeForFingerprint,
  SIM_RENUMBERED_THRESHOLD,
  SIM_CANDIDATE_THRESHOLD,
} from './clause-alignment.util'

/** GB式结构化文档（叶子要求，≥5条满足结构化判定阈值） */
const GB_OLD = [
  '4 数据安全要求',
  '4.1 数据分类分级',
  'a) 应建立数据分类分级制度，明确分类分级标准和方法；',
  'b) 应识别重要数据并形成重要数据目录，定期更新；',
  'c) 应对核心数据实施重点保护，限制访问范围；',
  '4.2 数据备份',
  'a) 应建立数据备份机制，定期开展备份演练验证有效性；',
  'b) 应将备份数据异地存放，确保灾难场景可恢复；',
  '4.3 日志审计',
  'a) 应记录数据访问日志并保存不少于六个月；',
].join('\n')

const GB_NEW_MODIFIED = [
  '4 数据安全要求',
  '4.1 数据分类分级',
  'a) 应建立数据分类分级制度，明确分类分级标准和方法；',
  'b) 应识别重要数据和核心数据并形成目录，每年至少更新一次；',
  'c) 应对核心数据实施重点保护，限制访问范围；',
  '4.2 数据备份',
  'a) 应建立数据备份机制，定期开展备份演练验证有效性；',
  'b) 应将备份数据异地存放，确保灾难场景可恢复；',
  '4.3 日志审计',
  'a) 应记录数据访问日志并保存不少于六个月；',
].join('\n')

describe('clause-alignment.util', () => {
  describe('normalizeForFingerprint / computeFingerprint', () => {
    it('should ignore whitespace and punctuation differences', () => {
      const a = '应建立数据分类分级制度，明确标准。'
      const b = '应建立数据分类分级制度 明确标准'
      expect(normalizeForFingerprint(a)).toBe(normalizeForFingerprint(b))
      expect(computeFingerprint(a)).toBe(computeFingerprint(b))
    })

    it('should produce different fingerprints for different content', () => {
      expect(computeFingerprint('应建立备份机制')).not.toBe(computeFingerprint('应建立审计机制'))
    })
  })

  describe('extractAlignableUnits', () => {
    it('should extract structured leaf units from GB-style document', () => {
      const result = extractAlignableUnits(GB_OLD)
      expect(result.mode).toBe('clause')
      expect(result.units.length).toBeGreaterThanOrEqual(3)
      const ids = result.units.map((u) => u.id)
      expect(ids).toContain('4.1-a')
      expect(ids).toContain('4.1-b')
      expect(ids).toContain('4.2-a')
    })

    it('should extract chinese article units from legal document', () => {
      const legal = [
        '第一条 为了保障数据安全，制定本办法。',
        '第二条 在中华人民共和国境内开展数据处理活动，适用本办法。',
        '第三条 国家建立数据分类分级保护制度。',
        '第四条 重要数据处理者应当明确数据安全负责人。',
        '第五条 数据处理者应当定期开展风险评估。',
      ].join('\n')
      const result = extractAlignableUnits(legal)
      expect(result.mode).toBe('clause')
      expect(result.units.length).toBe(5)
    })

    it('should fall back to paragraph mode for unstructured document', () => {
      const unstructured = [
        '本指南旨在帮助企业理解数据安全管理的总体思路和落地路径，内容覆盖组织建设与制度设计两大方面。',
        '企业应当首先评估自身数据资产状况，识别关键业务流程中的数据流转环节并形成完整的资产清单文档。',
        '在此基础上建立适合自身规模的管理体系，并通过定期审计与培训持续改进整体安全能力和水平。',
      ].join('\n\n')
      const result = extractAlignableUnits(unstructured)
      expect(result.mode).toBe('paragraph')
      expect(result.units.length).toBe(3)
      expect(result.units[0].id).toBe('P1')
    })

    it('should handle empty document', () => {
      const result = extractAlignableUnits('')
      expect(result.units).toEqual([])
    })
  })

  describe('alignUnits', () => {
    it('should classify unchanged / modified by id and fingerprint', () => {
      const oldUnits = extractAlignableUnits(GB_OLD).units
      const newUnits = extractAlignableUnits(GB_NEW_MODIFIED).units
      const result = alignUnits(oldUnits, newUnits)

      const unchangedIds = result.unchanged.map((u) => u.id)
      expect(unchangedIds).toContain('4.1-a')
      expect(unchangedIds).toContain('4.2-a')

      const modifiedIds = result.modified.map((m) => m.id)
      expect(modifiedIds).toContain('4.1-b')
      expect(result.added).toEqual([])
      expect(result.deleted).toEqual([])
    })

    it('should treat punctuation-only differences as unchanged', () => {
      const oldUnits = [
        {
          id: '1',
          text: '应建立数据备份机制，定期演练。',
          fingerprint: computeFingerprint('应建立数据备份机制，定期演练。'),
        },
      ]
      const newUnits = [
        {
          id: '1',
          text: '应建立数据备份机制 定期演练',
          fingerprint: computeFingerprint('应建立数据备份机制 定期演练'),
        },
      ]
      const result = alignUnits(oldUnits, newUnits)
      expect(result.unchanged.length).toBe(1)
      expect(result.modified.length).toBe(0)
    })

    it('should detect renumbered clause with identical body (4.1 -> 4.1.1)', () => {
      const body = '应建立数据分类分级制度并形成重要数据目录，定期组织评审更新机制'
      const oldUnits = [{ id: '4.1', text: `4.1 ${body}`, fingerprint: computeFingerprint(body) }]
      const newUnits = [
        { id: '4.1.1', text: `4.1.1 ${body}`, fingerprint: computeFingerprint(body) },
      ]
      const result = alignUnits(oldUnits, newUnits)
      expect(result.renumbered.length).toBe(1)
      expect(result.renumbered[0].oldId).toBe('4.1')
      expect(result.renumbered[0].newId).toBe('4.1.1')
      expect(result.renumbered[0].textChanged).toBe(false)
      expect(result.added).toEqual([])
      expect(result.deleted).toEqual([])
    })

    it('should detect renumbered + modified clause', () => {
      const oldBody = '网络运营者应当建立数据分类分级制度，对重要数据进行备份和加密处理'
      const newBody = '网络运营者应建立数据分类分级制度，对重要数据和核心数据实施备份加密'
      const oldUnits = [
        { id: '12', text: `第十二条 ${oldBody}`, fingerprint: computeFingerprint(oldBody) },
      ]
      const newUnits = [
        { id: '15', text: `第十五条 ${newBody}`, fingerprint: computeFingerprint(newBody) },
      ]
      const result = alignUnits(oldUnits, newUnits)
      expect(result.renumbered.length).toBe(1)
      expect(result.renumbered[0].textChanged).toBe(true)
      expect(result.renumbered[0].similarity).toBeGreaterThanOrEqual(SIM_CANDIDATE_THRESHOLD)
    })

    it('should NOT match truly unrelated clauses as renumbered', () => {
      const oldUnits = [
        {
          id: '3',
          text: '第三条 员工入职应当签署保密协议并接受岗位培训',
          fingerprint: computeFingerprint('员工入职应当签署保密协议并接受岗位培训'),
        },
      ]
      const newUnits = [
        {
          id: '8',
          text: '第八条 跨境传输个人信息应当通过安全评估',
          fingerprint: computeFingerprint('跨境传输个人信息应当通过安全评估'),
        },
      ]
      const result = alignUnits(oldUnits, newUnits)
      expect(result.renumbered).toEqual([])
      expect(result.deleted.length).toBe(1)
      expect(result.added.length).toBe(1)
    })

    it('should match each unit at most once (greedy global best)', () => {
      const body = '应建立数据备份机制并定期开展恢复演练验证备份有效性'
      const oldUnits = [
        { id: '5.1', text: `5.1 ${body}`, fingerprint: computeFingerprint(body) },
        {
          id: '5.2',
          text: `5.2 ${body}（每季度）`,
          fingerprint: computeFingerprint(`${body}（每季度）`),
        },
      ]
      const newUnits = [{ id: '6.1', text: `6.1 ${body}`, fingerprint: computeFingerprint(body) }]
      const result = alignUnits(oldUnits, newUnits)
      expect(result.renumbered.length).toBe(1)
      expect(result.deleted.length).toBe(1)
    })

    it('should handle empty inputs', () => {
      const result = alignUnits([], [])
      expect(result.unchanged).toEqual([])
      expect(result.modified).toEqual([])
      expect(result.added).toEqual([])
      expect(result.deleted).toEqual([])
    })

    it('should expose threshold constants', () => {
      expect(SIM_RENUMBERED_THRESHOLD).toBe(0.85)
      expect(SIM_CANDIDATE_THRESHOLD).toBe(0.55)
    })
  })
})
