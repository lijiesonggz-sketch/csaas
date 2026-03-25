import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { TaxonomyL1 } from '../../database/entities/taxonomy-l1.entity'
import { TaxonomyL2 } from '../../database/entities/taxonomy-l2.entity'
import { ControlPoint } from '../../database/entities/control-point.entity'
import { ComplianceCaseService } from '../knowledge-graph/services/compliance-case.service'
import { ControlPackLinkService } from '../knowledge-graph/services/control-pack-link.service'
import { ControlPointService } from '../knowledge-graph/services/control-point.service'
import { EvidenceService } from '../knowledge-graph/services/evidence.service'
import { QuestionItemService } from '../knowledge-graph/services/question-item.service'
import { RegulationService } from '../knowledge-graph/services/regulation.service'
import { RemediationActionService } from '../knowledge-graph/services/remediation-action.service'
import { ControlExplainService } from './services/control-explain.service'

describe('ControlExplainService', () => {
  let service: ControlExplainService

  const controlPointRepository = {
    findOne: jest.fn(),
  }

  const taxonomyL1Repository = {
    findOne: jest.fn(),
  }

  const taxonomyL2Repository = {
    findOne: jest.fn(),
  }

  const mockControlPointService = {
    findOne: jest.fn(),
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ControlExplainService,
        {
          provide: getRepositoryToken(ControlPoint),
          useValue: controlPointRepository,
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
      applicabilityReason: '机构属于银行业；监管关注度较高',
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

    const result = await service.getControlExplain('control-id', {
      organizationId: 'org-id',
    })

    expect(result.applicabilityReason).toBe('当前机构画像下未命中该控制点')
    expect(result.clauses).toEqual([])
    expect(result.cases).toEqual([])
    expect(result.evidences).toEqual([])
    expect(result.questions).toEqual([])
    expect(result.remediations).toEqual([])
  })
})
