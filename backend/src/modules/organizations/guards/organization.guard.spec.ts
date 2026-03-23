import { Test, TestingModule } from '@nestjs/testing'
import { ForbiddenException } from '@nestjs/common'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { OrganizationGuard } from './organization.guard'
import { OrganizationMember } from '../../../database/entities/organization-member.entity'

const ORG_ID = '550e8400-e29b-41d4-a716-446655440000'

describe('OrganizationGuard', () => {
  let guard: OrganizationGuard
  let memberRepository: Repository<OrganizationMember>
  let auditLogService: { log: jest.Mock }

  const mockMember = {
    id: 'member-123',
    userId: 'user-123',
    organizationId: ORG_ID,
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
    auditLogService = module.get('AuditLogService')
  })

  it('should be defined', () => {
    expect(guard).toBeDefined()
  })

  describe('canActivate - explicit organizationId provided', () => {
    it('should allow access when user is organization member', async () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { userId: 'user-123' },
            params: { orgId: ORG_ID },
            query: {},
            body: {},
          }),
        }),
      }

      jest.spyOn(memberRepository, 'findOne').mockResolvedValue(mockMember as OrganizationMember)

      const result = await guard.canActivate(mockContext as any)

      expect(result).toBe(true)
      expect(memberRepository.findOne).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          organizationId: ORG_ID,
        },
      })
    })

    it('should inject organizationId and membership into request', async () => {
      const mockRequest: any = {
        user: { userId: 'user-123' },
        params: { organizationId: ORG_ID },
        query: {},
        body: {},
      }
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      }

      jest.spyOn(memberRepository, 'findOne').mockResolvedValue(mockMember as OrganizationMember)

      await guard.canActivate(mockContext as any)

      expect(mockRequest.orgId).toBe(ORG_ID)
      expect(mockRequest.orgMember).toBe(mockMember)
    })

    it('should deny access when user is not organization member', async () => {
      const mockRequest: any = {
        user: { userId: 'user-123' },
        params: { orgId: ORG_ID },
        query: {},
        body: {},
      }
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      }

      jest.spyOn(memberRepository, 'findOne').mockResolvedValue(null)

      await expect(guard.canActivate(mockContext as any)).rejects.toThrow(ForbiddenException)
      expect(auditLogService.log).toHaveBeenCalled()
    })
  })

  describe('canActivate - no explicit organizationId', () => {
    it('should auto-detect organization from membership when request does not include org id', async () => {
      const mockRequest: any = {
        user: { userId: 'user-123' },
        params: {},
        query: {},
        body: {},
      }
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      }

      jest
        .spyOn(memberRepository, 'findOne')
        .mockResolvedValueOnce(mockMember as OrganizationMember)
        .mockResolvedValueOnce(mockMember as OrganizationMember)

      const result = await guard.canActivate(mockContext as any)

      expect(result).toBe(true)
      expect(memberRepository.findOne).toHaveBeenNthCalledWith(1, {
        where: { userId: 'user-123' },
      })
      expect(memberRepository.findOne).toHaveBeenNthCalledWith(2, {
        where: {
          userId: 'user-123',
          organizationId: ORG_ID,
        },
      })
      expect(mockRequest.orgId).toBe(ORG_ID)
    })

    it('should return false when no organization can be detected', async () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { userId: 'user-123' },
            params: {},
            query: {},
            body: {},
          }),
        }),
      }

      jest.spyOn(memberRepository, 'findOne').mockResolvedValue(null)

      const result = await guard.canActivate(mockContext as any)

      expect(result).toBe(false)
      expect(memberRepository.findOne).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
      })
    })

    it('should return false when user is not authenticated', async () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: null,
            params: {},
            query: {},
            body: {},
          }),
        }),
      }

      const result = await guard.canActivate(mockContext as any)

      expect(result).toBe(false)
    })
  })
})
