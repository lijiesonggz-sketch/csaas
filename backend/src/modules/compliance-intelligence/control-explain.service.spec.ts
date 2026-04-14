import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { TaxonomyL1 } from '../../database/entities/taxonomy-l1.entity'
import { TaxonomyL2 } from '../../database/entities/taxonomy-l2.entity'
import { ControlPoint } from '../../database/entities/control-point.entity'
import { FailureModeControlMap } from '../../database/entities/failure-mode-control-map.entity'
import { ComplianceCaseService } from '../knowledge-graph/services/compliance-case.service'
import { ControlPackLinkService } from '../knowledge-graph/services/control-pack-link.service'
import { ControlPointService } from '../knowledge-graph/services/control-point.service'
import { EvidenceService } from '../knowledge-graph/services/evidence.service'
import { ObligationService } from '../knowledge-graph/services/obligation.service'
import { QuestionItemService } from '../knowledge-graph/services/question-item.service'
import { RegulationService } from '../knowledge-graph/services/regulation.service'
import { RemediationActionService } from '../knowledge-graph/services/remediation-action.service'
import { ControlExplainService } from './services/control-explain.service'

describe('ControlExplainService', () => {
  let service: ControlExplainService

  const controlPointRepository = {
    findOne: jest.fn(),
  }

  const failureModeControlMapRepository = {
    createQueryBuilder: jest.fn(),
  }

  const taxonomyL1Repository = {
    findOne: jest.fn(),
  }

  const taxonomyL2Repository = {
    findOne: jest.fn(),
  }

  const mockControlPointService = {
    findOne: jest.fn(),
    findByL2CodeWithFullChain: jest.fn(),
  }

  const mockObligationService = {
    findRegulatoryLinksByControlId: jest.fn(),
  }

  const mockControlPackLinkService = {
    buildApplicabilityContext: jest.fn(),
  }

  const mockRegulationService = {
    findClausesByControlId: jest.fn(),
  }

  const mockComplianceCaseService = {
    findCasesByControlId: jest.fn(),
  }

  const mockEvidenceService = {
    findEvidencesByControlId: jest.fn(),
  }

  const mockQuestionItemService = {
    findByControlId: jest.fn(),
  }

  const mockRemediationActionService = {
    findByControlId: jest.fn(),
  }

  const failureModeControlMapQueryBuilder = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ControlExplainService,
        {
          provide: getRepositoryToken(ControlPoint),
          useValue: controlPointRepository,
        },
        {
          provide: getRepositoryToken(FailureModeControlMap),
          useValue: failureModeControlMapRepository,
        },
        {
          provide: getRepositoryToken(TaxonomyL1),
          useValue: taxonomyL1Repository,
        },
        {
          provide: getRepositoryToken(TaxonomyL2),
          useValue: taxonomyL2Repository,
        },
        {
          provide: ControlPointService,
          useValue: mockControlPointService,
        },
        {
          provide: ObligationService,
          useValue: mockObligationService,
        },
        {
          provide: ControlPackLinkService,
          useValue: mockControlPackLinkService,
        },
        {
          provide: RegulationService,
          useValue: mockRegulationService,
        },
        {
          provide: ComplianceCaseService,
          useValue: mockComplianceCaseService,
        },
        {
          provide: EvidenceService,
          useValue: mockEvidenceService,
        },
        {
          provide: QuestionItemService,
          useValue: mockQuestionItemService,
        },
        {
          provide: RemediationActionService,
          useValue: mockRemediationActionService,
        },
      ],
    }).compile()

    service = module.get(ControlExplainService)
    failureModeControlMapRepository.createQueryBuilder.mockReturnValue(
      failureModeControlMapQueryBuilder,
    )
    jest.clearAllMocks()
  })

  it('should aggregate full explain payload for a control point', async () => {
    controlPointRepository.findOne.mockResolvedValue({
      controlId: 'control-id',
      controlCode: 'CTRL-DG-004',
      controlName: '监管报送准确性控制',
      controlDesc: '确保监管报送准确完整',
      l1Code: 'IT04',
      l2Code: 'IT04-06',
      originType: 'both',
      maturityLevel: 'hard',
      authoritativeScore: 0.8333,
      authorityProfileJson: {
        has_source_basis: true,
        has_applicability_scope: true,
        has_control_activity: true,
        has_expected_evidence: true,
        has_human_review: true,
        has_case_validation: false,
      },
      applicableSector: ['银行', '证券'],
      sectorRequirements: {
        银行: { review_frequency: '季度' },
      },
    })
    taxonomyL1Repository.findOne.mockResolvedValue({
      l1Code: 'IT04',
      l1Name: '数据治理与监管数据报送',
    })
    taxonomyL2Repository.findOne.mockResolvedValue({
      l2Code: 'IT04-06',
      l2Name: '监管报送准确性控制',
    })
    mockControlPackLinkService.buildApplicabilityContext.mockResolvedValue({
      matched: true,
      reasons: ['机构属于银行业', '监管关注度较高'],
      matchedPacks: [{ packCode: 'PACK-SECTOR-BANK' }],
      matchedRules: ['RULE-001'],
    })
    mockRegulationService.findClausesByControlId.mockResolvedValue([{ clauseCode: 'CLAUSE-001' }])
    mockComplianceCaseService.findCasesByControlId.mockResolvedValue([{ caseCode: 'CASE-001' }])
    mockEvidenceService.findEvidencesByControlId.mockResolvedValue({
      controlId: 'control-id',
      evidences: [{ evidenceCode: 'EVD-001' }],
    })
    mockQuestionItemService.findByControlId.mockResolvedValue({
      controlId: 'control-id',
      questions: [{ questionCode: 'Q-CTRL-001' }],
    })
    mockRemediationActionService.findByControlId.mockResolvedValue({
      controlId: 'control-id',
      remediations: [{ actionCode: 'RA-CTRL-001' }],
    })
    failureModeControlMapQueryBuilder.getMany.mockResolvedValue([
      {
        failureModeId: 'fm-001',
        relevance: 'PRIMARY',
        failureMode: {
          failureModeId: 'fm-001',
          failureModeCode: 'FM-REP-001',
          name: '报送口径定义错误',
          category: 'DEFINITION_ERROR',
        },
      },
    ])
    mockControlPointService.findByL2CodeWithFullChain.mockResolvedValue({
      l2Code: 'IT04-06',
      l2Name: '监管报送准确性控制',
      failureModes: [
        {
          failureModeId: 'fm-001',
          failureModeCode: 'FM-REP-001',
          name: '报送口径定义错误',
          category: 'DEFINITION_ERROR',
          controlPoints: [
            {
              controlId: 'control-id',
              controlCode: 'CTRL-DG-004',
              controlName: '监管报送准确性控制',
              maturityLevel: 'hard',
              authoritativeScore: 0.8333,
              relevance: 'PRIMARY',
              evidenceTypes: [
                {
                  evidenceId: 'evidence-001',
                  evidenceCode: 'EVD-001',
                  evidenceName: '报送口径版本记录',
                  evidenceCategory: 'DOCUMENT',
                  autoCollectable: false,
                  requiredLevel: 'HIGH',
                  frequency: 'monthly',
                },
              ],
            },
          ],
        },
      ],
    })
    mockObligationService.findRegulatoryLinksByControlId.mockResolvedValue({
      obligations: [
        {
          obligationId: 'obl-001',
          obligationCode: 'OBL-001',
          obligationText: '应当建立复核机制',
          obligationType: 'MANDATORY',
          coverage: 'FULL',
          clause: {
            clauseId: 'clause-001',
            clauseCode: 'CLAUSE-001',
            articleNo: '第1条',
          },
        },
      ],
      clauses: [],
    })

    const result = await service.getControlExplain('control-id', {
      organizationId: 'org-id',
    })

    expect(result).toEqual({
      control: {
        controlId: 'control-id',
        controlCode: 'CTRL-DG-004',
        controlName: '监管报送准确性控制',
        controlDesc: '确保监管报送准确完整',
        l1: {
          code: 'IT04',
          name: '数据治理与监管数据报送',
        },
        l2: {
          code: 'IT04-06',
          name: '监管报送准确性控制',
        },
      },
      governance: {
        originType: 'both',
        maturityLevel: 'hard',
        authoritativeScore: 0.8333,
        authorityProfile: {
          has_source_basis: true,
          has_applicability_scope: true,
          has_control_activity: true,
          has_expected_evidence: true,
          has_human_review: true,
          has_case_validation: false,
        },
        applicableSector: ['银行', '证券'],
        sectorRequirements: {
          银行: {
            review_frequency: '季度',
          },
        },
      },
      applicabilityReason: '机构属于银行业；监管关注度较高',
      failureModes: [
        {
          failureModeId: 'fm-001',
          failureModeCode: 'FM-REP-001',
          name: '报送口径定义错误',
          category: 'DEFINITION_ERROR',
          relevance: 'PRIMARY',
        },
      ],
      obligations: [
        {
          obligationId: 'obl-001',
          obligationCode: 'OBL-001',
          obligationText: '应当建立复核机制',
          obligationType: 'MANDATORY',
          coverage: 'FULL',
          clause: {
            clauseId: 'clause-001',
            clauseCode: 'CLAUSE-001',
            articleNo: '第1条',
          },
        },
      ],
      reasoningChain: {
        l2: {
          code: 'IT04-06',
          name: '监管报送准确性控制',
        },
        cases: [{ caseCode: 'CASE-001', caseTitle: null }],
        failureModes: [
          {
            failureModeId: 'fm-001',
            failureModeCode: 'FM-REP-001',
            name: '报送口径定义错误',
            relevance: 'PRIMARY',
          },
        ],
        selectedControl: {
          controlId: 'control-id',
          controlCode: 'CTRL-DG-004',
          controlName: '监管报送准确性控制',
          maturityLevel: 'hard',
          authoritativeScore: 0.8333,
        },
        evidenceTypes: [
          {
            evidenceId: 'evidence-001',
            evidenceCode: 'EVD-001',
            evidenceName: '报送口径版本记录',
            evidenceCategory: 'DOCUMENT',
            autoCollectable: false,
            requiredLevel: 'HIGH',
            frequency: 'monthly',
          },
        ],
      },
      clauses: [{ clauseCode: 'CLAUSE-001' }],
      cases: [{ caseCode: 'CASE-001' }],
      evidences: [{ evidenceCode: 'EVD-001' }],
      questions: [{ questionCode: 'Q-CTRL-001' }],
      remediations: [{ actionCode: 'RA-CTRL-001' }],
    })
  })

  it('should return stable empty arrays and fallback applicability reason when support data is missing', async () => {
    controlPointRepository.findOne.mockResolvedValue({
      controlId: 'control-id',
      controlCode: 'CTRL-ACC-002',
      controlName: '访问控制管理',
      controlDesc: null,
      l1Code: 'IT02',
      l2Code: 'IT02-03',
      originType: 'candidate',
      maturityLevel: 'candidate',
      authoritativeScore: null,
      authorityProfileJson: null,
      applicableSector: [],
      sectorRequirements: null,
    })
    taxonomyL1Repository.findOne.mockResolvedValue({
      l1Code: 'IT02',
      l1Name: '网络与信息安全',
    })
    taxonomyL2Repository.findOne.mockResolvedValue({
      l2Code: 'IT02-03',
      l2Name: '访问控制与授权管理',
    })
    mockControlPackLinkService.buildApplicabilityContext.mockResolvedValue({
      matched: false,
      reasons: [],
      matchedPacks: [],
      matchedRules: [],
    })
    mockRegulationService.findClausesByControlId.mockResolvedValue([])
    mockComplianceCaseService.findCasesByControlId.mockResolvedValue([])
    mockEvidenceService.findEvidencesByControlId.mockResolvedValue({
      controlId: 'control-id',
      evidences: [],
    })
    mockQuestionItemService.findByControlId.mockResolvedValue({
      controlId: 'control-id',
      questions: [],
    })
    mockRemediationActionService.findByControlId.mockResolvedValue({
      controlId: 'control-id',
      remediations: [],
    })
    failureModeControlMapQueryBuilder.getMany.mockResolvedValue([])
    mockControlPointService.findByL2CodeWithFullChain.mockResolvedValue({
      l2Code: 'IT02-03',
      l2Name: '访问控制与授权管理',
      failureModes: [],
    })
    mockObligationService.findRegulatoryLinksByControlId.mockResolvedValue({
      obligations: [],
      clauses: [],
    })

    const result = await service.getControlExplain('control-id', {
      organizationId: 'org-id',
    })

    expect(result.applicabilityReason).toBe('当前机构画像下未命中该控制点')
    expect(result.clauses).toEqual([])
    expect(result.cases).toEqual([])
    expect(result.evidences).toEqual([])
    expect(result.questions).toEqual([])
    expect(result.remediations).toEqual([])
    expect(result.failureModes).toEqual([])
    expect(result.obligations).toEqual([])
    expect(result.reasoningChain).toEqual({
      l2: {
        code: 'IT02-03',
        name: '访问控制与授权管理',
      },
      cases: [],
      failureModes: [],
      selectedControl: {
        controlId: 'control-id',
        controlCode: 'CTRL-ACC-002',
        controlName: '访问控制管理',
        maturityLevel: 'candidate',
        authoritativeScore: null,
      },
      evidenceTypes: [],
    })
  })

  it('should keep failure mode cards when direct failure-mode mappings exist but full chain returns no failure modes', async () => {
    controlPointRepository.findOne.mockResolvedValue({
      controlId: 'control-id',
      controlCode: 'CTRL-DG-004',
      controlName: '监管报送准确性控制',
      controlDesc: '确保监管报送准确完整',
      l1Code: 'IT04',
      l2Code: 'IT04-06',
      originType: 'both',
      maturityLevel: 'hard',
      authoritativeScore: 0.8333,
      authorityProfileJson: null,
      applicableSector: [],
      sectorRequirements: null,
    })
    taxonomyL1Repository.findOne.mockResolvedValue({
      l1Code: 'IT04',
      l1Name: '数据治理与监管数据报送',
    })
    taxonomyL2Repository.findOne.mockResolvedValue({
      l2Code: 'IT04-06',
      l2Name: '监管报送准确性控制',
    })
    mockControlPackLinkService.buildApplicabilityContext.mockResolvedValue({
      matched: true,
      reasons: ['命中机构画像'],
      matchedPacks: [],
      matchedRules: [],
    })
    mockRegulationService.findClausesByControlId.mockResolvedValue([])
    mockComplianceCaseService.findCasesByControlId.mockResolvedValue([])
    mockEvidenceService.findEvidencesByControlId.mockResolvedValue({
      controlId: 'control-id',
      evidences: [],
    })
    mockQuestionItemService.findByControlId.mockResolvedValue({
      controlId: 'control-id',
      questions: [],
    })
    mockRemediationActionService.findByControlId.mockResolvedValue({
      controlId: 'control-id',
      remediations: [],
    })
    failureModeControlMapQueryBuilder.getMany.mockResolvedValue([
      {
        failureModeId: 'fm-direct-001',
        relevance: 'PRIMARY',
        failureMode: {
          failureModeId: 'fm-direct-001',
          failureModeCode: 'FM-DIRECT-001',
          name: '直接映射失效模式',
          category: 'MAPPING_ERROR',
        },
      },
    ])
    mockControlPointService.findByL2CodeWithFullChain.mockResolvedValue({
      l2Code: 'IT04-06',
      l2Name: '监管报送准确性控制',
      failureModes: [],
    })
    mockObligationService.findRegulatoryLinksByControlId.mockResolvedValue({
      obligations: [],
      clauses: [],
    })

    const result = await service.getControlExplain('control-id', {
      organizationId: 'org-id',
    })

    expect(result.failureModes).toEqual([
      {
        failureModeId: 'fm-direct-001',
        failureModeCode: 'FM-DIRECT-001',
        name: '直接映射失效模式',
        category: 'MAPPING_ERROR',
        relevance: 'PRIMARY',
      },
    ])
    expect(result.reasoningChain?.failureModes).toEqual([])
  })

  it('should degrade failure modes to empty array when query fails', async () => {
    controlPointRepository.findOne.mockResolvedValue({
      controlId: 'control-id',
      controlCode: 'CTRL-DG-004',
      controlName: '监管报送准确性控制',
      controlDesc: '确保监管报送准确完整',
      l1Code: 'IT04',
      l2Code: 'IT04-06',
      originType: 'both',
      maturityLevel: 'hard',
      authoritativeScore: 0.8333,
      authorityProfileJson: null,
      applicableSector: [],
      sectorRequirements: null,
    })
    taxonomyL1Repository.findOne.mockResolvedValue({
      l1Code: 'IT04',
      l1Name: '数据治理与监管数据报送',
    })
    taxonomyL2Repository.findOne.mockResolvedValue({
      l2Code: 'IT04-06',
      l2Name: '监管报送准确性控制',
    })
    mockControlPackLinkService.buildApplicabilityContext.mockResolvedValue({
      matched: true,
      reasons: ['命中机构画像'],
      matchedPacks: [],
      matchedRules: [],
    })
    mockRegulationService.findClausesByControlId.mockResolvedValue([])
    mockComplianceCaseService.findCasesByControlId.mockResolvedValue([])
    mockEvidenceService.findEvidencesByControlId.mockResolvedValue({
      controlId: 'control-id',
      evidences: [],
    })
    mockQuestionItemService.findByControlId.mockResolvedValue({
      controlId: 'control-id',
      questions: [],
    })
    mockRemediationActionService.findByControlId.mockResolvedValue({
      controlId: 'control-id',
      remediations: [],
    })
    failureModeControlMapQueryBuilder.getMany.mockRejectedValue(new Error('DB connection lost'))
    mockControlPointService.findByL2CodeWithFullChain.mockResolvedValue({
      l2Code: 'IT04-06',
      l2Name: '监管报送准确性控制',
      failureModes: [],
    })
    mockObligationService.findRegulatoryLinksByControlId.mockResolvedValue({
      obligations: [],
      clauses: [],
    })

    const result = await service.getControlExplain('control-id', {
      organizationId: 'org-id',
    })

    expect(result.failureModes).toEqual([])
    expect(result.obligations).toEqual([])
  })
})
