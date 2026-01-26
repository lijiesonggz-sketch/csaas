import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { WeaknessSnapshotService } from './weakness-snapshot.service'
import { WeaknessSnapshot } from '../../database/entities/weakness-snapshot.entity'
import { Organization } from '../../database/entities/organization.entity'
import { TasksGateway } from '../ai-tasks/gateways/tasks.gateway'
import { WeaknessCategory } from '../../constants/categories'

describe('WeaknessSnapshotService', () => {
  let service: WeaknessSnapshotService
  let repository: Repository<WeaknessSnapshot>
  let tasksGateway: TasksGateway

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
    remove: jest.fn(),
  }

  const mockTasksGateway = {
    server: {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    },
    emitTaskProgress: jest.fn(),
    emitTaskCompleted: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WeaknessSnapshotService,
        {
          provide: getRepositoryToken(WeaknessSnapshot),
          useValue: mockRepository,
        },
        {
          provide: TasksGateway,
          useValue: mockTasksGateway,
        },
      ],
    }).compile()

    service = module.get<WeaknessSnapshotService>(WeaknessSnapshotService)
    repository = module.get<Repository<WeaknessSnapshot>>(
      getRepositoryToken(WeaknessSnapshot),
    )
    tasksGateway = module.get<TasksGateway>(TasksGateway)

    jest.clearAllMocks()
  })

  describe('createSnapshotFromAssessment', () => {
    it('should create weakness snapshots for categories with level < 3', async () => {
      // Arrange
      const organizationId = 'org-123'
      const projectId = 'project-123'
      const assessmentResult = {
        categories: [
          { name: 'data_security', level: 2 }, // Weakness
          { name: 'network_security', level: 4 }, // Not weakness
          { name: 'cloud_native', level: 1 }, // Weakness
          { name: 'devsecops', level: 3 }, // Baseline, not weakness
        ],
      }

      const mockSnapshots = [
        {
          id: 'snap-1',
          organizationId,
          projectId,
          category: 'data_security',
          level: 2,
          description: '成熟度等级 2，低于行业平均水平',
        },
        {
          id: 'snap-2',
          organizationId,
          projectId,
          category: 'cloud_native',
          level: 1,
          description: '成熟度等级 1，初始阶段',
        },
      ]

      mockRepository.create.mockReturnValue(mockSnapshots[0])
      mockRepository.save.mockResolvedValue(mockSnapshots[0])

      // Act
      const result = await service.createSnapshotFromAssessment(
        organizationId,
        projectId,
        assessmentResult,
      )

      // Assert
      expect(result).toHaveLength(2)
      expect(mockRepository.create).toHaveBeenCalledTimes(2)
      expect(mockRepository.save).toHaveBeenCalledTimes(2)
      expect(tasksGateway.server.emit).toHaveBeenCalledWith(
        'weaknesses:updated',
        expect.objectContaining({
          organizationId,
          weaknesses: expect.arrayContaining([
            expect.objectContaining({
              category: 'data_security',
              level: 2,
            }),
          ]),
        }),
      )
    })

    it('should not create snapshots when all levels >= 3', async () => {
      // Arrange
      const organizationId = 'org-123'
      const projectId = 'project-123'
      const assessmentResult = {
        categories: [
          { name: 'data_security', level: 3 },
          { name: 'network_security', level: 4 },
          { name: 'devsecops', level: 5 },
        ],
      }

      // Act
      const result = await service.createSnapshotFromAssessment(
        organizationId,
        projectId,
        assessmentResult,
      )

      // Assert
      expect(result).toHaveLength(0)
      expect(mockRepository.create).not.toHaveBeenCalled()
      expect(mockRepository.save).not.toHaveBeenCalled()
    })

    it('should aggregate project IDs for existing weakness category', async () => {
      // Arrange
      const organizationId = 'org-123'
      const projectId = 'project-new'
      const assessmentResult = {
        categories: [{ name: 'data_security', level: 2 }],
      }

      const existingSnapshot = {
        id: 'snap-existing',
        organizationId,
        projectId: 'project-old',
        category: 'data_security',
        level: 2,
        projectIds: ['project-old'],
      }

      mockRepository.findOne.mockResolvedValue(existingSnapshot)
      mockRepository.save.mockResolvedValue({
        ...existingSnapshot,
        projectIds: ['project-old', 'project-new'],
      })

      // Act
      const result = await service.createSnapshotFromAssessment(
        organizationId,
        projectId,
        assessmentResult,
      )

      // Assert
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: {
          organizationId,
          category: 'data_security',
        },
      })
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          projectIds: expect.arrayContaining(['project-new']),
        }),
      )
    })
  })

  describe('getWeaknessesByOrganization', () => {
    it('should return all weakness snapshots for an organization', async () => {
      // Arrange
      const organizationId = 'org-123'
      const mockSnapshots = [
        { id: 'snap-1', organizationId, category: 'data_security', level: 2 },
        { id: 'snap-2', organizationId, category: 'cloud_native', level: 1 },
      ]

      mockRepository.find.mockResolvedValue(mockSnapshots)

      // Act
      const result = await service.getWeaknessesByOrganization(organizationId)

      // Assert
      expect(result).toEqual(mockSnapshots)
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { organizationId },
        order: { createdAt: 'DESC' },
      })
    })

    it('should return empty array when no weaknesses found', async () => {
      // Arrange
      const organizationId = 'org-empty'
      mockRepository.find.mockResolvedValue([])

      // Act
      const result = await service.getWeaknessesByOrganization(organizationId)

      // Assert
      expect(result).toEqual([])
    })
  })

  describe('getWeaknessStats', () => {
    it('should return aggregated weakness statistics', async () => {
      // Arrange
      const organizationId = 'org-123'
      mockRepository.count.mockResolvedValue(5)

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { category: 'data_security', count: 2 },
          { category: 'cloud_native', count: 1 },
        ]),
      }

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder)

      // Act
      const result = await service.getWeaknessStats(organizationId)

      // Assert
      expect(result).toEqual({
        totalWeaknesses: 5,
        topCategories: [
          { category: 'data_security', count: 2 },
          { category: 'cloud_native', count: 1 },
        ],
      })
    })
  })

  describe('deleteSnapshot', () => {
    it('should delete a snapshot by ID', async () => {
      // Arrange
      const snapshotId = 'snap-123'
      const mockSnapshot = {
        id: snapshotId,
        organizationId: 'org-123',
        category: 'data_security',
      }

      mockRepository.findOne.mockResolvedValue(mockSnapshot)
      mockRepository.remove.mockResolvedValue(mockSnapshot)

      // Act
      await service.deleteSnapshot(snapshotId)

      // Assert
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: snapshotId },
      })
      expect(mockRepository.remove).toHaveBeenCalledWith(mockSnapshot)
    })

    it('should throw error when snapshot not found', async () => {
      // Arrange
      const snapshotId = 'snap-nonexistent'
      mockRepository.findOne.mockResolvedValue(null)

      // Act & Assert
      await expect(service.deleteSnapshot(snapshotId)).rejects.toThrow(
        'Weakness snapshot not found',
      )
    })
  })
})
