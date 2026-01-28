import { Test, TestingModule } from '@nestjs/testing'
import { ExecutionContext, ForbiddenException } from '@nestjs/common'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { OrganizationGuard } from './organization.guard'
import { OrganizationMember } from '../../../database/entities/organization-member.entity'

// Extended request type for testing
interface MockRequest {
  user?: any
  params?: any
  body?: any
  orgId?: string
  orgMember?: any
}

describe('OrganizationGuard', () => {
  let guard: OrganizationGuard
  let memberRepository: Repository<OrganizationMember>

  const mockMember = {
    id: 'member-123',
    userId: 'user-123',
    organizationId: 'org-123',
    role: 'admin',
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationGuard,
        {
          provide: getRepositoryToken(OrganizationMember),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: 'AuditLogService',
          useValue: {
            log: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile()

    guard = module.get<OrganizationGuard>(OrganizationGuard)
    memberRepository = module.get<Repository<OrganizationMember>>(
      getRepositoryToken(OrganizationMember),
    )
  })

  it('should be defined', () => {
    expect(guard).toBeDefined()
  })

  describe('canActivate - user is member', () => {
    it('should allow access when user is organization member', async () => {
      // Arrange
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { userId: 'user-123' },
            params: { id: 'org-123' },
          }),
        }),
      }

      jest.spyOn(memberRepository, 'findOne').mockResolvedValue(mockMember as OrganizationMember)

      // Act
      const result = await guard.canActivate(mockContext as any)

      // Assert
      expect(result).toBe(true)
      expect(memberRepository.findOne).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          organizationId: 'org-123',
        },
      })
    })

    it('should inject organizationId into request', async () => {
      // Arrange
      const mockRequest: MockRequest = {
        user: { userId: 'user-123' },
        params: { id: 'org-123' },
      }
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      }

      jest.spyOn(memberRepository, 'findOne').mockResolvedValue(mockMember as OrganizationMember)

      // Act
      await guard.canActivate(mockContext as any)

      // Assert
      expect(mockRequest.orgId).toBe('org-123')
      expect(mockRequest.orgMember).toBe(mockMember)
    })
  })

  describe('canActivate - user is NOT member', () => {
    it('should deny access when user is not organization member', async () => {
      // Arrange
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { userId: 'user-123' },
            params: { id: 'org-456' },
          }),
        }),
      }

      jest.spyOn(memberRepository, 'findOne').mockResolvedValue(null)

      // Act & Assert
      await expect(guard.canActivate(mockContext as any)).rejects.toThrow(ForbiddenException)
      await expect(guard.canActivate(mockContext as any)).rejects.toThrow(
        '您不是该组织的成员,无权访问',
      )
    })

    it('should deny access when user is not authenticated', async () => {
      // Arrange
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: null,
            params: { id: 'org-123' },
          }),
        }),
      }

      // Act
      const result = await guard.canActivate(mockContext as any)

      // Assert
      expect(result).toBe(false)
    })
  })

  describe('organizationId extraction', () => {
    it('should extract organizationId from params.id', async () => {
      // Arrange
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { userId: 'user-123' },
            params: { id: 'org-123' },
          }),
        }),
      }

      jest.spyOn(memberRepository, 'findOne').mockResolvedValue(mockMember as OrganizationMember)

      // Act
      await guard.canActivate(mockContext as any)

      // Assert
      expect(memberRepository.findOne).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          organizationId: 'org-123',
        },
      })
    })

    it('should extract organizationId from params.orgId', async () => {
      // Arrange
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { userId: 'user-123' },
            params: { orgId: 'org-123' },
          }),
        }),
      }

      jest.spyOn(memberRepository, 'findOne').mockResolvedValue(mockMember as OrganizationMember)

      // Act
      await guard.canActivate(mockContext as any)

      // Assert
      expect(memberRepository.findOne).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          organizationId: 'org-123',
        },
      })
    })

    it('should extract organizationId from params.organizationId', async () => {
      // Arrange
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { userId: 'user-123' },
            params: { organizationId: 'org-123' },
          }),
        }),
      }

      jest.spyOn(memberRepository, 'findOne').mockResolvedValue(mockMember as OrganizationMember)

      // Act
      await guard.canActivate(mockContext as any)

      // Assert
      expect(memberRepository.findOne).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          organizationId: 'org-123',
        },
      })
    })

    it('should extract organizationId from request body', async () => {
      // Arrange
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { userId: 'user-123' },
            params: {},
            body: { organizationId: 'org-123' },
          }),
        }),
      }

      jest.spyOn(memberRepository, 'findOne').mockResolvedValue(mockMember as OrganizationMember)

      // Act
      await guard.canActivate(mockContext as any)

      // Assert
      expect(memberRepository.findOne).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          organizationId: 'org-123',
        },
      })
    })

    it('should return false when no organizationId found', async () => {
      // Arrange
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { userId: 'user-123' },
            params: {},
            body: {},
          }),
        }),
      }

      // Act
      const result = await guard.canActivate(mockContext as any)

      // Assert
      expect(result).toBe(false)
      expect(memberRepository.findOne).not.toHaveBeenCalled()
    })
  })
})
