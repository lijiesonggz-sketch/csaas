import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  BadRequestException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Organization } from '../../database/entities/organization.entity'
import { OrganizationMember } from '../../database/entities/organization-member.entity'
import { User } from '../../database/entities/user.entity'
import { Project } from '../../database/entities/project.entity'
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
  OrganizationStatsDto,
  UserOrganizationResponse,
} from './dto/create-organization.dto'

/**
 * Paginated response interface
 */
export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

/**
 * Default pagination constants
 */
const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 10
const MAX_LIMIT = 100

/**
 * OrganizationsService
 *
 * Service for managing organizations and organization members.
 * Handles organization creation, user-organization relationships, and project linking.
 *
 * @module backend/src/modules/organizations
 */
@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name)

  constructor(
    @InjectRepository(Organization)
    private readonly orgRepository: Repository<Organization>,
    @InjectRepository(OrganizationMember)
    private readonly memberRepository: Repository<OrganizationMember>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
  ) {}

  /**
   * Create a new organization for a user if one doesn't exist
   *
   * This is the main auto-creation logic for AC 1.1
   *
   * @param userId - User ID to create organization for
   * @param organizationName - Organization name (optional, defaults to "用户的组织")
   * @returns Created or existing organization
   */
  async createOrganizationForUser(
    userId: string,
    organizationName?: string,
  ): Promise<Organization> {
    this.logger.log(
      `Creating organization for user: ${userId} (${organizationName || '用户的组织'})`,
    )

    // Check if user already has an organization
    const existingMember = await this.memberRepository.findOne({
      where: { userId },
      relations: ['organization'],
    })

    if (existingMember) {
      this.logger.log(
        `User ${userId} already has organization: ${existingMember.organizationId}`,
      )
      return existingMember.organization
    }

    // Create new organization with custom or default name
    const newOrg = this.orgRepository.create({
      name: organizationName || '用户的组织', // Use custom name or default
    })

    const savedOrg = await this.orgRepository.save(newOrg)
    this.logger.log(`Created organization: ${savedOrg.id}`)

    // Create admin membership for user
    const newMember = this.memberRepository.create({
      organizationId: savedOrg.id,
      userId,
      role: 'admin',
    })

    await this.memberRepository.save(newMember)
    this.logger.log(`Created admin membership for user: ${userId}`)

    return savedOrg
  }

  /**
   * Link a project to user's organization
   *
   * Used in AC 1.2 to link new projects to existing organization
   *
   * @param userId - User ID who owns the project
   * @param projectId - Project ID to link
   * @throws NotFoundException if user has no organization
   */
  async linkProjectToOrganization(
    userId: string,
    projectId: string,
  ): Promise<void> {
    this.logger.log(
      `Linking project ${projectId} to user ${userId}'s organization`,
    )

    // Find user's organization
    const member = await this.memberRepository.findOne({
      where: { userId },
    })

    if (!member) {
      this.logger.warn(`User ${userId} has no organization`)
      throw new NotFoundException(
        `User ${userId} does not have an organization`,
      )
    }

    // Update project's organizationId
    await this.projectRepository.update(
      { id: projectId },
      { organizationId: member.organizationId },
    )

    this.logger.log(
      `Linked project ${projectId} to organization ${member.organizationId}`,
    )
  }

  /**
   * Get user's organization with role
   *
   * @param userId - User ID
   * @returns User organization with role, or null if not found
   */
  async getUserOrganization(
    userId: string,
  ): Promise<UserOrganizationResponse | null> {
    const member = await this.memberRepository.findOne({
      where: { userId },
      relations: ['organization'],
    })

    if (!member) {
      return null
    }

    return {
      organization: member.organization,
      role: member.role,
    }
  }

  /**
   * Get organization by ID
   *
   * @param orgId - Organization ID
   * @returns Organization
   * @throws NotFoundException if organization not found
   */
  async getOrganizationById(orgId: string): Promise<Organization> {
    const org = await this.orgRepository.findOne({
      where: { id: orgId },
    })

    if (!org) {
      throw new NotFoundException(`Organization ${orgId} not found`)
    }

    return org
  }

  /**
   * Update organization
   *
   * @param orgId - Organization ID
   * @param updateDto - Update data
   * @returns Updated organization
   * @throws NotFoundException if organization not found
   */
  async updateOrganization(
    orgId: string,
    updateDto: UpdateOrganizationDto,
  ): Promise<Organization> {
    const org = await this.getOrganizationById(orgId)

    Object.assign(org, updateDto)
    const updated = await this.orgRepository.save(org)

    this.logger.log(`Updated organization: ${orgId}`)
    return updated
  }

  /**
   * Get organization statistics
   *
   * @param orgId - Organization ID
   * @returns Organization statistics
   */
  async getOrganizationStats(orgId: string): Promise<OrganizationStatsDto> {
    // Count members
    const memberCount = await this.memberRepository.count({
      where: { organizationId: orgId },
    })

    // Count projects
    const projectCount = await this.projectRepository.count({
      where: { organizationId: orgId },
    })

    // TODO: Count weakness snapshots when table is used
    const weaknessSnapshotCount = 0

    return {
      id: orgId,
      memberCount,
      projectCount,
      weaknessSnapshotCount,
    }
  }

  /**
   * Get all organizations for a user
   *
   * In MVP, each user has only one organization.
   * In Growth phase (Story 6.1), users can have multiple organizations.
   *
   * @param userId - User ID
   * @returns Array of organizations with roles
   */
  async getUserOrganizations(userId: string): Promise<
    Array<{ organization: Organization; role: 'admin' | 'member' }>
  > {
    // Use QueryBuilder to avoid N+1 queries
    const members = await this.memberRepository
      .createQueryBuilder('member')
      .leftJoinAndSelect('member.organization', 'org')
      .where('member.userId = :userId', { userId })
      .getMany()

    return members.map((member) => ({
      organization: member.organization,
      role: member.role,
    }))
  }

  /**
   * Add a member to an organization
   *
   * Used for inviting users to organizations (Growth phase)
   *
   * @param orgId - Organization ID
   * @param userId - User ID to add
   * @param role - Member role (admin or member)
   * @returns Created organization member
   * @throws ConflictException if user is already a member
   */
  async addMember(
    orgId: string,
    userId: string,
    role: 'admin' | 'member' = 'member',
  ): Promise<OrganizationMember> {
    // Check if user is already a member
    const existing = await this.memberRepository.findOne({
      where: { organizationId: orgId, userId },
    })

    if (existing) {
      throw new ConflictException(
        `User ${userId} is already a member of organization ${orgId}`,
      )
    }

    // Verify organization exists
    await this.getOrganizationById(orgId)

    // Verify user exists
    const user = await this.userRepository.findOne({
      where: { id: userId },
    })

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`)
    }

    // Create membership
    const newMember = this.memberRepository.create({
      organizationId: orgId,
      userId,
      role,
    })

    const saved = await this.memberRepository.save(newMember)
    this.logger.log(`Added member ${userId} to organization ${orgId} as ${role}`)

    return saved
  }

  /**
   * Remove a member from an organization
   *
   * @param orgId - Organization ID
   * @param userId - User ID to remove
   * @throws NotFoundException if membership not found
   */
  async removeMember(orgId: string, userId: string): Promise<void> {
    const member = await this.memberRepository.findOne({
      where: { organizationId: orgId, userId },
    })

    if (!member) {
      throw new NotFoundException(
        `User ${userId} is not a member of organization ${orgId}`,
      )
    }

    await this.memberRepository.remove(member)
    this.logger.log(`Removed member ${userId} from organization ${orgId}`)
  }

  /**
   * Get organization members with pagination
   *
   * @param orgId - Organization ID
   * @param page - Page number (default: 1)
   * @param limit - Items per page (default: 10)
   * @returns Paginated list of members with user details
   */
  async getOrganizationMembersPaginated(
    orgId: string,
    page: number = DEFAULT_PAGE,
    limit: number = DEFAULT_LIMIT,
  ): Promise<PaginatedResponse<OrganizationMember & { user?: User }>> {
    // Validate pagination parameters
    if (page < 1) {
      throw new BadRequestException('Page must be >= 1')
    }
    if (limit < 1 || limit > MAX_LIMIT) {
      throw new BadRequestException(`Limit must be between 1 and ${MAX_LIMIT}`)
    }

    // Calculate pagination
    const skip = (page - 1) * limit

    // Get members
    const members = await this.memberRepository.find({
      where: { organizationId: orgId },
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
    })

    // Get total count
    const total = await this.memberRepository.count({
      where: { organizationId: orgId },
    })

    // Fetch user details for each member
    const membersWithUsers = await Promise.all(
      members.map(async (member) => {
        const user = await this.userRepository.findOne({
          where: { id: member.userId },
          select: ['id', 'name', 'email'],
        })
        return { ...member, user }
      }),
    )

    // Calculate total pages
    const totalPages = Math.ceil(total / limit)

    this.logger.log(
      `Retrieved ${members.length} members for org ${orgId} (page ${page}/${totalPages})`,
    )

    return {
      data: membersWithUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    }
  }

  /**
   * Get organization projects with pagination
   *
   * @param orgId - Organization ID
   * @param page - Page number (default: 1)
   * @param limit - Items per page (default: 10)
   * @returns Paginated list of projects
   */
  async getOrganizationProjectsPaginated(
    orgId: string,
    page: number = DEFAULT_PAGE,
    limit: number = DEFAULT_LIMIT,
  ): Promise<PaginatedResponse<Project>> {
    // Validate pagination parameters
    if (page < 1) {
      throw new BadRequestException('Page must be >= 1')
    }
    if (limit < 1 || limit > MAX_LIMIT) {
      throw new BadRequestException(`Limit must be between 1 and ${MAX_LIMIT}`)
    }

    // Calculate pagination
    const skip = (page - 1) * limit

    // Get projects
    const projects = await this.projectRepository.find({
      where: { organizationId: orgId },
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
    })

    // Get total count
    const total = await this.projectRepository.count({
      where: { organizationId: orgId },
    })

    // Calculate total pages
    const totalPages = Math.ceil(total / limit)

    this.logger.log(
      `Retrieved ${projects.length} projects for org ${orgId} (page ${page}/${totalPages})`,
    )

    return {
      data: projects,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    }
  }
}
