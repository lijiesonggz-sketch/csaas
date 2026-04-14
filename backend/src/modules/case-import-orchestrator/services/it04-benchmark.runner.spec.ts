import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
  classifyIt04CaseText,
  It04BenchmarkRunner,
  It04TaxonomySemanticMapping,
} from './it04-benchmark.runner'

describe('It04BenchmarkRunner', () => {
  it('should classify IT04-07 timeliness cases from semantic mapping signals', () => {
    const mappings: It04TaxonomySemanticMapping[] = [
      {
        l1Code: 'IT04',
        l1Name: '数据治理与监管数据报送',
        l2Code: 'IT04-07',
        l2Name: '信息科技非现场监管报表未报/迟报',
        definition: '科技监管类报表、台账、信息报送未按时报送',
        canonicalTheme: '科技监管报表时效管理',
        aliases: ['非现场监管报表', '台账报送', '迟报未报'],
        keywords: ['未按时报送', '迟报', '未报'],
      },
      {
        l1Code: 'IT04',
        l1Name: '数据治理与监管数据报送',
        l2Code: 'IT04-11',
        l2Name: '监管报告/报表/文件/资料虚假或失真',
        definition: '编制或提供虚假报告、报表、文件、资料',
        canonicalTheme: '监管报告真实性控制',
        aliases: ['虚假报告', '虚假报表'],
        keywords: ['虚假记载', '数据造假'],
      },
    ]

    const result = classifyIt04CaseText(
      '信息科技非现场监管报表未按时报送，截止时间前没有提醒和升级机制，出现明显迟报。',
      mappings,
    )

    expect(result.l2Code).toBe('IT04-07')
    expect(result.decisionSource).toBe('rule')
    expect(result.matchedPhrases).toEqual(
      expect.arrayContaining(['未按时报送', '迟报未报']),
    )
  })

  it('should classify rectification-closure cases to IT04-08 via strong signals', () => {
    const mappings: It04TaxonomySemanticMapping[] = [
      {
        l1Code: 'IT04',
        l1Name: '数据治理与监管数据报送',
        l2Code: 'IT04-08',
        l2Name: '历史数据问题整改不到位',
        definition: '既往EAST或监管数据问题整改不到位、反复发生',
        canonicalTheme: '历史数据问题整改管理',
        aliases: ['历史数据整改', '屡查屡犯', '整改不到位'],
        keywords: ['整改', '闭环', '关闭验证'],
      },
      {
        l1Code: 'IT04',
        l1Name: '数据治理与监管数据报送',
        l2Code: 'IT04-05',
        l2Name: '监管报表/监管系统报送数据不准确',
        definition: '除EAST外的各类监管报表、监管系统报送错报漏报',
        canonicalTheme: '监管报表报送准确性管理',
        aliases: ['监管报表', '监管系统报送'],
        keywords: ['报送', '报表'],
      },
    ]

    const result = classifyIt04CaseText(
      '监管报送历史差错整改后未做关闭验证，问题反复出现，属于整改闭环验证缺失。',
      mappings,
    )

    expect(result.l2Code).toBe('IT04-08')
    expect(result.decisionSource).toBe('rule')
    expect(result.matchedPhrases).toEqual(
      expect.arrayContaining(['整改闭环']),
    )
  })

  it('should prefer falsification signals over generic reporting bucket', () => {
    const mappings: It04TaxonomySemanticMapping[] = [
      {
        l1Code: 'IT04',
        l1Name: '数据治理与监管数据报送',
        l2Code: 'IT04-11',
        l2Name: '监管报告/报表/文件/资料虚假或失真',
        definition: '编制或提供虚假报告、报表、文件、资料',
        canonicalTheme: '监管报告真实性控制',
        aliases: ['虚假报告', '数据造假'],
        keywords: ['人工调整', '真实性审核', '严重失真'],
      },
      {
        l1Code: 'IT04',
        l1Name: '数据治理与监管数据报送',
        l2Code: 'IT04-05',
        l2Name: '监管报表/监管系统报送数据不准确',
        definition: '除EAST外的各类监管报表、监管系统报送错报漏报',
        canonicalTheme: '监管报表报送准确性管理',
        aliases: ['监管报表', '监管系统报送'],
        keywords: ['报送', '数据不准确'],
      },
    ]

    const result = classifyIt04CaseText(
      '监管报送过程中存在人工调整且缺少真实性审核，报送数据与实际严重偏离，形成数据失真。',
      mappings,
    )

    expect(result.l2Code).toBe('IT04-11')
    expect(result.decisionSource).toBe('rule')
    expect(result.matchedPhrases).toEqual(
      expect.arrayContaining(['真实性审核', '人工调整', '严重失真']),
    )
  })

  it('should classify record-maintenance delay cases to IT04-10 before IT04-07', () => {
    const mappings: It04TaxonomySemanticMapping[] = [
      {
        l1Code: 'IT04',
        l1Name: '数据治理与监管数据报送',
        l2Code: 'IT04-10',
        l2Name: '信息登记/录入/更新不及时不规范',
        definition: '投保信息、业务信息、登记信息录入、更新、维护不及时不规范',
        canonicalTheme: '信息登记与更新管理',
        aliases: ['信息登记', '录入更新', '维护及时性'],
        keywords: ['录入不及时', '更新不及时', '补录'],
      },
      {
        l1Code: 'IT04',
        l1Name: '数据治理与监管数据报送',
        l2Code: 'IT04-07',
        l2Name: '信息科技非现场监管报表未报/迟报',
        definition: '科技监管类报表、台账、信息报送未按时报送',
        canonicalTheme: '科技监管报表时效管理',
        aliases: ['非现场监管报表', '台账报送'],
        keywords: ['未按时报送', '迟报', '超期'],
      },
    ]

    const result = classifyIt04CaseText(
      '监管登记信息补录和更新没有时效监控，补录超期且无人催办，导致信息更新不及时不规范。',
      mappings,
    )

    expect(result.l2Code).toBe('IT04-10')
    expect(result.decisionSource).toBe('rule')
    expect(result.matchedPhrases).toEqual(
      expect.arrayContaining(['登记录入更新', '更新不及时']),
    )
  })

  it('should aggregate hits, gaps, and emit markdown/json reports', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'it04-benchmark-'))
    const datasetPath = path.join(tempDir, 'cases.json')
    const csvPath = path.join(tempDir, 'taxonomy.csv')
    const reportDir = path.join(tempDir, 'reports')

    fs.writeFileSync(
      datasetPath,
      JSON.stringify(
        [
          {
            caseId: 'CASE-001',
            caseTitle: 'quality rule gap',
            caseText:
              'EAST 数据质量不符合规范要求，报送前未建立自动化数据质量校验规则，异常字段未被阻断。',
            expectedL2Code: 'IT04-04',
            expectedFailureModeCodes: ['FM-DQ-001'],
            expectedControlCodes: ['CTRL-DQ-001'],
            expectedEvidenceCodes: ['EVD-DQ-RULE-001'],
            expectedEvidenceCategories: ['LOG'],
          },
          {
            caseId: 'CASE-002',
            caseTitle: 'false filing evidence gap',
            caseText:
              '编制并向监管部门提供虚假报表，存在虚假记载和数据造假，监管报告严重失真。',
            expectedL2Code: 'IT04-11',
            expectedFailureModeCodes: ['FM-FAL-001'],
            expectedControlCodes: ['CTRL-FAL-001'],
            expectedEvidenceCodes: ['EVD-FAL-AUDIT-001'],
            expectedEvidenceCategories: ['SAMPLE_RECORD'],
          },
        ],
        null,
        2,
      ),
      'utf8',
    )
    fs.writeFileSync(
      csvPath,
      [
        '一级编码,一级类型,二级编码,二级子类型,定义口径,建议canonicalTheme,建议aliases,建议keywords,建议controlFamilies,差距说明',
        'IT04,数据治理与监管数据报送,IT04-04,EAST数据质量不符合规范要求,EAST数据质量问题，包括字段偏差、口径错误、数据不一致,监管数据质量管理,EAST数据质量|字段偏差|口径错误,EAST|质量|偏差|不符合规范,REG_REPORTING|DATA_TRACEABILITY,',
        'IT04,数据治理与监管数据报送,IT04-11,监管报告/报表/文件/资料虚假或失真,编制或提供虚假报告、报表、文件、资料,监管报告真实性控制,虚假报告|虚假报表|数据造假,虚假记载|数据造假|严重失真,REG_REPORTING|DATA_TRACEABILITY,',
      ].join('\n'),
      'utf8',
    )

    const runner = new It04BenchmarkRunner({
      datasetPath,
      taxonomyMappingPath: csvPath,
      reportDir,
      failureModeService: {
        findByL2Code: jest.fn().mockImplementation(async (l2Code: string) => {
          if (l2Code === 'IT04-04') {
            return {
              items: [{ failureModeCode: 'FM-DQ-001' }],
            }
          }

          return {
            items: [{ failureModeCode: 'FM-FAL-001' }],
          }
        }),
      },
      caseClusteringChainService: {
        resolveControlPointsByL2Code: jest.fn().mockImplementation(async (l2Code: string) => {
          if (l2Code === 'IT04-04') {
            return {
              items: [{ controlCode: 'CTRL-DQ-001' }],
              total: 1,
            }
          }

          return {
            items: [{ controlCode: 'CTRL-FAL-001' }],
            total: 1,
          }
        }),
      },
      controlPointService: {
        findByL2CodeWithFullChain: jest.fn().mockImplementation(async (l2Code: string) => {
          if (l2Code === 'IT04-04') {
            return {
              l2Code,
              l2Name: 'EAST数据质量不符合规范要求',
              failureModes: [
                {
                  failureModeId: 'fm-dq-001',
                  failureModeCode: 'FM-DQ-001',
                  name: '数据质量校验规则缺失',
                  category: 'MISSING_CONTROL',
                  controlPoints: [
                    {
                      controlId: 'cp-dq-001',
                      controlCode: 'CTRL-DQ-001',
                      controlName: '数据质量自动化校验控制',
                      maturityLevel: 'hard',
                      authoritativeScore: 1,
                      relevance: 'PRIMARY',
                      evidenceTypes: [
                        {
                          evidenceId: 'evd-dq-001',
                          evidenceCode: 'EVD-DQ-RULE-001',
                          evidenceName: '数据质量校验日志',
                          evidenceCategory: 'LOG',
                          autoCollectable: true,
                          requiredLevel: 'REQUIRED',
                          frequency: 'DAILY',
                        },
                      ],
                    },
                  ],
                },
              ],
            }
          }

          return {
            l2Code,
            l2Name: '监管报告/报表/文件/资料虚假或失真',
            failureModes: [
              {
                failureModeId: 'fm-fal-001',
                failureModeCode: 'FM-FAL-001',
                name: '虚假填报/人为数据造假',
                category: 'FALSIFICATION',
                controlPoints: [
                  {
                    controlId: 'cp-fal-001',
                    controlCode: 'CTRL-FAL-001',
                    controlName: '报送数据真实性审核控制',
                    maturityLevel: 'hard',
                    authoritativeScore: 1,
                    relevance: 'PRIMARY',
                    evidenceTypes: [],
                  },
                ],
              },
            ],
          }
        }),
      },
    })

    const report = await runner.runBenchmark({ writeReport: true, minFullChainHits: 1 })

    expect(report.summary.totalCases).toBe(2)
    expect(report.summary.fullChainHitCount).toBe(1)
    expect(report.summary.evidenceHitCount).toBe(1)
    expect(report.summary.missCategoryCounts.evidence).toBe(1)
    expect(report.markdownPath).toBeDefined()
    expect(report.jsonPath).toBeDefined()
    expect(fs.existsSync(report.markdownPath!)).toBe(true)
    expect(fs.existsSync(report.jsonPath!)).toBe(true)
  })
})
