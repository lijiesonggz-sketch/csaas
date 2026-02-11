import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { EntityManager, Repository } from 'typeorm'
import { Organization } from '../../database/entities/organization.entity'
import { OrganizationMember } from '../../database/entities/organization-member.entity'

/**
 * OrganizationAutoCreateService
 *
 * Service for automatically creating organizations with transaction support.
 * Implements AC 1.1 and AC 1.2 with proper transaction handling.
 *
 * @module backend/src/modules/organizations
 */
@Injectable()
export class OrganizationAutoCreateService {
  private readonly logger = new Logger(OrganizationAutoCreateService.name)

  constructor(
    @InjectRepository(Organization)
    private readonly orgRepository: Repository<Organization>,
    @InjectRepository(OrganizationMember)
    private readonly orgMemberRepository: Repository<OrganizationMember>,
  ) {}

  /**
   * Ensure organization exists for user
   *
   * This is the main entry point for AC 1.1 and AC 1.2:
   * - AC 1.1: Auto-create organization if user doesn't have one
   * - AC 1.2: Reuse existing organization if user already has one
   *
   * @param userId - User ID
   * @param organizationName - Organization name (optional, default: "用户的组织")
   * @returns Created or existing organization
   * @throws Error if operation fails
   */
  async ensureOrganizationForProject(
    userId: string,
    organizationName?: string,
  ): Promise<Organization> {
    this.logger.log(`Ensuring organization for user: ${userId}`)

    try {
      // Step 1: Check if user already has organization
      const existingMember = await this.orgMemberRepository.findOne({
        where: { userId },
        relations: ['organization'],
      })

      let organization: Organization

      if (existingMember) {
        // AC 1.2: Reuse existing organization
        this.logger.log(
          `User ${userId} has existing organization: ${existingMember.organizationId}`,
        )
        organization = existingMember.organization
      } else {
        // AC 1.1: Create new organization
        this.logger.log(`Creating new organization for user ${userId}`)

        // Create organization with tenant_id (use default tenant for now)
        organization = this.orgRepository.create({
          name: organizationName || '用户的组织',
          tenantId: '00000000-0000-0000-0000-000000000001', // Default tenant ID
        })

        const savedOrg = await this.orgRepository.save(organization)
        this.logger.log(`Created organization: ${savedOrg.id}`)

        // Create admin membership
        const newMember = this.orgMemberRepository.create({
          organizationId: savedOrg.id,
          userId,
          role: 'admin',
        })

        await this.orgMemberRepository.save(newMember)
        this.logger.log(`Created admin membership for user: ${userId}`)

        organization = savedOrg
      }

      return organization
    } catch (error) {
      this.logger.error(
        `Failed to ensure organization for user ${userId}: ${error.message}`,
        error.stack,
      )

      // Handle specific error codes
      if (error.code === '23505') {
        // Unique violation
        throw new ConflictException(`组织创建失败：用户 ${userId} 已存在组织`)
      }

      throw error
    }
  }

  /**
   * Batch ensure organizations for multiple projects
   *
   * Useful for migrations or bulk operations
   *
   * @param projects - Array of {userId, projectId, organizationName}
   * @returns Array of organizations
   */
  async batchEnsureOrganizations(
    items: Array<{ userId: string; organizationName?: string }>,
  ): Promise<Array<{ userId: string; organization: Organization | null }>> {
    this.logger.log(`Batch ensuring organizations for ${items.length} users`)

    const results = await Promise.allSettled(
      items.map(({ userId, organizationName }) =>
        this.ensureOrganizationForProject(userId, organizationName),
      ),
    )

    const succeeded = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.filter((r) => r.status === 'rejected').length

    this.logger.log(`Batch complete: ${succeeded} succeeded, ${failed} failed`)

    if (failed > 0) {
      const errors = results
        .filter((r) => r.status === 'rejected')
        .map((r, i) => ({
          userId: items[i].userId,
          error: r.status === 'rejected' ? r.reason.message : 'Unknown',
        }))

      this.logger.error('Batch errors:', errors)
    }

    return results.map((result, index) => ({
      userId: items[index].userId,
      organization: result.status === 'fulfilled' ? result.value : null,
    }))
  }

  /**
   * Validate user has organization
   *
   * @param userId - User ID
   * @returns Organization
   * @throws NotFoundException if user has no organization
   */
  async validateUserOrganization(userId: string): Promise<Organization> {
    const member = await this.orgMemberRepository.findOne({
      where: { userId },
      relations: ['organization'],
    })

    if (!member) {
      throw new NotFoundException(`用户 ${userId} 没有组织`)
    }

    return member.organization
  }
}
