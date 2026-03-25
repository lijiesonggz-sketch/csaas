import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { AIGenerationResult, AITask, ControlPoint, Project } from '../../database/entities'
import { OrganizationQuestionSetService } from '../applicability-engine/services/organization-question-set.service'
import { ProjectQuestionnaireSnapshotService } from './project-questionnaire-snapshot.service'

const PROJECT_ID = '550e8400-e29b-41d4-a716-446655440320'
const ORG_ID = '660e8400-e29b-41d4-a716-446655440320'

describe('ProjectQuestionnaireSnapshotService', () => {
  let service: ProjectQuestionnaireSnapshotService

  const projectRepository = {
    findOne: jest.fn(),
  }
  const aiTaskRepository = {
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  }
  const aiGenerationResultRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  }
  const controlPointRepository = {
    find: jest.fn(),
  }
  const organizationQuestionSetService = {
    getForOrganization: jest.fn(),
  }

  beforeEach(async () => {
    aiTaskRepository.create.mockImplementation((input: Record<string, unknown>) => ({
      id: 'snapshot-task-id',
      ...input,
    }))
    aiTaskRepository.save.mockImplementation(async (input: Record<string, unknown>) => input)
    aiGenerationResultRepository.create.mockImplementation((input: Record<string, unknown>) => input)
    aiGenerationResultRepository.save.mockImplementation(async (input: Record<string, unknown>) => input)

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectQuestionnaireSnapshotService,
        {
          provide: getRepositoryToken(Project),
          useValue: projectRepository,
        },
        {
          provide: getRepositoryToken(AITask),
          useValue: aiTaskRepository,
        },
        {
          provide: getRepositoryToken(AIGenerationResult),
          useValue: aiGenerationResultRepository,
        },
        {
          provide: getRepositoryToken(ControlPoint),
          useValue: controlPointRepository,
        },
        {
          provide: OrganizationQuestionSetService,
          useValue: organizationQuestionSetService,
        },
      ],
    }).compile()

    service = module.get(ProjectQuestionnaireSnapshotService)
    jest.clearAllMocks()
  })

  it('should create a new questionnaire snapshot by reusing the organization question set and persisting a QUESTIONNAIRE task/result pair', async () => {
    projectRepository.findOne.mockResolvedValue({
      id: PROJECT_ID,
      organizationId: ORG_ID,
    })
    aiTaskRepository.find.mockResolvedValue([])
    organizationQuestionSetService.getForOrganization.mockResolvedValue({
      organizationId: ORG_ID,
      questions: [
        {
          questionId: 'question-yes-no',
          controlId: 'control-a',
          questionCode: 'Q-ACC-001',
          questionText: '机构是否建立特权账号定期复核机制？',
          questionType: 'YES_NO',
          answerSchema: null,
          scoringRule: {
            passValues: ['yes'],
          },
          required: true,
        },
        {
          questionId: 'question-single-choice',
          controlId: 'control-b',
          questionCode: 'Q-DATA-001',
          questionText: '机构是否建立跨境数据审批控制？',
          questionType: 'SINGLE_CHOICE',
          answerSchema: {
            options: ['未建立', '部分建立', '基本建立', '较完善', '完全建立'],
          },
          scoringRule: null,
          required: false,
        },
      ],
      missingQuestionControlIds: ['control-c'],
      summary: {
        totalControls: 3,
      },
    })
    controlPointRepository.find.mockResolvedValue([
      {
        controlId: 'control-a',
        controlCode: 'CTRL-ACC-002',
        controlName: '特权账号控制',
      },
      {
        controlId: 'control-b',
        controlCode: 'CTRL-DATA-011',
        controlName: '跨境数据治理',
      },
    ])

    const snapshot = await service.createSnapshot(
      {
        projectId: PROJECT_ID,
      },
      ORG_ID,
    )

    expect(organizationQuestionSetService.getForOrganization).toHaveBeenCalledWith(ORG_ID)
    expect(snapshot).toMatchObject({
      projectId: PROJECT_ID,
      organizationId: ORG_ID,
      questionnaireTaskId: 'snapshot-task-id',
      snapshotVersion: 1,
      reusedExisting: false,
      sourceControlIds: ['control-a', 'control-b'],
      missingQuestionControlIds: ['control-c'],
    })
    expect(snapshot.questions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          question_id: 'Q-ACC-001',
          cluster_id: 'control-a',
          cluster_name: '特权账号控制',
          question_type: 'SINGLE_CHOICE',
          required: true,
        }),
        expect.objectContaining({
          question_id: 'Q-DATA-001',
          cluster_id: 'control-b',
          cluster_name: '跨境数据治理',
          question_type: 'SINGLE_CHOICE',
          required: false,
        }),
      ]),
    )
    expect(aiTaskRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: PROJECT_ID,
        type: 'questionnaire',
        status: 'completed',
        generationStage: 'completed',
        input: expect.objectContaining({
          snapshotKind: 'kg_dynamic_questionnaire',
          snapshotVersion: 1,
        }),
      }),
    )
    expect(aiGenerationResultRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'snapshot-task-id',
        generationType: 'questionnaire',
        selectedResult: expect.objectContaining({
          questionnaire: expect.any(Array),
          questionnaire_metadata: expect.objectContaining({
            projectId: PROJECT_ID,
            organizationId: ORG_ID,
            snapshotVersion: 1,
            snapshotKind: 'kg_dynamic_questionnaire',
          }),
        }),
      }),
    )
  })

  it('should reuse the latest existing snapshot when regenerate is not requested', async () => {
    projectRepository.findOne.mockResolvedValue({
      id: PROJECT_ID,
      organizationId: ORG_ID,
    })
    aiTaskRepository.find.mockResolvedValue([
      {
        id: 'existing-task-id',
        projectId: PROJECT_ID,
        input: {
          snapshotKind: 'kg_dynamic_questionnaire',
          snapshotVersion: 1,
        },
        createdAt: new Date('2026-03-25T16:00:00.000Z'),
      },
    ])
    aiGenerationResultRepository.findOne.mockResolvedValue({
      selectedResult: {
        questionnaire: [
          {
            question_id: 'Q-ACC-001',
          },
        ],
        questionnaire_metadata: {
          projectId: PROJECT_ID,
          organizationId: ORG_ID,
          generatedAt: '2026-03-25T16:00:00.000Z',
          snapshotVersion: 1,
          resolvedControlSetVersion: 'resolved-controls@2026-03-25T16:00:00.000Z',
          questionSetVersion: 'question-set@2026-03-25T16:00:00.000Z',
          sourceControlIds: ['control-a'],
          missingQuestionControlIds: [],
        },
      },
    })

    const snapshot = await service.createSnapshot(
      {
        projectId: PROJECT_ID,
      },
      ORG_ID,
    )

    expect(organizationQuestionSetService.getForOrganization).not.toHaveBeenCalled()
    expect(snapshot).toMatchObject({
      questionnaireTaskId: 'existing-task-id',
      snapshotVersion: 1,
      reusedExisting: true,
    })
  })

  it('should create a new snapshot version when regenerate is explicitly requested', async () => {
    projectRepository.findOne.mockResolvedValue({
      id: PROJECT_ID,
      organizationId: ORG_ID,
    })
    aiTaskRepository.find.mockResolvedValue([
      {
        id: 'existing-task-id',
        projectId: PROJECT_ID,
        input: {
          snapshotKind: 'kg_dynamic_questionnaire',
          snapshotVersion: 1,
        },
        createdAt: new Date('2026-03-25T16:00:00.000Z'),
      },
    ])
    organizationQuestionSetService.getForOrganization.mockResolvedValue({
      organizationId: ORG_ID,
      questions: [
        {
          questionId: 'question-yes-no',
          controlId: 'control-a',
          questionCode: 'Q-ACC-001',
          questionText: '机构是否建立特权账号定期复核机制？',
          questionType: 'YES_NO',
          answerSchema: null,
          scoringRule: {
            passValues: ['yes'],
          },
          required: true,
        },
      ],
      missingQuestionControlIds: [],
      summary: {
        totalControls: 1,
      },
    })
    controlPointRepository.find.mockResolvedValue([
      {
        controlId: 'control-a',
        controlCode: 'CTRL-ACC-002',
        controlName: '特权账号控制',
      },
    ])

    const snapshot = await service.createSnapshot(
      {
        projectId: PROJECT_ID,
        regenerate: true,
      },
      ORG_ID,
    )

    expect(snapshot.snapshotVersion).toBe(2)
    expect(snapshot.reusedExisting).toBe(false)
  })

  it('should fail fast when a question cannot be mapped into the current survey runtime contract', async () => {
    projectRepository.findOne.mockResolvedValue({
      id: PROJECT_ID,
      organizationId: ORG_ID,
    })
    aiTaskRepository.find.mockResolvedValue([])
    organizationQuestionSetService.getForOrganization.mockResolvedValue({
      organizationId: ORG_ID,
      questions: [
        {
          questionId: 'question-text',
          controlId: 'control-a',
          questionCode: 'Q-TEXT-001',
          questionText: '请描述当前控制现状',
          questionType: 'TEXT',
          answerSchema: {
            maxLength: 500,
          },
          scoringRule: null,
          required: true,
        },
      ],
      missingQuestionControlIds: [],
      summary: {
        totalControls: 1,
      },
    })
    controlPointRepository.find.mockResolvedValue([
      {
        controlId: 'control-a',
        controlCode: 'CTRL-ACC-002',
        controlName: '特权账号控制',
      },
    ])

    await expect(
      service.createSnapshot(
        {
          projectId: PROJECT_ID,
        },
        ORG_ID,
      ),
    ).rejects.toThrow('Question type TEXT is not supported by survey runtime')
  })

  it('should reject projects that are not linked to any organization', async () => {
    projectRepository.findOne.mockResolvedValue({
      id: PROJECT_ID,
      organizationId: null,
    })

    await expect(
      service.createSnapshot(
        {
          projectId: PROJECT_ID,
        },
        ORG_ID,
      ),
    ).rejects.toThrow(`Project ${PROJECT_ID} is not linked to an organization`)
  })

  it('should reject projects that do not belong to the current organization context', async () => {
    projectRepository.findOne.mockResolvedValue({
      id: PROJECT_ID,
      organizationId: 'another-org-id',
    })

    await expect(
      service.createSnapshot(
        {
          projectId: PROJECT_ID,
        },
        ORG_ID,
      ),
    ).rejects.toThrow('Project does not belong to the current organization context')
  })

  it('should surface organization profile lookup failures from the question-set service', async () => {
    projectRepository.findOne.mockResolvedValue({
      id: PROJECT_ID,
      organizationId: ORG_ID,
    })
    aiTaskRepository.find.mockResolvedValue([])
    organizationQuestionSetService.getForOrganization.mockRejectedValue(
      new Error(`Organization profile not found for organization ${ORG_ID}`),
    )

    await expect(
      service.createSnapshot(
        {
          projectId: PROJECT_ID,
        },
        ORG_ID,
      ),
    ).rejects.toThrow(`Organization profile not found for organization ${ORG_ID}`)
  })
})
