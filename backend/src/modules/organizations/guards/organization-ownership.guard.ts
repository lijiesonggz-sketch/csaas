import { Injectable, CanActivate, ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { OrganizationMember } from '../../database/entities/organization-member.entity'

/**
 * OrganizationOwnershipGuard
 *
 * Guard to verify that the current user is a member of the organization.
 * Used to prevent users from accessing other users' organizations.
 *
 * @module backend/src/modules/organizations/guards
 */
@Injectable()
export class OrganizationOwnershipGuard implements CanActivate {
  constructor(
    @InjectRepository(OrganizationMember)
    private readonly memberRepository: Repository<OrganizationMember>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const userId = request.user?.id || request.user?.sub
    const orgId = request.params.id || request.params.orgId

    // Skip if no user info (e.g., public routes)
    if (!userId) {
      return false
    }

    // Check if user is a member of the organization
    const member = await this.memberRepository.findOne({
      where: {
        userId,
        organizationId: orgId,
      },
    })

    if (!member) {
      throw new ForbiddenException(
        `您不是该组织的成员，无权访问`,
      )
    }

    // Attach member info to request for use in controller
    request.orgMember = member

    return true
  }
}
