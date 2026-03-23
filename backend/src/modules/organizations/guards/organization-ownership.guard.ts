import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
  Inject,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { OrganizationMember } from '../../../database/entities/organization-member.entity'
import { AuditAction } from '../../../database/entities/audit-log.entity'

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
    @Inject('AuditLogService') private readonly auditLogService: any,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const userId = request.user?.id || request.user?.sub
    const orgId = request.params.id || request.params.orgId

    // Skip if no user info (e.g., public routes)
    if (!userId) {
      return false
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!orgId || !uuidRegex.test(orgId)) {
      throw new BadRequestException('Invalid organization id')
    }

    // Check if user is a member of the organization
    const member = await this.memberRepository.findOne({
      where: {
        userId,
        organizationId: orgId,
      },
    })

    if (!member) {
      await this.auditLogService.log({
        userId,
        organizationId: orgId,
        action: AuditAction.ACCESS_DENIED,
        entityType: 'OrganizationProfile',
        entityId: orgId,
        success: false,
        req: request,
      })
      throw new ForbiddenException(`您不是该组织的成员，无权访问`)
    }

    // Attach member info to request for use in controller
    request.orgMember = member

    return true
  }
}
