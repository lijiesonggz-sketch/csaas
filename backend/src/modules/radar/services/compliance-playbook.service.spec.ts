import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { NotFoundException } from '@nestjs/common'
import { HttpException, HttpStatus } from '@nestjs/common'
import { CompliancePlaybookService } from './compliance-playbook.service'
import { CompliancePlaybook } from '../../../database/entities/compliance-playbook.entity'
import { ComplianceChecklistSubmission } from '../../../database/entities/compliance-checklist-submission.entity'
import { RadarPush } from '../../../database/entities/radar-push.entity'
import { SubmitChecklistDto } from '../dto/submit-checklist.dto'

/**
 * CompliancePlaybookService Tests (Story 4.2 - Phase 5.1)
 *
 * 测试合规剧本Service层
 */
describe('CompliancePlaybookService', () => {
  let service: CompliancePlaybookService
  let playbookRepo: Repository<CompliancePlaybook>
  let submissionRepo: Repository<ComplianceChecklistSubmission>
  let pushRepo: Repository<RadarPush>

  // Mock data
  const mockPlaybook: Partial<CompliancePlaybook> = {
    id: 'playbook-123',
    pushId: 'push-123',
    checklistItems: [
      {
        id: 'item-1',
        text: '检查数据安全制度',
        category: '数据安全',
        checked: false,
        order: 1,
      },
      {
        id: 'item-2',
        text: '验证数据分类分级',
        category: '数据安全',
        checked: false,
        order: 2,
      },
      {
        id: 'item-3',
        text: '检查访问控制',
        category: '数据安全',
        checked: false,
        order: 3,
      },
      {
        id: 'item-4',
        text: '验证加密算法',
        category: '数据安全',
        checked: false,
        order: 4,
      },
      {
        id: 'item-5',
        text: '审计日志检查',
        category: '数据安全',
        checked: false,
        order: 5,
      },
    ],
    solutions: [
      {
        name: '升级安全系统',
        estimatedCost: 50000,
        expectedBenefit: 200000,
        roiScore: 7,
        implementationTime: '2个月',
      },
    ],
    reportTemplate: '合规自查报告',
    policyReference: [],
    generatedAt: new Date(),
  }

  const mockPush: Partial<RadarPush> = {
    id: 'push-123',
    organizationId: 'org-123',
    radarType: 'compliance',
    contentId: 'content-123',
    status: 'sent',
    playbookStatus: 'ready',
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompliancePlaybookService,
        {
          provide: getRepositoryToken(CompliancePlaybook),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ComplianceChecklistSubmission),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(RadarPush),
          useValue: {
            findOne: jest.fn(),
            update: jest.fn(),
          },
        },
      ],
    }).compile()

    service = module.get<CompliancePlaybookService>(CompliancePlaybookService)
    playbookRepo = module.get<Repository<CompliancePlaybook>>(
      getRepositoryToken(CompliancePlaybook),
    )
    submissionRepo = module.get<Repository<ComplianceChecklistSubmission>>(
      getRepositoryToken(ComplianceChecklistSubmission),
    )
    pushRepo = module.get<Repository<RadarPush>>(getRepositoryToken(RadarPush))
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('getPlaybookByPushId', () => {
    it('should return playbook when found', async () => {
      // Arrange
      const pushId = 'push-123'
      jest.spyOn(pushRepo, 'findOne').mockResolvedValue(mockPush as any)
      jest.spyOn(playbookRepo, 'findOne').mockResolvedValue(mockPlaybook as CompliancePlaybook)

      // Act
      const result = await service.getPlaybookByPushId(pushId, 'org-123')

      // Assert
      expect(pushRepo.findOne).toHaveBeenCalledWith({
        where: { id: pushId },
        select: ['id', 'organizationId'],
      })
      expect(playbookRepo.findOne).toHaveBeenCalledWith({
        where: { pushId },
      })
      expect(result).toEqual(mockPlaybook)
    })

    it('should throw NotFoundException when playbook not found', async () => {
      // Arrange
      const pushId = 'non-existent-push'
      jest.spyOn(pushRepo, 'findOne').mockResolvedValue(mockPush as any)
      jest.spyOn(playbookRepo, 'findOne').mockResolvedValue(null)

      // Act & Assert
      await expect(service.getPlaybookByPushId(pushId, 'org-123')).rejects.toThrow(
        new NotFoundException(`Playbook not found for pushId: ${pushId}`),
      )
    })

    it('should throw HttpException with ACCEPTED status when playbook is generating', async () => {
      // Arrange
      const pushId = 'push-123'
      const generatingPush = { ...mockPush, playbookStatus: 'generating' } as any
      jest.spyOn(pushRepo, 'findOne').mockResolvedValue(generatingPush)
      jest.spyOn(playbookRepo, 'findOne').mockResolvedValue(null)

      // Act & Assert
      await expect(service.getPlaybookByPushId(pushId, 'org-123')).rejects.toThrow(
        new HttpException('Playbook is being generated', HttpStatus.ACCEPTED),
      )
    })

    it('should throw HttpException with INTERNAL_SERVER_ERROR when playbook generation failed', async () => {
      // Arrange
      const pushId = 'push-123'
      const failedPush = { ...mockPush, playbookStatus: 'failed' } as any
      jest.spyOn(pushRepo, 'findOne').mockResolvedValue(failedPush)
      jest.spyOn(playbookRepo, 'findOne').mockResolvedValue(null)

      // Act & Assert
      await expect(service.getPlaybookByPushId(pushId, 'org-123')).rejects.toThrow(
        new HttpException(
          'Playbook generation failed. Please try again later.',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      )
    })
  })

  describe('submitChecklist', () => {
    const mockSubmitDto: SubmitChecklistDto = {
      checkedItems: ['item-1', 'item-2', 'item-3'],
      uncheckedItems: ['item-4', 'item-5'],
      notes: 'Additional observations',
    }

    it('should create new checklist submission', async () => {
      // Arrange
      const pushId = 'push-123'
      const userId = 'user-123'

      const mockSubmission = {
        id: 'submission-123',
        pushId,
        userId,
        checkedItems: mockSubmitDto.checkedItems,
        uncheckedItems: mockSubmitDto.uncheckedItems,
        notes: mockSubmitDto.notes,
        submittedAt: new Date(),
        updatedAt: new Date(),
      }

      jest.spyOn(submissionRepo, 'findOne').mockResolvedValue(null)
      jest.spyOn(playbookRepo, 'findOne').mockResolvedValue(mockPlaybook as CompliancePlaybook)
      jest.spyOn(submissionRepo, 'create').mockReturnValue(mockSubmission as any)
      jest.spyOn(submissionRepo, 'save').mockResolvedValue(mockSubmission as any)
      jest.spyOn(pushRepo, 'findOne').mockResolvedValue(mockPush as RadarPush)

      // Act
      const result = await service.submitChecklist(pushId, userId, 'org-123', mockSubmitDto)

      // Assert
      expect(submissionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          pushId,
          userId,
          checkedItems: mockSubmitDto.checkedItems,
          uncheckedItems: mockSubmitDto.uncheckedItems,
          notes: mockSubmitDto.notes,
        }),
      )
      expect(submissionRepo.save).toHaveBeenCalled()
      expect(result).toEqual(
        expect.objectContaining({
          id: 'submission-123',
          pushId,
          userId,
          checkedItems: mockSubmitDto.checkedItems,
          uncheckedItems: mockSubmitDto.uncheckedItems,
          notes: mockSubmitDto.notes,
        }),
      )
    })

    it('should update existing checklist submission', async () => {
      // Arrange
      const pushId = 'push-123'
      const userId = 'user-123'

      const existingSubmission = {
        id: 'submission-123',
        pushId,
        userId,
        checkedItems: ['item-1'],
        uncheckedItems: ['item-2', 'item-3'],
        notes: 'Old notes',
        updatedAt: new Date(),
      }

      const updatedSubmission = {
        ...existingSubmission,
        checkedItems: mockSubmitDto.checkedItems,
        uncheckedItems: mockSubmitDto.uncheckedItems,
        notes: mockSubmitDto.notes,
      }

      jest.spyOn(submissionRepo, 'findOne').mockResolvedValue(existingSubmission as any)
      jest.spyOn(playbookRepo, 'findOne').mockResolvedValue(mockPlaybook as CompliancePlaybook)
      jest.spyOn(submissionRepo, 'save').mockResolvedValue(updatedSubmission as any)
      jest.spyOn(pushRepo, 'findOne').mockResolvedValue(mockPush as RadarPush)

      // Act
      const result = await service.submitChecklist(pushId, userId, 'org-123', mockSubmitDto)

      // Assert
      expect(submissionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          checkedItems: mockSubmitDto.checkedItems,
          uncheckedItems: mockSubmitDto.uncheckedItems,
          notes: mockSubmitDto.notes,
        }),
      )
      expect(result).toEqual(updatedSubmission)
    })

    it('should validate data integrity: checked + unchecked = total items', async () => {
      // Arrange
      const pushId = 'push-123'
      const userId = 'user-123'

      const invalidDto = {
        checkedItems: ['item-1', 'item-2'],
        uncheckedItems: ['item-3'], // Total 3, but playbook has 5 items
      }

      jest.spyOn(playbookRepo, 'findOne').mockResolvedValue(mockPlaybook as CompliancePlaybook)
      jest.spyOn(submissionRepo, 'findOne').mockResolvedValue(null)
      jest.spyOn(pushRepo, 'findOne').mockResolvedValue(mockPush as RadarPush)

      // Act & Assert
      await expect(service.submitChecklist(pushId, userId, 'org-123', invalidDto)).rejects.toThrow(
        HttpException,
      )
      await expect(service.submitChecklist(pushId, userId, 'org-123', invalidDto)).rejects.toThrow(
        'Missing items',
      )
    })

    it('should validate no duplicate item IDs', async () => {
      // Arrange
      const pushId = 'push-123'
      const userId = 'user-123'

      const invalidDto = {
        checkedItems: ['item-1', 'item-2'],
        uncheckedItems: ['item-2', 'item-3'], // item-2 duplicated
      }

      jest.spyOn(playbookRepo, 'findOne').mockResolvedValue(mockPlaybook as CompliancePlaybook)
      jest.spyOn(submissionRepo, 'findOne').mockResolvedValue(null)
      jest.spyOn(pushRepo, 'findOne').mockResolvedValue(mockPush as RadarPush)

      // Act & Assert
      await expect(service.submitChecklist(pushId, userId, 'org-123', invalidDto)).rejects.toThrow(
        HttpException,
      )
      await expect(service.submitChecklist(pushId, userId, 'org-123', invalidDto)).rejects.toThrow(
        'Duplicate item IDs',
      )
    })

    it('should validate item IDs exist in playbook', async () => {
      // Arrange
      const pushId = 'push-123'
      const userId = 'user-123'

      const invalidDto = {
        checkedItems: ['item-1', 'non-existent-item'],
        uncheckedItems: ['item-2'],
      }

      jest.spyOn(playbookRepo, 'findOne').mockResolvedValue(mockPlaybook as CompliancePlaybook)
      jest.spyOn(submissionRepo, 'findOne').mockResolvedValue(null)
      jest.spyOn(pushRepo, 'findOne').mockResolvedValue(mockPush as RadarPush)

      // Act & Assert
      await expect(service.submitChecklist(pushId, userId, 'org-123', invalidDto)).rejects.toThrow(
        HttpException,
      )
      await expect(service.submitChecklist(pushId, userId, 'org-123', invalidDto)).rejects.toThrow(
        'Invalid item IDs',
      )
    })

    it('should update RadarPush checklistCompletedAt when all items checked', async () => {
      // Arrange
      const pushId = 'push-123'
      const userId = 'user-123'

      const allCheckedDto = {
        checkedItems: ['item-1', 'item-2', 'item-3', 'item-4', 'item-5'],
        uncheckedItems: [],
      }

      const pushRepoSpy = jest.spyOn(pushRepo, 'findOne').mockResolvedValue(mockPush as RadarPush)
      jest.spyOn(playbookRepo, 'findOne').mockResolvedValue(mockPlaybook as CompliancePlaybook)
      jest.spyOn(submissionRepo, 'findOne').mockResolvedValue(null)
      jest.spyOn(submissionRepo, 'create').mockReturnValue({} as any)
      jest.spyOn(submissionRepo, 'save').mockResolvedValue({} as any)

      const updateSpy = jest.spyOn(pushRepo, 'update').mockResolvedValue(undefined)

      // Act
      await service.submitChecklist(pushId, userId, 'org-123', allCheckedDto)

      // Assert
      expect(updateSpy).toHaveBeenCalledWith(
        { id: pushId },
        { checklistCompletedAt: expect.any(Date) },
      )
    })
  })

  describe('getChecklistSubmission', () => {
    it('should return existing submission', async () => {
      // Arrange
      const pushId = 'push-123'
      const userId = 'user-123'

      jest.spyOn(pushRepo, 'findOne').mockResolvedValue(mockPush as any)
      const mockSubmission = {
        id: 'submission-123',
        pushId,
        userId,
        checkedItems: ['item-1'],
        uncheckedItems: ['item-2'],
        updatedAt: new Date(),
      }

      jest.spyOn(submissionRepo, 'findOne').mockResolvedValue(mockSubmission as any)

      // Act
      const result = await service.getChecklistSubmission(pushId, userId, 'org-123')

      // Assert
      expect(submissionRepo.findOne).toHaveBeenCalledWith({
        where: { pushId, userId },
      })
      expect(result).toEqual(mockSubmission)
    })

    it('should return null when submission not found', async () => {
      // Arrange
      const pushId = 'push-123'
      const userId = 'user-123'

      jest.spyOn(submissionRepo, 'findOne').mockResolvedValue(null)
      jest.spyOn(pushRepo, 'findOne').mockResolvedValue(mockPush as any)

      // Act
      const result = await service.getChecklistSubmission(pushId, userId, 'org-123')

      // Assert
      expect(result).toBeNull()
    })
  })
})
