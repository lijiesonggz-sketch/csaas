import { BadRequestException, NotFoundException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { PackResolverService } from '../applicability-engine/services/pack-resolver.service'
import { ControlGapInputService } from '../survey/control-gap-input.service'
import { ControlExplainService } from './services/control-explain.service'
import { ControlReportCompilerService } from './services/control-report-compiler.service'

describe('ControlReportCompilerService', () => {
  let service: ControlReportCompilerService

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
        ControlReportCompilerService,
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

    service = module.get(ControlReportCompilerService)
    jest.clearAllMocks()
  })

  it('should compile report sections grouped by l1/l2 and enrich controls with gap/explain payloads', async () => {
    packResolverService.resolveByOrganizationId.mockResolvedValue({
      controls: [{ controlId: 'control-2' }, { controlId: 'control-1' }],
    })
    controlGapInputService.getControlGapInput.mockResolvedValue({
      controls: [
        {
          controlId: 'control-1',
          currentStatus: 'PARTIAL',
          gapLevel: 'MEDIUM',
          questionIds: ['q-1'],
          missingAnswers: [],
          riskHints: ['Average score below compliance threshold'],
        },
        {
          controlId: 'control-2',
          currentStatus: 'COMPLIANT',
          gapLevel: 'LOW',
          questionIds: ['q-2'],
          missingAnswers: [],
          riskHints: [],
        },
      ],
    })
    controlExplainService.getControlExplain
      .mockResolvedValueOnce({
        control: {
          controlId: 'control-2',
          controlCode: 'CTRL-OPS-002',
          controlName: '访问控制管理',
          l1: { code: 'IT02', name: '网络与信息安全' },
          l2: { code: 'IT02-03', name: '访问控制与授权管理' },
        },
        applicabilityReason: '机构命中访问控制要求',
        clauses: [],
        cases: [],
        evidences: [],
        questions: [],
        remediations: [],
      })
      .mockResolvedValueOnce({
        control: {
          controlId: 'control-1',
          controlCode: 'CTRL-DG-004',
          controlName: '监管报送准确性控制',
          l1: { code: 'IT04', name: '数据治理与监管数据报送' },
          l2: { code: 'IT04-06', name: '监管报送准确性控制' },
        },
        applicabilityReason: '机构命中监管报送控制包',
        clauses: [
          {
            clauseId: 'clause-1',
            clauseCode: 'CLAUSE-001',
            articleNo: '第十条',
            clauseSummary: '监管报送准确性要求',
            source: { sourceName: '监管报送办法' },
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
        evidences: [
          {
            id: 'mapping-1',
            evidenceId: 'evidence-1',
            evidenceCode: 'EVD-001',
            evidenceName: '审批记录',
            evidenceDesc: '关键审批留痕',
            evidenceCategory: 'approval',
            status: 'ACTIVE',
            requiredLevel: 'REQUIRED',
            notes: '核心证据',
          },
        ],
        questions: [],
        remediations: [
          {
            actionId: 'action-1',
            actionCode: 'RA-CTRL-001',
            actionTitle: '复核监管报送校验流程',
            actionDesc: '核对监管报送校验规则与人工复核记录',
            priorityDefault: 'HIGH',
            expectedBenefit: '提升监管报送准确性',
          },
        ],
      })

    const result = await service.compileReport({
      organizationId: 'org-id',
      controlIds: ['control-2', 'control-1'],
      surveyResponseId: 'survey-id',
    })

    expect(result.sections).toEqual([
      {
        l1Code: 'IT02',
        l1Name: '网络与信息安全',
        l2Sections: [
          {
            l2Code: 'IT02-03',
            l2Name: '访问控制与授权管理',
            controls: [
              expect.objectContaining({
                controlId: 'control-2',
                controlCode: 'CTRL-OPS-002',
                currentStatus: 'COMPLIANT',
                gapLevel: 'LOW',
                clauses: [],
                cases: [],
                evidences: [],
                recommendations: [],
              }),
            ],
          },
        ],
      },
      {
        l1Code: 'IT04',
        l1Name: '数据治理与监管数据报送',
        l2Sections: [
          {
            l2Code: 'IT04-06',
            l2Name: '监管报送准确性控制',
            controls: [
              expect.objectContaining({
                controlId: 'control-1',
                controlCode: 'CTRL-DG-004',
                currentStatus: 'PARTIAL',
                gapLevel: 'MEDIUM',
                clauses: [
                  expect.objectContaining({
                    clauseCode: 'CLAUSE-001',
                  }),
                ],
                cases: [
                  expect.objectContaining({
                    caseCode: 'CASE-001',
                  }),
                ],
                evidences: [
                  expect.objectContaining({
                    evidenceCode: 'EVD-001',
                  }),
                ],
                recommendations: [
                  expect.objectContaining({
                    controlId: 'control-1',
                    remediationActionId: 'action-1',
                    actionCode: 'RA-CTRL-001',
                    currentStatus: 'PARTIAL',
                    gapLevel: 'MEDIUM',
                  }),
                ],
              }),
            ],
          },
        ],
      },
    ])
  })

  it('should keep empty arrays stable when support materials are missing', async () => {
    packResolverService.resolveByOrganizationId.mockResolvedValue({
      controls: [{ controlId: 'control-1' }],
    })
    controlGapInputService.getControlGapInput.mockResolvedValue({
      controls: [],
    })
    controlExplainService.getControlExplain.mockResolvedValue({
      control: {
        controlId: 'control-1',
        controlCode: 'CTRL-DG-004',
        controlName: '监管报送准确性控制',
        l1: { code: 'IT04', name: '数据治理与监管数据报送' },
        l2: { code: 'IT04-06', name: '监管报送准确性控制' },
      },
      applicabilityReason: '机构命中监管报送控制包',
      clauses: [],
      cases: [],
      evidences: [],
      questions: [],
      remediations: [],
    })

    const result = await service.compileReport({
      organizationId: 'org-id',
      controlIds: ['control-1'],
      surveyResponseId: 'survey-id',
    })

    expect(result.sections[0].l2Sections[0].controls[0]).toMatchObject({
      currentStatus: 'INCOMPLETE',
      gapLevel: 'HIGH',
      clauses: [],
      cases: [],
      evidences: [],
      recommendations: [],
    })
  })

  it('should reject empty controlIds explicitly', async () => {
    await expect(
      service.compileReport({
        organizationId: 'org-id',
        controlIds: [],
        surveyResponseId: 'survey-id',
      }),
    ).rejects.toThrow(BadRequestException)
  })

  it('should reject controlIds outside the applicable set for the organization', async () => {
    packResolverService.resolveByOrganizationId.mockResolvedValue({
      controls: [{ controlId: 'control-1' }],
    })

    await expect(
      service.compileReport({
        organizationId: 'org-id',
        controlIds: ['control-2'],
        surveyResponseId: 'survey-id',
      }),
    ).rejects.toThrow(NotFoundException)
  })

  it('should keep recommendations scoped to each control and fall back to empty arrays when gap context is missing', async () => {
    packResolverService.resolveByOrganizationId.mockResolvedValue({
      controls: [{ controlId: 'control-1' }, { controlId: 'control-2' }],
    })
    controlGapInputService.getControlGapInput.mockResolvedValue({
      controls: [
        {
          controlId: 'control-1',
          currentStatus: 'PARTIAL',
          gapLevel: 'MEDIUM',
          questionIds: ['q-1'],
          missingAnswers: [],
          riskHints: [],
        },
      ],
    })
    controlExplainService.getControlExplain
      .mockResolvedValueOnce({
        control: {
          controlId: 'control-1',
          controlCode: 'CTRL-DG-004',
          controlName: '监管报送准确性控制',
          l1: { code: 'IT04', name: '数据治理与监管数据报送' },
          l2: { code: 'IT04-06', name: '监管报送准确性控制' },
        },
        applicabilityReason: '机构命中监管报送控制包',
        clauses: [],
        cases: [],
        evidences: [],
        questions: [],
        remediations: [
          {
            actionId: 'action-1',
            actionCode: 'RA-CTRL-001',
            actionTitle: '复核监管报送校验流程',
          },
        ],
      })
      .mockResolvedValueOnce({
        control: {
          controlId: 'control-2',
          controlCode: 'CTRL-OPS-002',
          controlName: '访问控制管理',
          l1: { code: 'IT02', name: '网络与信息安全' },
          l2: { code: 'IT02-03', name: '访问控制与授权管理' },
        },
        applicabilityReason: '机构命中访问控制要求',
        clauses: [],
        cases: [],
        evidences: [],
        questions: [],
        remediations: [
          {
            actionId: 'action-2',
            actionCode: 'RA-CTRL-002',
            actionTitle: '补充访问控制审批记录',
          },
        ],
      })

    const result = await service.compileReport({
      organizationId: 'org-id',
      controlIds: ['control-1', 'control-2'],
      surveyResponseId: 'survey-id',
    })

    const controls = result.sections.flatMap((section) =>
      section.l2Sections.flatMap((l2Section) => l2Section.controls),
    )
    const firstControl = controls.find((control) => control.controlId === 'control-1')
    const secondControl = controls.find((control) => control.controlId === 'control-2')

    expect(firstControl?.recommendations).toEqual([
      expect.objectContaining({
        controlId: 'control-1',
        remediationActionId: 'action-1',
        actionCode: 'RA-CTRL-001',
      }),
    ])
    expect(secondControl?.recommendations).toEqual([])
  })
})
