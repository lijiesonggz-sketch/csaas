import { Test, TestingModule } from '@nestjs/testing'
import { BadRequestException, ForbiddenException } from '@nestjs/common'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { OrganizationOwnershipGuard } from './organization-ownership.guard'
import { OrganizationMember } from '../../../database/entities/organization-member.entity'
import { AuditAction } from '../../../database/entities/audit-log.entity'

const ORG_ID = '550e8400-e29b-41d4-a716-446655440000'

describe('OrganizationOwnershipGuard', () => {
  let guard: OrganizationOwnershipGuard
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
        OrganizationOwnershipGuard,
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

    guard = module.get<OrganizationOwnershipGuard>(OrganizationOwnershipGuard)
    memberRepository = module.get<Repository<OrganizationMember>>(
      getRepositoryToken(OrganizationMember),
    )
    auditLogService = module.get('AuditLogService')
  })

  it('should allow access when user belongs to the organization', async () => {
    const mockRequest: any = {
      user: { id: 'user-123' },
      params: { id: ORG_ID },
    }
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    }

    jest.spyOn(memberRepository, 'findOne').mockResolvedValue(mockMember as OrganizationMember)

    const result = await guard.canActivate(mockContext as any)

    expect(result).toBe(true)
    expect(mockRequest.orgMember).toBe(mockMember)
  })

  it('should reject invalid organization ids before querying the database', async () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'user-123' },
          params: { id: 'not-a-uuid' },
        }),
      }),
    }

    await expect(guard.canActivate(mockContext as any)).rejects.toThrow(BadRequestException)
    expect(memberRepository.findOne).not.toHaveBeenCalled()
  })

  it('should audit and reject non-members', async () => {
    const mockRequest: any = {
      user: { id: 'user-123' },
      params: { id: ORG_ID },
    }
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    }

    jest.spyOn(memberRepository, 'findOne').mockResolvedValue(null)

    await expect(guard.canActivate(mockContext as any)).rejects.toThrow(ForbiddenException)
    expect(auditLogService.log).toHaveBeenCalledWith({
      userId: 'user-123',
      organizationId: ORG_ID,
      action: AuditAction.ACCESS_DENIED,
      entityType: 'OrganizationProfile',
      entityId: ORG_ID,
      success: false,
      req: mockRequest,
    })
  })
})
