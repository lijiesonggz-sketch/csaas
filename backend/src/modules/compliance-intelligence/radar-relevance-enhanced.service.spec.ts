import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { PackResolverService } from '../applicability-engine/services/pack-resolver.service'
import { AnalyzedContent } from '../../database/entities/analyzed-content.entity'
import { ControlGapInputService } from '../survey/control-gap-input.service'
import { ControlExplainService } from './services/control-explain.service'
import { RadarRelevanceEnhancedService } from './services/radar-relevance-enhanced.service'

describe('RadarRelevanceEnhancedService', () => {
  let service: RadarRelevanceEnhancedService

  const analyzedContentRepository = {
    findOne: jest.fn(),
  }

  const packResolverService = {
    resolveByOrganizationId: jest.fn(),
  }

  const controlExplainService = {
    getControlExplain: jest.fn(),
  }

  const controlGapInputService = {
    getControlGapInput: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RadarRelevanceEnhancedService,
        {
          provide: getRepositoryToken(AnalyzedContent),
          useValue: analyzedContentRepository,
        },
        {
          provide: PackResolverService,
          useValue: packResolverService,
        },
        {
          provide: ControlExplainService,
          useValue: controlExplainService,
        },
        {
          provide: ControlGapInputService,
          useValue: controlGapInputService,
        },
      ],
    }).compile()

    service = module.get(RadarRelevanceEnhancedService)
    jest.clearAllMocks()
  })

  it('should return explainable matched controls, cases and clauses for strongly relevant compliance content', async () => {
    analyzedContentRepository.findOne.mockResolvedValue({
      id: 'content-id',
      contentId: 'raw-content-id',
      categories: ['监管报送', '跨境数据'],
      tags: [{ name: '监管报送处罚案例' }, { name: '跨境数据' }],
      rawContent: {
        title: '监管报送与跨境数据处罚通报',
        summary: '监管报送准确性与跨境数据治理要求同步收紧',
        fullContent: '某银行因监管报送数据失真和跨境数据治理缺陷被处罚。',
      },
      complianceAnalysis: {
        complianceRiskCategory: '数据安全',
        penaltyCase: '监管报送数据失真处罚案例',
        policyRequirements: '跨境数据治理要求',
      },
    })
    packResolverService.resolveByOrganizationId.mockResolvedValue({
      controls: [
        { controlId: 'control-1', controlCode: 'CTRL-DG-004' },
        { controlId: 'control-2', controlCode: 'CTRL-DATA-011' },
      ],
    })
    controlGapInputService.getControlGapInput.mockResolvedValue({
      controls: [
        { controlId: 'control-1', gapLevel: 'HIGH' },
        { controlId: 'control-2', gapLevel: 'MEDIUM' },
      ],
    })
    controlExplainService.getControlExplain
      .mockResolvedValueOnce({
        control: {
          controlId: 'control-1',
          controlCode: 'CTRL-DG-004',
          controlName: '监管报送准确性控制',
          controlDesc: '确保监管报送准确性',
        },
        applicabilityReason: '银行机构命中监管报送与数据治理控制包',
        clauses: [
          {
            clauseId: 'clause-1',
            clauseCode: 'CLAUSE-001',
            articleNo: '第十条',
            clauseSummary: '监管报送准确性要求',
            clauseText: '机构应确保监管报送数据准确完整',
            source: {
              sourceName: '监管报送办法',
            },
          },
        ],
        cases: [
          {
            caseId: 'case-1',
            caseCode: 'CASE-001',
            caseTitle: '监管报送数据失真处罚案例',
            sourceOrg: '某银行',
            authorityName: '监管机构',
          },
        ],
        evidences: [],
        questions: [
          {
            questionId: 'question-1',
            questionCode: 'Q-CTRL-001',
            questionText: '是否校验监管报送准确性？',
            questionType: 'single_choice',
            required: true,
          },
        ],
        remediations: [
          {
            actionId: 'action-1',
            actionCode: 'RA-CTRL-001',
            actionTitle: '复核监管报送校验流程',
            actionDesc: '核对监管报送校验规则与人工复核记录',
            priorityDefault: 'HIGH',
          },
        ],
      })
      .mockResolvedValueOnce({
        control: {
          controlId: 'control-2',
          controlCode: 'CTRL-DATA-011',
          controlName: '跨境数据治理控制',
          controlDesc: '治理跨境数据流转',
        },
        applicabilityReason: '机构存在跨境业务与敏感数据处理场景',
        clauses: [],
        cases: [],
        evidences: [],
        questions: [],
        remediations: [
          {
            actionId: 'action-2',
            actionCode: 'RA-CTRL-002',
            actionTitle: '核查跨境数据审批台账',
            actionDesc: '确认跨境数据审批与留痕材料完整',
            priorityDefault: 'MEDIUM',
          },
        ],
      })

    const result = await service.calculateRadarRelevance({
      organizationId: 'org-id',
      contentId: 'content-id',
      surveyResponseId: 'survey-id',
    })

    expect(result.priority).toBe('HIGH')
    expect(result.relevanceScore).toBeGreaterThan(0.85)
    expect(result.relevanceScore).toBeLessThanOrEqual(1)
    expect(result.matchedControls).toEqual([
      expect.objectContaining({
        controlId: 'control-1',
        controlCode: 'CTRL-DG-004',
      }),
      expect.objectContaining({
        controlId: 'control-2',
        controlCode: 'CTRL-DATA-011',
      }),
    ])
    expect(result.matchedCases).toEqual([
      expect.objectContaining({
        controlId: 'control-1',
        caseId: 'case-1',
        caseCode: 'CASE-001',
      }),
    ])
    expect(result.matchedClauses).toEqual([
      expect.objectContaining({
        controlId: 'control-1',
        clauseId: 'clause-1',
        clauseCode: 'CLAUSE-001',
      }),
    ])
    expect(result.suggestedChecks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          controlId: 'control-1',
          controlCode: 'CTRL-DG-004',
          checkType: 'QUESTION',
          sourceCode: 'Q-CTRL-001',
          title: '是否校验监管报送准确性？',
          priority: 'HIGH',
          detail: expect.stringContaining('差距等级：HIGH'),
        }),
        expect.objectContaining({
          controlId: 'control-1',
          controlCode: 'CTRL-DG-004',
          checkType: 'REMEDIATION',
          sourceCode: 'RA-CTRL-001',
          title: '复核监管报送校验流程',
        }),
      ]),
    )
  })

  it('should return a stable low-relevance result with empty arrays when no applicable controls match the content', async () => {
    analyzedContentRepository.findOne.mockResolvedValue({
      id: 'content-id',
      contentId: 'raw-content-id',
      categories: ['无关主题'],
      tags: [{ name: '市场活动' }],
      rawContent: {
        title: '与监管控制无关的市场资讯',
        summary: '一则不涉及控制点证据链的普通资讯',
        fullContent: '内容不包含任何控制点、案例或条款语义。',
      },
      complianceAnalysis: null,
    })
    packResolverService.resolveByOrganizationId.mockResolvedValue({
      controls: [{ controlId: 'control-1', controlCode: 'CTRL-DG-004' }],
    })
    controlExplainService.getControlExplain.mockResolvedValue({
      control: {
        controlId: 'control-1',
        controlCode: 'CTRL-DG-004',
        controlName: '监管报送准确性控制',
        controlDesc: '确保监管报送准确性',
      },
      applicabilityReason: '银行机构命中监管报送与数据治理控制包',
      clauses: [],
      cases: [],
      evidences: [],
      questions: [],
      remediations: [],
    })

    const result = await service.calculateRadarRelevance({
      organizationId: 'org-id',
      contentId: 'content-id',
    })

    expect(result).toEqual({
      relevanceScore: 0,
      priority: 'LOW',
      matchedControls: [],
      matchedCases: [],
      matchedClauses: [],
      suggestedChecks: [],
    })
    expect(controlGapInputService.getControlGapInput).not.toHaveBeenCalled()
  })

  it('should cap the final relevanceScore at 1.0 when strong evidence-chain hits and a HIGH gap boost are both present', async () => {
    analyzedContentRepository.findOne.mockResolvedValue({
      id: 'content-id',
      contentId: 'raw-content-id',
      categories: ['监管报送', '监管报送准确性控制'],
      tags: [{ name: '监管报送准确性控制' }, { name: '监管报送处罚案例' }],
      rawContent: {
        title: '监管报送准确性控制处罚通报',
        summary: '监管报送准确性控制被重点点名',
        fullContent: '监管报送准确性控制、监管报送处罚案例、监管报送准确性要求均被反复提及。',
      },
      complianceAnalysis: {
        penaltyCase: '监管报送处罚案例',
        policyRequirements: '监管报送准确性要求',
      },
    })
    packResolverService.resolveByOrganizationId.mockResolvedValue({
      controls: [{ controlId: 'control-1', controlCode: 'CTRL-DG-004' }],
    })
    controlGapInputService.getControlGapInput.mockResolvedValue({
      controls: [{ controlId: 'control-1', gapLevel: 'HIGH' }],
    })
    controlExplainService.getControlExplain.mockResolvedValue({
      control: {
        controlId: 'control-1',
        controlCode: 'CTRL-DG-004',
        controlName: '监管报送准确性控制',
        controlDesc: '监管报送准确性控制',
      },
      applicabilityReason: '监管报送准确性控制',
      clauses: [
        {
          clauseId: 'clause-1',
          clauseCode: 'CLAUSE-001',
          clauseSummary: '监管报送准确性要求',
          clauseText: '监管报送准确性要求',
          articleNo: '第十条',
          source: { sourceName: '监管报送办法' },
        },
      ],
      cases: [
        {
          caseId: 'case-1',
          caseCode: 'CASE-001',
          caseTitle: '监管报送处罚案例',
          sourceOrg: '某银行',
          authorityName: '监管机构',
        },
      ],
      evidences: [],
      questions: [],
      remediations: [],
    })

    const result = await service.calculateRadarRelevance({
      organizationId: 'org-id',
      contentId: 'content-id',
      surveyResponseId: 'survey-id',
    })

    expect(controlGapInputService.getControlGapInput).toHaveBeenCalledWith('survey-id', 'org-id')
    expect(result.relevanceScore).toBe(1)
    expect(result.priority).toBe('HIGH')
    expect(result.suggestedChecks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkType: 'CLAUSE',
          sourceCode: 'CLAUSE-001',
        }),
        expect.objectContaining({
          checkType: 'CASE',
          sourceCode: 'CASE-001',
        }),
      ]),
    )
  })

  it('should preserve a matched control even when that control has no cases or clauses, as long as the control-level semantics match the content', async () => {
    analyzedContentRepository.findOne.mockResolvedValue({
      id: 'content-id',
      contentId: 'raw-content-id',
      categories: ['跨境数据'],
      tags: [{ name: '跨境数据治理' }],
      rawContent: {
        title: '跨境数据治理监管提示',
        summary: '跨境数据治理控制需要持续关注',
        fullContent: '内容强调跨境数据治理控制和相关治理要求。',
      },
      complianceAnalysis: {
        policyRequirements: '跨境数据治理控制',
      },
    })
    packResolverService.resolveByOrganizationId.mockResolvedValue({
      controls: [{ controlId: 'control-2', controlCode: 'CTRL-DATA-011' }],
    })
    controlExplainService.getControlExplain.mockResolvedValue({
      control: {
        controlId: 'control-2',
        controlCode: 'CTRL-DATA-011',
        controlName: '跨境数据治理控制',
        controlDesc: '治理跨境数据流转',
      },
      applicabilityReason: '机构存在跨境业务与敏感数据处理场景',
      clauses: [],
      cases: [],
      evidences: [],
      questions: [],
      remediations: [],
    })

    const result = await service.calculateRadarRelevance({
      organizationId: 'org-id',
      contentId: 'content-id',
    })

    expect(result.matchedControls).toEqual([
      expect.objectContaining({
        controlId: 'control-2',
        controlCode: 'CTRL-DATA-011',
      }),
    ])
    expect(result.matchedCases).toEqual([])
    expect(result.matchedClauses).toEqual([])
    expect(result.priority).toBe('LOW')
    expect(Array.isArray(result.suggestedChecks)).toBe(true)
  })

  it('should fall back to clause-based suggested checks when no question or remediation item is available', async () => {
    analyzedContentRepository.findOne.mockResolvedValue({
      id: 'content-id',
      contentId: 'raw-content-id',
      categories: ['监管报送'],
      tags: [{ name: '监管报送准确性要求' }],
      rawContent: {
        title: '监管报送准确性要求更新',
        summary: '重点强调监管报送准确性要求',
        fullContent: '内容直接引用监管报送准确性要求和对应处罚案例。',
      },
      complianceAnalysis: {
        policyRequirements: '监管报送准确性要求',
      },
    })
    packResolverService.resolveByOrganizationId.mockResolvedValue({
      controls: [{ controlId: 'control-1', controlCode: 'CTRL-DG-004' }],
    })
    controlExplainService.getControlExplain.mockResolvedValue({
      control: {
        controlId: 'control-1',
        controlCode: 'CTRL-DG-004',
        controlName: '监管报送准确性控制',
        controlDesc: '确保监管报送准确完整',
      },
      applicabilityReason: '银行机构命中监管报送与数据治理控制包',
      clauses: [
        {
          clauseId: 'clause-1',
          clauseCode: 'CLAUSE-001',
          articleNo: '第十条',
          clauseSummary: '监管报送准确性要求',
          clauseText: '机构应确保监管报送数据准确完整',
          source: {
            sourceName: '监管报送办法',
          },
        },
      ],
      cases: [],
      evidences: [],
      questions: [],
      remediations: [],
    })

    const result = await service.calculateRadarRelevance({
      organizationId: 'org-id',
      contentId: 'content-id',
    })

    expect(result.suggestedChecks).toEqual([
      expect.objectContaining({
        controlId: 'control-1',
        controlCode: 'CTRL-DG-004',
        checkType: 'CLAUSE',
        sourceCode: 'CLAUSE-001',
        title: '监管报送准确性要求',
      }),
    ])
  })
})
