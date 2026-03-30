import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { AIGenerationResult, AITask, ControlPoint, Project, SurveyResponse } from '../../database/entities'
import { OrganizationQuestionSetService } from '../applicability-engine/services/organization-question-set.service'
import { ProjectMembersService } from '../projects/services/project-members.service'
import { ProjectQuestionnaireSnapshotService } from './project-questionnaire-snapshot.service'

const PROJECT_ID = '550e8400-e29b-41d4-a716-446655440320'
const ORG_ID = '660e8400-e29b-41d4-a716-446655440320'
const USER_ID = '880e8400-e29b-41d4-a716-446655440320'

describe('ProjectQuestionnaireSnapshotService', () => {
  let service: ProjectQuestionnaireSnapshotService

  const projectRepository = {
    findOne: jest.fn(),
  }
  const surveyResponseRepository = {
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
  const projectMembersService = {
    checkPermission: jest.fn(),
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
          provide: getRepositoryToken(SurveyResponse),
          useValue: surveyResponseRepository,
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
        {
          provide: ProjectMembersService,
          useValue: projectMembersService,
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
      lifecycleStatus: 'published',
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
            lifecycleStatus: 'published',
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
            question_template_id: 'question-yes-no',
            source_question_id: 'question-yes-no',
            control_id: 'control-a',
            cluster_id: 'control-a',
            cluster_name: '特权账号控制',
            question_text: '机构是否建立特权账号定期复核机制？',
            question_type: 'SINGLE_CHOICE',
            options: [
              { option_id: 'A', text: 'yes', score: 5 },
              { option_id: 'B', text: 'not_yes', score: 0 },
            ],
            required: true,
            guidance: '此题为必答题，请选择最符合当前控制现状的选项。',
            display_order: 1,
            scoring_rule: null,
            is_project_custom: false,
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
          lifecycleStatus: 'published',
          editVersion: 0,
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
      lifecycleStatus: 'published',
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
    aiGenerationResultRepository.findOne.mockResolvedValue({
      selectedResult: {
        questionnaire: [
          {
            question_id: 'Q-ACC-001',
            question_template_id: 'question-yes-no',
            source_question_id: 'question-yes-no',
            control_id: 'control-a',
            cluster_id: 'control-a',
            cluster_name: '特权账号控制',
            question_text: '机构是否建立特权账号定期复核机制？',
            question_type: 'SINGLE_CHOICE',
            options: [
              { option_id: 'A', text: 'yes', score: 5 },
              { option_id: 'B', text: 'not_yes', score: 0 },
            ],
            required: true,
            guidance: '此题为必答题，请选择最符合当前控制现状的选项。',
            display_order: 1,
            scoring_rule: null,
            is_project_custom: false,
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
          snapshotKind: 'kg_dynamic_questionnaire',
          total_questions: 1,
          estimated_time_minutes: 1,
          coverage_map: { 'control-a': 1 },
          lifecycleStatus: 'published',
        },
      },
    })
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

  it('should create a draft snapshot when saving edited questionnaire content', async () => {
    projectRepository.findOne.mockResolvedValue({
      id: PROJECT_ID,
      organizationId: ORG_ID,
    })
    projectMembersService.checkPermission.mockResolvedValue(true)
    aiTaskRepository.find.mockResolvedValue([
      {
        id: 'published-task-id',
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
            question_template_id: 'question-yes-no',
            source_question_id: 'question-yes-no',
            control_id: 'control-a',
            cluster_id: 'control-a',
            cluster_name: '特权账号控制',
            question_text: '机构是否建立特权账号定期复核机制？',
            question_type: 'SINGLE_CHOICE',
            options: [
              { option_id: 'A', text: 'yes', score: 5 },
              { option_id: 'B', text: 'not_yes', score: 0 },
            ],
            required: true,
            guidance: '此题为必答题，请选择最符合当前控制现状的选项。',
            display_order: 1,
            scoring_rule: {
              passValues: ['yes'],
            },
            is_project_custom: false,
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
          snapshotKind: 'kg_dynamic_questionnaire',
          total_questions: 1,
          estimated_time_minutes: 1,
          coverage_map: { 'control-a': 1 },
          lifecycleStatus: 'published',
          publishedSnapshotTaskId: 'published-task-id',
          editVersion: 0,
        },
      },
    })
    controlPointRepository.find.mockResolvedValue([
      {
        controlId: 'control-a',
        controlCode: 'CTRL-ACC-002',
        controlName: '特权账号控制',
      },
    ])

    const snapshot = await service.saveDraft(
      PROJECT_ID,
      {
        questions: [
          {
            questionId: 'Q-ACC-001',
            questionTemplateId: 'question-yes-no',
            controlId: 'control-a',
            questionType: 'SINGLE_CHOICE',
            questionText: '项目层是否建立特权账号季度复核机制？',
            options: [
              { optionId: 'A', text: '已建立', score: 5 },
              { optionId: 'B', text: '未建立', score: 0 },
            ],
            scoringRule: {
              passValues: ['A'],
            },
            required: true,
            displayOrder: 1,
          },
        ],
      },
      ORG_ID,
      USER_ID,
    )

    expect(projectMembersService.checkPermission).toHaveBeenCalledWith(
      PROJECT_ID,
      USER_ID,
      expect.arrayContaining(['OWNER', 'EDITOR']),
    )
    expect(snapshot).toMatchObject({
      questionnaireTaskId: 'snapshot-task-id',
      snapshotVersion: 2,
      lifecycleStatus: 'draft',
      publishedSnapshotTaskId: 'published-task-id',
      baseSnapshotTaskId: 'published-task-id',
      editVersion: 1,
      reusedExisting: false,
    })
    expect(snapshot.questions).toEqual([
      expect.objectContaining({
        question_id: 'Q-ACC-001',
        question_text: '项目层是否建立特权账号季度复核机制？',
        control_id: 'control-a',
        question_type: 'SINGLE_CHOICE',
      }),
    ])
  })

  it('should reject edits that attempt to change immutable question bindings', async () => {
    projectRepository.findOne.mockResolvedValue({
      id: PROJECT_ID,
      organizationId: ORG_ID,
    })
    projectMembersService.checkPermission.mockResolvedValue(true)
    aiTaskRepository.find.mockResolvedValue([
      {
        id: 'published-task-id',
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
            question_template_id: 'question-yes-no',
            source_question_id: 'question-yes-no',
            control_id: 'control-a',
            cluster_id: 'control-a',
            cluster_name: '特权账号控制',
            question_text: '机构是否建立特权账号定期复核机制？',
            question_type: 'SINGLE_CHOICE',
            options: [
              { option_id: 'A', text: 'yes', score: 5 },
              { option_id: 'B', text: 'not_yes', score: 0 },
            ],
            required: true,
            guidance: '此题为必答题，请选择最符合当前控制现状的选项。',
            display_order: 1,
            scoring_rule: null,
            is_project_custom: false,
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
          snapshotKind: 'kg_dynamic_questionnaire',
          total_questions: 1,
          estimated_time_minutes: 1,
          coverage_map: { 'control-a': 1 },
          lifecycleStatus: 'published',
        },
      },
    })
    controlPointRepository.find.mockResolvedValue([
      {
        controlId: 'control-b',
        controlCode: 'CTRL-DATA-011',
        controlName: '跨境数据治理',
      },
    ])

    await expect(
      service.saveDraft(
        PROJECT_ID,
        {
          questions: [
            {
              questionId: 'Q-ACC-001',
              questionTemplateId: 'question-yes-no',
              controlId: 'control-b',
              questionType: 'SINGLE_CHOICE',
              questionText: '项目层是否建立特权账号季度复核机制？',
              options: [
                { optionId: 'A', text: '已建立', score: 5 },
                { optionId: 'B', text: '未建立', score: 0 },
              ],
              scoringRule: null,
              required: true,
              displayOrder: 1,
            },
          ],
        },
        ORG_ID,
        USER_ID,
      ),
    ).rejects.toThrow('cannot change controlId')
  })

  it('should support add, delete, and reorder operations within a saved draft payload', async () => {
    projectRepository.findOne.mockResolvedValue({
      id: PROJECT_ID,
      organizationId: ORG_ID,
    })
    projectMembersService.checkPermission.mockResolvedValue(true)
    aiTaskRepository.find.mockResolvedValue([
      {
        id: 'published-task-id',
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
            question_template_id: 'question-yes-no',
            source_question_id: 'question-yes-no',
            control_id: 'control-a',
            cluster_id: 'control-a',
            cluster_name: '特权账号控制',
            question_text: '机构是否建立特权账号定期复核机制？',
            question_type: 'SINGLE_CHOICE',
            options: [
              { option_id: 'A', text: 'yes', score: 5 },
              { option_id: 'B', text: 'not_yes', score: 0 },
            ],
            required: true,
            guidance: '此题为必答题，请选择最符合当前控制现状的选项。',
            display_order: 1,
            scoring_rule: null,
            is_project_custom: false,
          },
          {
            question_id: 'Q-DATA-001',
            question_template_id: 'question-single-choice',
            source_question_id: 'question-single-choice',
            control_id: 'control-b',
            cluster_id: 'control-b',
            cluster_name: '跨境数据治理',
            question_text: '机构是否建立跨境数据审批控制？',
            question_type: 'SINGLE_CHOICE',
            options: [
              { option_id: 'A', text: '未建立', score: 1 },
              { option_id: 'B', text: '已建立', score: 5 },
            ],
            required: false,
            guidance: '请根据项目当前实际情况填写。',
            display_order: 2,
            scoring_rule: null,
            is_project_custom: false,
          },
        ],
        questionnaire_metadata: {
          projectId: PROJECT_ID,
          organizationId: ORG_ID,
          generatedAt: '2026-03-25T16:00:00.000Z',
          snapshotVersion: 1,
          resolvedControlSetVersion: 'resolved-controls@2026-03-25T16:00:00.000Z',
          questionSetVersion: 'question-set@2026-03-25T16:00:00.000Z',
          sourceControlIds: ['control-a', 'control-b'],
          missingQuestionControlIds: [],
          snapshotKind: 'kg_dynamic_questionnaire',
          total_questions: 2,
          estimated_time_minutes: 1,
          coverage_map: { 'control-a': 1, 'control-b': 1 },
          lifecycleStatus: 'published',
          publishedSnapshotTaskId: 'published-task-id',
          editVersion: 0,
        },
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

    const snapshot = await service.saveDraft(
      PROJECT_ID,
      {
        questions: [
          {
            controlId: 'control-b',
            questionType: 'SINGLE_CHOICE',
            questionText: '项目层是否建立跨境数据审批例外审批台账？',
            options: [
              { optionId: 'A', text: '已建立', score: 5 },
              { optionId: 'B', text: '未建立', score: 0 },
            ],
            scoringRule: null,
            required: true,
            displayOrder: 1,
          },
          {
            questionId: 'Q-ACC-001',
            questionTemplateId: 'question-yes-no',
            controlId: 'control-a',
            questionType: 'SINGLE_CHOICE',
            questionText: '项目层是否建立特权账号季度复核机制？',
            options: [
              { optionId: 'A', text: '已建立', score: 5 },
              { optionId: 'B', text: '未建立', score: 0 },
            ],
            scoringRule: null,
            required: true,
            displayOrder: 2,
          },
        ],
      },
      ORG_ID,
      USER_ID,
    )

    expect(snapshot.questions).toHaveLength(2)
    expect(snapshot.questions[0]).toEqual(
      expect.objectContaining({
        question_id: expect.stringMatching(/^project-custom-/),
        control_id: 'control-b',
        display_order: 1,
        is_project_custom: true,
      }),
    )
    expect(snapshot.questions[1]).toEqual(
      expect.objectContaining({
        question_id: 'Q-ACC-001',
        display_order: 2,
      }),
    )
    expect(snapshot.questions).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ question_id: 'Q-DATA-001' })]),
    )
  })

  it('should publish the latest draft snapshot and supersede the previous published snapshot', async () => {
    projectRepository.findOne.mockResolvedValue({
      id: PROJECT_ID,
      organizationId: ORG_ID,
    })
    projectMembersService.checkPermission.mockResolvedValue(true)
    aiTaskRepository.find.mockResolvedValue([
      {
        id: 'draft-task-id',
        projectId: PROJECT_ID,
        input: {
          snapshotKind: 'kg_dynamic_questionnaire',
          snapshotVersion: 2,
        },
        createdAt: new Date('2026-03-31T08:30:00.000Z'),
      },
      {
        id: 'published-task-id',
        projectId: PROJECT_ID,
        input: {
          snapshotKind: 'kg_dynamic_questionnaire',
          snapshotVersion: 1,
        },
        createdAt: new Date('2026-03-25T16:00:00.000Z'),
      },
    ])
    aiGenerationResultRepository.findOne.mockImplementation(async ({ where: { taskId } }: any) => {
      if (taskId === 'draft-task-id') {
        return {
          taskId: 'draft-task-id',
          selectedResult: {
            questionnaire: [
              {
                question_id: 'Q-ACC-001',
                question_template_id: 'question-yes-no',
                source_question_id: 'question-yes-no',
                control_id: 'control-a',
                cluster_id: 'control-a',
                cluster_name: '特权账号控制',
                question_text: '项目层是否建立特权账号季度复核机制？',
                question_type: 'SINGLE_CHOICE',
                options: [
                  { option_id: 'A', text: '已建立', score: 5 },
                  { option_id: 'B', text: '未建立', score: 0 },
                ],
                required: true,
                guidance: '此题为必答题，请选择最符合当前控制现状的选项。',
                display_order: 1,
                scoring_rule: { passValues: ['A'] },
                is_project_custom: false,
              },
            ],
            questionnaire_metadata: {
              projectId: PROJECT_ID,
              organizationId: ORG_ID,
              generatedAt: '2026-03-31T08:30:00.000Z',
              snapshotVersion: 2,
              resolvedControlSetVersion: 'resolved-controls@2026-03-25T16:00:00.000Z',
              questionSetVersion: 'question-set@2026-03-25T16:00:00.000Z',
              sourceControlIds: ['control-a'],
              missingQuestionControlIds: [],
              snapshotKind: 'kg_dynamic_questionnaire',
              total_questions: 1,
              estimated_time_minutes: 1,
              coverage_map: { 'control-a': 1 },
              lifecycleStatus: 'draft',
              publishedSnapshotTaskId: 'published-task-id',
              baseSnapshotTaskId: 'published-task-id',
              editVersion: 1,
              lastEditedAt: '2026-03-31T08:30:00.000Z',
              lastEditedBy: USER_ID,
            },
          },
        }
      }

      return {
        taskId: 'published-task-id',
        selectedResult: {
          questionnaire: [
            {
              question_id: 'Q-ACC-001',
              question_template_id: 'question-yes-no',
              source_question_id: 'question-yes-no',
              control_id: 'control-a',
              cluster_id: 'control-a',
              cluster_name: '特权账号控制',
              question_text: '机构是否建立特权账号定期复核机制？',
              question_type: 'SINGLE_CHOICE',
              options: [
                { option_id: 'A', text: 'yes', score: 5 },
                { option_id: 'B', text: 'not_yes', score: 0 },
              ],
              required: true,
              guidance: '此题为必答题，请选择最符合当前控制现状的选项。',
              display_order: 1,
              scoring_rule: null,
              is_project_custom: false,
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
            snapshotKind: 'kg_dynamic_questionnaire',
            total_questions: 1,
            estimated_time_minutes: 1,
            coverage_map: { 'control-a': 1 },
            lifecycleStatus: 'published',
            publishedSnapshotTaskId: 'published-task-id',
            editVersion: 0,
          },
        },
      }
    })

    const snapshot = await service.publishDraft(PROJECT_ID, ORG_ID, USER_ID)

    expect(snapshot).toMatchObject({
      questionnaireTaskId: 'draft-task-id',
      lifecycleStatus: 'published',
      publishedSnapshotTaskId: 'draft-task-id',
    })
    expect(aiTaskRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'draft-task-id',
        input: expect.objectContaining({
          lifecycleStatus: 'published',
          publishedSnapshotTaskId: 'draft-task-id',
        }),
      }),
    )
    expect(aiTaskRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'published-task-id',
        input: expect.objectContaining({
          lifecycleStatus: 'superseded',
          publishedSnapshotTaskId: 'draft-task-id',
        }),
      }),
    )
  })

  it('should reject publish when no draft snapshot exists', async () => {
    projectRepository.findOne.mockResolvedValue({
      id: PROJECT_ID,
      organizationId: ORG_ID,
    })
    projectMembersService.checkPermission.mockResolvedValue(true)
    aiTaskRepository.find.mockResolvedValue([
      {
        id: 'published-task-id',
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
            question_template_id: 'question-yes-no',
            source_question_id: 'question-yes-no',
            control_id: 'control-a',
            cluster_id: 'control-a',
            cluster_name: '特权账号控制',
            question_text: '机构是否建立特权账号定期复核机制？',
            question_type: 'SINGLE_CHOICE',
            options: [
              { option_id: 'A', text: 'yes', score: 5 },
              { option_id: 'B', text: 'not_yes', score: 0 },
            ],
            required: true,
            guidance: '此题为必答题，请选择最符合当前控制现状的选项。',
            display_order: 1,
            scoring_rule: null,
            is_project_custom: false,
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
          snapshotKind: 'kg_dynamic_questionnaire',
          total_questions: 1,
          estimated_time_minutes: 1,
          coverage_map: { 'control-a': 1 },
          lifecycleStatus: 'published',
          publishedSnapshotTaskId: 'published-task-id',
        },
      },
    })

    await expect(service.publishDraft(PROJECT_ID, ORG_ID, USER_ID)).rejects.toThrow(
      'Questionnaire draft not found',
    )
  })

  it('should preview publish impact before republishing a questionnaire draft', async () => {
    projectRepository.findOne.mockResolvedValue({
      id: PROJECT_ID,
      organizationId: ORG_ID,
    })
    projectMembersService.checkPermission.mockResolvedValue(true)
    aiTaskRepository.find.mockResolvedValue([
      {
        id: 'draft-task-id',
        projectId: PROJECT_ID,
        input: {
          snapshotKind: 'kg_dynamic_questionnaire',
          snapshotVersion: 2,
        },
        createdAt: new Date('2026-03-31T08:30:00.000Z'),
      },
      {
        id: 'published-task-id',
        projectId: PROJECT_ID,
        input: {
          snapshotKind: 'kg_dynamic_questionnaire',
          snapshotVersion: 1,
        },
        createdAt: new Date('2026-03-25T16:00:00.000Z'),
      },
    ])
    aiGenerationResultRepository.findOne.mockImplementation(async ({ where: { taskId } }: any) => {
      if (taskId === 'draft-task-id') {
        return {
          selectedResult: {
            questionnaire: [
              {
                question_id: 'Q-ACC-001',
                question_template_id: 'question-yes-no',
                source_question_id: 'question-yes-no',
                control_id: 'control-a',
                cluster_id: 'control-a',
                cluster_name: '特权账号控制',
                question_text: '项目层是否建立特权账号季度复核机制？',
                question_type: 'SINGLE_CHOICE',
                options: [
                  { option_id: 'A', text: '已建立', score: 5 },
                  { option_id: 'B', text: '未建立', score: 0 },
                ],
                required: true,
                guidance: '此题为必答题，请选择最符合当前控制现状的选项。',
                display_order: 1,
                scoring_rule: null,
                is_project_custom: false,
              },
              {
                question_id: 'project-custom-1',
                question_template_id: null,
                source_question_id: null,
                control_id: 'control-b',
                cluster_id: 'control-b',
                cluster_name: '跨境数据治理',
                question_text: '项目层是否建立跨境数据审批例外审批台账？',
                question_type: 'SINGLE_CHOICE',
                options: [
                  { option_id: 'A', text: '已建立', score: 5 },
                  { option_id: 'B', text: '未建立', score: 0 },
                ],
                required: true,
                guidance: '此题为必答题，请选择最符合当前控制现状的选项。',
                display_order: 2,
                scoring_rule: null,
                is_project_custom: true,
              },
            ],
            questionnaire_metadata: {
              projectId: PROJECT_ID,
              organizationId: ORG_ID,
              generatedAt: '2026-03-31T08:30:00.000Z',
              snapshotVersion: 2,
              resolvedControlSetVersion: 'resolved-controls@2026-03-25T16:00:00.000Z',
              questionSetVersion: 'question-set@2026-03-25T16:00:00.000Z',
              sourceControlIds: ['control-a', 'control-b'],
              missingQuestionControlIds: [],
              snapshotKind: 'kg_dynamic_questionnaire',
              total_questions: 2,
              estimated_time_minutes: 1,
              coverage_map: { 'control-a': 1, 'control-b': 1 },
              lifecycleStatus: 'draft',
              publishedSnapshotTaskId: 'published-task-id',
              baseSnapshotTaskId: 'published-task-id',
              editVersion: 1,
              lastEditedAt: '2026-03-31T08:30:00.000Z',
              lastEditedBy: USER_ID,
            },
          },
        }
      }

      return {
        selectedResult: {
          questionnaire: [
            {
              question_id: 'Q-ACC-001',
              question_template_id: 'question-yes-no',
              source_question_id: 'question-yes-no',
              control_id: 'control-a',
              cluster_id: 'control-a',
              cluster_name: '特权账号控制',
              question_text: '机构是否建立特权账号定期复核机制？',
              question_type: 'SINGLE_CHOICE',
              options: [
                { option_id: 'A', text: 'yes', score: 5 },
                { option_id: 'B', text: 'not_yes', score: 0 },
              ],
              required: true,
              guidance: '此题为必答题，请选择最符合当前控制现状的选项。',
              display_order: 1,
              scoring_rule: null,
              is_project_custom: false,
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
            snapshotKind: 'kg_dynamic_questionnaire',
            total_questions: 1,
            estimated_time_minutes: 1,
            coverage_map: { 'control-a': 1 },
            lifecycleStatus: 'published',
            publishedSnapshotTaskId: 'published-task-id',
          },
        },
      }
    })

    const impact = await service.previewPublishImpact(PROJECT_ID, ORG_ID, USER_ID)

    expect(impact).toMatchObject({
      projectId: PROJECT_ID,
      questionnaireTaskId: 'draft-task-id',
      publishedSnapshotTaskId: 'published-task-id',
      requiresDownstreamRefresh: true,
      staleTargets: ['gap-analysis', 'action-plan', 'report'],
    })
    expect(impact.changeTypes).toEqual(expect.arrayContaining(['question_added', 'question_text']))
  })

  it('should mark downstream survey responses as stale after an impactful republish', async () => {
    surveyResponseRepository.findOne.mockResolvedValue({
      id: 'survey-response-id',
      questionnaireTaskId: 'published-task-id',
      questionnaireTask: {
        projectId: PROJECT_ID,
      },
    })
    projectRepository.findOne.mockResolvedValue({
      id: PROJECT_ID,
      organizationId: ORG_ID,
    })
    aiTaskRepository.find.mockResolvedValue([
      {
        id: 'draft-task-id',
        projectId: PROJECT_ID,
        input: {
          snapshotKind: 'kg_dynamic_questionnaire',
          snapshotVersion: 2,
        },
        createdAt: new Date('2026-03-31T08:30:00.000Z'),
      },
    ])
    aiGenerationResultRepository.findOne.mockResolvedValue({
      selectedResult: {
        questionnaire: [
          {
            question_id: 'Q-ACC-001',
            question_template_id: 'question-yes-no',
            source_question_id: 'question-yes-no',
            control_id: 'control-a',
            cluster_id: 'control-a',
            cluster_name: '特权账号控制',
            question_text: '项目层是否建立特权账号季度复核机制？',
            question_type: 'SINGLE_CHOICE',
            options: [
              { option_id: 'A', text: '已建立', score: 5 },
              { option_id: 'B', text: '未建立', score: 0 },
            ],
            required: true,
            guidance: '此题为必答题，请选择最符合当前控制现状的选项。',
            display_order: 1,
            scoring_rule: null,
            is_project_custom: false,
          },
        ],
        questionnaire_metadata: {
          projectId: PROJECT_ID,
          organizationId: ORG_ID,
          generatedAt: '2026-03-31T08:35:00.000Z',
          snapshotVersion: 2,
          resolvedControlSetVersion: 'resolved-controls@2026-03-25T16:00:00.000Z',
          questionSetVersion: 'question-set@2026-03-25T16:00:00.000Z',
          sourceControlIds: ['control-a'],
          missingQuestionControlIds: [],
          snapshotKind: 'kg_dynamic_questionnaire',
          total_questions: 1,
          estimated_time_minutes: 1,
          coverage_map: { 'control-a': 1 },
          lifecycleStatus: 'published',
          publishedSnapshotTaskId: 'draft-task-id',
          lastPublishedImpact: {
            requiresDownstreamRefresh: true,
            staleTargets: ['gap-analysis', 'action-plan', 'report'],
            changeTypes: ['question_added'],
            message: '现有差距分析、行动计划和报告需重新生成。',
          },
        },
      },
    })

    const freshness = await service.evaluateDownstreamFreshnessForSurveyResponse(
      'survey-response-id',
      ORG_ID,
    )

    expect(freshness).toMatchObject({
      surveyResponseId: 'survey-response-id',
      questionnaireTaskId: 'published-task-id',
      latestPublishedSnapshotTaskId: 'draft-task-id',
      isStale: true,
      staleTargets: ['gap-analysis', 'action-plan', 'report'],
    })
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
