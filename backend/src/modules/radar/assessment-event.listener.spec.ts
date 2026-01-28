import { Test, TestingModule } from '@nestjs/testing'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AssessmentEventListener } from './assessment-event.listener'
import { WeaknessSnapshotService } from '../organizations/weakness-snapshot.service'
import { Project } from '../../database/entities/project.entity'
import { AITask } from '../../database/entities/ai-task.entity'

describe('AssessmentEventListener', () => {
  let listener: AssessmentEventListener
  let weaknessService: WeaknessSnapshotService
  let projectRepository: Repository<Project>
  let aiTaskRepository: Repository<AITask>
  let eventEmitter: EventEmitter2

  const mockProject = {
    id: 'project-123',
    organizationId: 'org-123',
  }

  const mockAITask = {
    id: 'task-123',
    projectId: 'project-123',
    type: 'questionnaire',
    project: mockProject,
  }

  const mockAssessmentResult = {
    categories: [
      { name: 'data_security', level: 1, description: 'Test weakness 1' },
      { name: 'access_control', level: 2, description: 'Test weakness 2' },
    ],
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssessmentEventListener,
        {
          provide: getRepositoryToken(Project),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(AITask),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: WeaknessSnapshotService,
          useValue: {
            createSnapshotFromAssessment: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile()

    listener = module.get<AssessmentEventListener>(AssessmentEventListener)
    weaknessService = module.get<WeaknessSnapshotService>(WeaknessSnapshotService)
    projectRepository = module.get<Repository<Project>>(getRepositoryToken(Project))
    aiTaskRepository = module.get<Repository<AITask>>(getRepositoryToken(AITask))
    eventEmitter = module.get<EventEmitter2>(EventEmitter2)
  })

  it('should be defined', () => {
    expect(listener).toBeDefined()
  })

  describe('onModuleInit', () => {
    it('should log initialization', () => {
      const loggerSpy = jest.spyOn(listener['logger'], 'log')
      listener.onModuleInit()
      expect(loggerSpy).toHaveBeenCalledWith('Assessment Event Listener initialized')
    })
  })

  describe('handleTaskCompleted - questionnaire task', () => {
    it('should trigger weakness detection for questionnaire tasks', async () => {
      // Arrange
      const payload = {
        taskId: 'task-123',
        type: 'questionnaire',
        result: {
          questionnaire: {
            categories: [
              { name: 'data_security', level: 1 },
              { name: 'governance', level: 2 },
            ],
          },
        },
      }

      jest.spyOn(aiTaskRepository, 'findOne').mockResolvedValue(mockAITask as AITask)
      jest.spyOn(projectRepository, 'findOne').mockResolvedValue(mockProject as Project)
      jest.spyOn(weaknessService, 'createSnapshotFromAssessment').mockResolvedValue([] as any)

      // Act
      await listener.handleTaskCompleted(payload)

      // Assert
      expect(projectRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'project-123' },
        select: ['id', 'organizationId'],
      })
      expect(weaknessService.createSnapshotFromAssessment).toHaveBeenCalledWith(
        'org-123',
        'project-123',
        expect.objectContaining({
          categories: expect.arrayContaining([
            expect.objectContaining({ name: 'data_security', level: 1 }),
            expect.objectContaining({ name: 'governance', level: 2 }),
          ]),
        }),
      )
    })

    it('should filter out categories with level >= 3', async () => {
      // Arrange
      const payload = {
        taskId: 'task-123',
        type: 'questionnaire',
        result: {
          questionnaire: {
            categories: [
              { name: 'data_security', level: 1 }, // weakness
              { name: 'governance', level: 3 }, // NOT weakness
              { name: 'access_control', level: 5 }, // NOT weakness
            ],
          },
        },
      }

      jest.spyOn(aiTaskRepository, 'findOne').mockResolvedValue(mockAITask as AITask)
      jest.spyOn(projectRepository, 'findOne').mockResolvedValue(mockProject as Project)
      jest.spyOn(weaknessService, 'createSnapshotFromAssessment').mockResolvedValue([] as any)

      // Act
      await listener.handleTaskCompleted(payload)

      // Assert
      expect(weaknessService.createSnapshotFromAssessment).toHaveBeenCalledWith(
        'org-123',
        'project-123',
        expect.objectContaining({
          categories: expect.arrayContaining([
            expect.objectContaining({ name: 'data_security', level: 1 }),
          ]),
        }),
      )
    })
  })

  describe('handleTaskCompleted - non-assessment tasks', () => {
    it('should ignore non-assessment task types', async () => {
      // Arrange
      const payload = {
        taskId: 'task-456',
        type: 'action_plan', // not in ASSESSMENT_TASK_TYPES
        result: {},
      }

      const createSnapshotSpy = jest.spyOn(weaknessService, 'createSnapshotFromAssessment')

      // Act
      await listener.handleTaskCompleted(payload)

      // Assert
      expect(createSnapshotSpy).not.toHaveBeenCalled()
    })
  })

  describe('handleTaskCompleted - error handling', () => {
    it('should handle missing task gracefully', async () => {
      // Arrange
      const payload = {
        taskId: 'nonexistent-task',
        type: 'questionnaire',
        result: {},
      }

      jest.spyOn(aiTaskRepository, 'findOne').mockResolvedValue(null)

      // Act & Assert - should not throw
      await expect(listener.handleTaskCompleted(payload)).resolves.toBeUndefined()
    })

    it('should handle task without project gracefully', async () => {
      // Arrange
      const payload = {
        taskId: 'task-no-project',
        type: 'questionnaire',
        result: {},
      }

      const taskWithoutProject = { ...mockAITask, projectId: null }
      jest.spyOn(aiTaskRepository, 'findOne').mockResolvedValue(taskWithoutProject as AITask)

      // Act & Assert - should not throw
      await expect(listener.handleTaskCompleted(payload)).resolves.toBeUndefined()
    })

    it('should handle project without organization gracefully', async () => {
      // Arrange
      const payload = {
        taskId: 'task-no-org',
        type: 'questionnaire',
        result: {},
      }

      const projectWithoutOrg = { ...mockProject, organizationId: null }
      jest.spyOn(aiTaskRepository, 'findOne').mockResolvedValue(mockAITask as AITask)
      jest.spyOn(projectRepository, 'findOne').mockResolvedValue(projectWithoutOrg as Project)

      // Act & Assert - should not throw
      await expect(listener.handleTaskCompleted(payload)).resolves.toBeUndefined()
    })
  })

  describe('extractAssessmentResult', () => {
    it('should extract categories from questionnaire result', () => {
      // Arrange
      const result = {
        questionnaire: {
          categories: [
            { name: 'data_security', level: 1 },
            { name: 'governance', level: 2 },
          ],
        },
      }

      // Act
      const extractionMethod = listener['extractAssessmentResult'].bind(listener)
      const extracted = extractionMethod('questionnaire', result)

      // Assert
      expect(extracted).not.toBeNull()
      expect(extracted.categories).toHaveLength(2)
      expect(extracted.categories[0]).toMatchObject({
        name: 'data_security',
        level: 1,
      })
    })

    it('should return null for null result', () => {
      // Act
      const extractionMethod = listener['extractAssessmentResult'].bind(listener)
      const extracted = extractionMethod('questionnaire', null)

      // Assert
      expect(extracted).toBeNull()
    })
  })
})
