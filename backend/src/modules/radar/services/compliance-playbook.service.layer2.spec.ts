import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { CompliancePlaybookService } from './compliance-playbook.service'
import { CompliancePlaybook } from '../../../database/entities/compliance-playbook.entity'
import { ComplianceChecklistSubmission } from '../../../database/entities/compliance-checklist-submission.entity'
import { RadarPush } from '../../../database/entities/radar-push.entity'
import { SubmitChecklistDto } from '../dto/submit-checklist.dto'
import { ForbiddenException, NotFoundException, HttpException } from '@nestjs/common'

describe('CompliancePlaybookService - AR12 Layer 2 Defense', () => {
  let service: CompliancePlaybookService
  let playbookRepo: Repository<CompliancePlaybook>
  let submissionRepo: Repository<ComplianceChecklistSubmission>
  let pushRepo: Repository<RadarPush>

  const mockUserOrganizationId = 'org-123'
  const mockDifferentOrganizationId = 'org-456'
  const mockPushId = 'push-123'
  const mockUserId = 'user-123'

  // Mock push data
  const mockPush = {
    id: mockPushId,
    organizationId: mockUserOrganizationId,
    playbookStatus: 'ready',
  }

  // Mock playbook data
  const mockPlaybook: CompliancePlaybook = {
    id: 'playbook-123',
    pushId: mockPushId,
    organizationId: mockUserOrganizationId,
    checklistItems: [
      { id: 'item-1', text: 'Check item 1', category: 'policy', checked: false, order: 1 },
      { id: 'item-2', text: 'Check item 2', category: 'process', checked: false, order: 2 },
    ],
    solutions: [
      {
        name: 'Solution 1',
        estimatedCost: 1000,
        expectedBenefit: 5000,
        roiScore: 8,
        implementationTime: '2-3 months',
      },
    ],
    reportTemplate: 'Report template...',
    policyReference: ['policy-1', 'policy-2'],
    createdAt: new Date(),
    generatedAt: new Date(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompliancePlaybookService,
        {
          provide: getRepositoryToken(CompliancePlaybook),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ComplianceChecklistSubmission),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
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

  describe('AR12 Layer 2 Defense: validatePushAccess', () => {
    it('应该允许用户访问自己组织的push', async () => {
      // Arrange
      jest.spyOn(pushRepo, 'findOne').mockResolvedValue(mockPush as any)
      jest.spyOn(playbookRepo, 'findOne').mockResolvedValue(mockPlaybook)

      // Act & Assert - 不应该抛出异常
      await expect(
        service.getPlaybookByPushId(mockPushId, mockUserOrganizationId),
      ).resolves.toBeDefined()

      // 验证push被查询
      expect(pushRepo.findOne).toHaveBeenCalledWith({
        where: { id: mockPushId },
        select: ['id', 'organizationId'],
      })
    })

    it('应该拒绝用户访问不同组织的push (ForbiddenException)', async () => {
      // Arrange
      jest.spyOn(pushRepo, 'findOne').mockResolvedValue(mockPush as any)

      // Act & Assert
      await expect(
        service.getPlaybookByPushId(mockPushId, mockDifferentOrganizationId),
      ).rejects.toThrow(ForbiddenException)

      await expect(
        service.getPlaybookByPushId(mockPushId, mockDifferentOrganizationId),
      ).rejects.toThrow(
        `Access denied: push ${mockPushId} belongs to organization ${mockUserOrganizationId}, not ${mockDifferentOrganizationId}`,
      )
    })

    it('应该在push不存在时抛出NotFoundException', async () => {
      // Arrange
      jest.spyOn(pushRepo, 'findOne').mockResolvedValue(null)

      // Act & Assert
      await expect(
        service.getPlaybookByPushId('nonexistent-push', mockUserOrganizationId),
      ).rejects.toThrow(NotFoundException)

      await expect(
        service.getPlaybookByPushId('nonexistent-push', mockUserOrganizationId),
      ).rejects.toThrow('Push not found: nonexistent-push')
    })
  })

  describe('getPlaybookByPushId - AR12 Layer 2验证', () => {
    it('应该成功获取自己组织的剧本', async () => {
      // Arrange
      jest.spyOn(pushRepo, 'findOne').mockResolvedValue(mockPush as any)
      jest.spyOn(playbookRepo, 'findOne').mockResolvedValue(mockPlaybook)

      // Act
      const result = await service.getPlaybookByPushId(
        mockPushId,
        mockUserOrganizationId,
      )

      // Assert
      expect(result).toEqual(mockPlaybook)
      expect(pushRepo.findOne).toHaveBeenCalledWith({
        where: { id: mockPushId },
        select: ['id', 'organizationId'],
      })
      expect(playbookRepo.findOne).toHaveBeenCalledWith({
        where: { pushId: mockPushId },
      })
    })

    it('应该拒绝获取不同组织的剧本', async () => {
      // Arrange
      jest.spyOn(pushRepo, 'findOne').mockResolvedValue(mockPush as any)

      // Act & Assert
      await expect(
        service.getPlaybookByPushId(mockPushId, mockDifferentOrganizationId),
      ).rejects.toThrow(ForbiddenException)
    })
  })

  describe('submitChecklist - AR12 Layer 2验证', () => {
    const mockSubmitDto: SubmitChecklistDto = {
      checkedItems: ['item-1'],
      uncheckedItems: ['item-2'],
      notes: 'Test notes',
    }

    it('应该允许提交自己组织的checklist', async () => {
      // Arrange
      jest.spyOn(pushRepo, 'findOne').mockResolvedValue(mockPush as any)
      jest.spyOn(playbookRepo, 'findOne').mockResolvedValue(mockPlaybook)
      jest.spyOn(submissionRepo, 'findOne').mockResolvedValue(null)
      jest.spyOn(submissionRepo, 'create').mockReturnValue({
        id: 'submission-123',
        pushId: mockPushId,
        userId: mockUserId,
        checkedItems: mockSubmitDto.checkedItems,
        uncheckedItems: mockSubmitDto.uncheckedItems,
        notes: mockSubmitDto.notes,
        updatedAt: new Date(),
      } as any)
      jest.spyOn(submissionRepo, 'save').mockResolvedValue({
        id: 'submission-123',
      } as any)

      // Act
      const result = await service.submitChecklist(
        mockPushId,
        mockUserId,
        mockUserOrganizationId,
        mockSubmitDto,
      )

      // Assert
      expect(result).toBeDefined()
      expect(pushRepo.findOne).toHaveBeenCalledWith({
        where: { id: mockPushId },
        select: ['id', 'organizationId'],
      })
    })

    it('应该拒绝提交不同组织的checklist', async () => {
      // Arrange
      jest.spyOn(pushRepo, 'findOne').mockResolvedValue(mockPush as any)

      // Act & Assert
      await expect(
        service.submitChecklist(
          mockPushId,
          mockUserId,
          mockDifferentOrganizationId,
          mockSubmitDto,
        ),
      ).rejects.toThrow(ForbiddenException)
    })
  })

  describe('getChecklistSubmission - AR12 Layer 2验证', () => {
    it('应该允许获取自己组织的checklist提交记录', async () => {
      // Arrange
      const mockSubmission = {
        id: 'submission-123',
        pushId: mockPushId,
        userId: mockUserId,
        checkedItems: ['item-1'],
        uncheckedItems: ['item-2'],
        notes: 'Test notes',
        submittedAt: new Date(),
        updatedAt: new Date(),
      }

      jest.spyOn(pushRepo, 'findOne').mockResolvedValue(mockPush as any)
      jest.spyOn(submissionRepo, 'findOne').mockResolvedValue(mockSubmission as any)

      // Act
      const result = await service.getChecklistSubmission(
        mockPushId,
        mockUserId,
        mockUserOrganizationId,
      )

      // Assert
      expect(result).toEqual(mockSubmission)
      expect(pushRepo.findOne).toHaveBeenCalledWith({
        where: { id: mockPushId },
        select: ['id', 'organizationId'],
      })
    })

    it('应该拒绝获取不同组织的checklist提交记录', async () => {
      // Arrange
      jest.spyOn(pushRepo, 'findOne').mockResolvedValue(mockPush as any)

      // Act & Assert
      await expect(
        service.getChecklistSubmission(
          mockPushId,
          mockUserId,
          mockDifferentOrganizationId,
        ),
      ).rejects.toThrow(ForbiddenException)
    })

    it('应该返回null当提交记录不存在时', async () => {
      // Arrange
      jest.spyOn(pushRepo, 'findOne').mockResolvedValue(mockPush as any)
      jest.spyOn(submissionRepo, 'findOne').mockResolvedValue(null)

      // Act
      const result = await service.getChecklistSubmission(
        mockPushId,
        mockUserId,
        mockUserOrganizationId,
      )

      // Assert
      expect(result).toBeNull()
    })
  })

  describe('边缘情况和安全验证', () => {
    it('应该拒绝organizationId为null的请求', async () => {
      // Arrange
      jest.spyOn(pushRepo, 'findOne').mockResolvedValue(mockPush as any)

      // Act & Assert
      await expect(
        service.getPlaybookByPushId(mockPushId, null as any),
      ).rejects.toThrow()
    })

    it('应该拒绝organizationId为undefined的请求', async () => {
      // Arrange
      jest.spyOn(pushRepo, 'findOne').mockResolvedValue(mockPush as any)

      // Act & Assert
      await expect(
        service.getPlaybookByPushId(mockPushId, undefined as any),
      ).rejects.toThrow()
    })

    it('应该拒绝空字符串pushId', async () => {
      // Act & Assert
      await expect(
        service.getPlaybookByPushId('', mockUserOrganizationId),
      ).rejects.toThrow()
    })

    it('应该处理push.organizationId为null的情况', async () => {
      // Arrange
      const mockPushWithNullOrg = { ...mockPush, organizationId: null }
      jest.spyOn(pushRepo, 'findOne').mockResolvedValue(mockPushWithNullOrg as any)

      // Act & Assert
      await expect(
        service.getPlaybookByPushId(mockPushId, mockUserOrganizationId),
      ).rejects.toThrow(ForbiddenException)
    })
  })

  describe('性能和优化', () => {
    it('validatePushAccess应该只查询必要的字段（id和organizationId）', async () => {
      // Arrange
      jest.spyOn(pushRepo, 'findOne').mockResolvedValue(mockPush as any)
      jest.spyOn(playbookRepo, 'findOne').mockResolvedValue(mockPlaybook)

      // Act
      await service.getPlaybookByPushId(mockPushId, mockUserOrganizationId)

      // Assert
      expect(pushRepo.findOne).toHaveBeenCalledWith({
        where: { id: mockPushId },
        select: ['id', 'organizationId'], // 只选择必要的字段
      })
    })

    it('应该在一次查询中同时验证组织和获取数据', async () => {
      // Arrange
      jest.spyOn(pushRepo, 'findOne').mockResolvedValue(mockPush as any)
      jest.spyOn(playbookRepo, 'findOne').mockResolvedValue(mockPlaybook)

      // Act
      await service.getPlaybookByPushId(mockPushId, mockUserOrganizationId)

      // Assert
      // 验证只调用了2次查询（1次验证组织，1次获取playbook）
      expect(pushRepo.findOne).toHaveBeenCalledTimes(1)
      expect(playbookRepo.findOne).toHaveBeenCalledTimes(1)
    })
  })
})
