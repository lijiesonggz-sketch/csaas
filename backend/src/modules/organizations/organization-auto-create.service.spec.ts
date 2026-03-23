import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { OrganizationAutoCreateService } from './organization-auto-create.service'
import { Organization } from '../../database/entities/organization.entity'
import { OrganizationMember } from '../../database/entities/organization-member.entity'
import { ConflictException, NotFoundException } from '@nestjs/common'

describe('OrganizationAutoCreateService', () => {
  let service: OrganizationAutoCreateService
  let orgRepository: Repository<Organization>
  let orgMemberRepository: Repository<OrganizationMember>

  const mockOrgRepository = {
    create: jest.fn(),
    save: jest.fn(),
  }

  const mockOrgMemberRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationAutoCreateService,
        {
          provide: getRepositoryToken(Organization),
          useValue: mockOrgRepository,
        },
        {
          provide: getRepositoryToken(OrganizationMember),
          useValue: mockOrgMemberRepository,
        },
      ],
    }).compile()

    service = module.get<OrganizationAutoCreateService>(OrganizationAutoCreateService)
    orgRepository = module.get<Repository<Organization>>(getRepositoryToken(Organization))
    orgMemberRepository = module.get<Repository<OrganizationMember>>(
      getRepositoryToken(OrganizationMember),
    )

    jest.clearAllMocks()
  })

  describe('ensureOrganizationForProject', () => {
    it('should create organization and admin membership when user has no organization', async () => {
      const userId = 'user-123'
      const organizationName = 'Test Organization'
      const createdOrganization = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: organizationName,
        tenantId: '00000000-0000-0000-0000-000000000001',
      } as Organization

      mockOrgMemberRepository.findOne.mockResolvedValue(null)
      mockOrgRepository.create.mockReturnValue(createdOrganization)
      mockOrgRepository.save.mockResolvedValue(createdOrganization)
      mockOrgMemberRepository.create.mockReturnValue({
        organizationId: createdOrganization.id,
        userId,
        role: 'admin',
      })
      mockOrgMemberRepository.save.mockResolvedValue({
        id: 'member-123',
        organizationId: createdOrganization.id,
        userId,
        role: 'admin',
      })

      const result = await service.ensureOrganizationForProject(userId, organizationName)

      expect(result).toEqual(createdOrganization)
      expect(mockOrgRepository.create).toHaveBeenCalledWith({
        name: organizationName,
        tenantId: '00000000-0000-0000-0000-000000000001',
      })
      expect(mockOrgMemberRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: createdOrganization.id,
          userId,
          role: 'admin',
        }),
      )
    })

    it('should reuse existing organization if user already has one', async () => {
      const userId = 'user-123'
      const existingOrganization = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Existing Organization',
      } as Organization

      mockOrgMemberRepository.findOne.mockResolvedValue({
        organizationId: existingOrganization.id,
        organization: existingOrganization,
      })

      const result = await service.ensureOrganizationForProject(userId, 'Ignored Name')

      expect(result).toBe(existingOrganization)
      expect(mockOrgRepository.create).not.toHaveBeenCalled()
      expect(mockOrgRepository.save).not.toHaveBeenCalled()
    })

    it('should throw ConflictException on unique violation', async () => {
      const error = Object.assign(new Error('duplicate'), { code: '23505' })

      mockOrgMemberRepository.findOne.mockResolvedValue(null)
      mockOrgRepository.create.mockReturnValue({})
      mockOrgRepository.save.mockRejectedValue(error)

      await expect(service.ensureOrganizationForProject('user-123')).rejects.toThrow(
        ConflictException,
      )
    })
  })

  describe('validateUserOrganization', () => {
    it('should return organization when membership exists', async () => {
      const organization = { id: '550e8400-e29b-41d4-a716-446655440002' } as Organization

      mockOrgMemberRepository.findOne.mockResolvedValue({
        organization,
      })

      const result = await service.validateUserOrganization('user-123')

      expect(result).toBe(organization)
    })

    it('should throw NotFoundException when membership does not exist', async () => {
      mockOrgMemberRepository.findOne.mockResolvedValue(null)

      await expect(service.validateUserOrganization('user-123')).rejects.toThrow(
        NotFoundException,
      )
    })
  })
})
