import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Inject } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { OrganizationMember } from '../../../database/entities/organization-member.entity'

/**
 * OrganizationGuard
 *
 * Guard to verify that the current user is a member of the organization.
 * Used to prevent users from accessing other users' organizations.
 *
 * Must be used after JwtAuthGuard to ensure user is authenticated.
 *
 * @module backend/src/modules/organizations/guards
 *
 * @example
 * @UseGuards(JwtAuthGuard, OrganizationGuard)
 * @Get(':id')
 * async findOne(@Param('id') id: string, @CurrentOrg() orgId: string) {
 *   // orgId is automatically injected and validated
 * }
 */
@Injectable()
export class OrganizationGuard implements CanActivate {
  constructor(
    @InjectRepository(OrganizationMember)
    private readonly memberRepository: Repository<OrganizationMember>,
    @Inject('AuditLogService') private readonly auditLogService: any,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const user = request.user

    // Skip if no user info (e.g., public routes)
    if (!user || !user.userId) {
      return false
    }

    // Extract organizationId from multiple possible sources
    const orgId =
      request.params.id ||
      request.params.orgId ||
      request.params.organizationId ||
      request.body?.organizationId

    // If no organizationId in request, return false
    if (!orgId) {
      return false
    }

    // Check if user is a member of the organization
    const member = await this.memberRepository.findOne({
      where: {
        userId: user.userId,
        organizationId: orgId,
      },
    })

    if (!member) {
      // 记录审计日志 (Story 1.2 - AC 3)
      await this.auditLogService.log({
        userId: user.userId,
        organizationId: orgId,
        action: 'ACCESS_DENIED',
        entityType: 'Organization',
        entityId: orgId,
        success: false,
        details: {
          reason: 'user_not_member',
          attemptedAccess: 'cross_organization_access',
        },
        req: request,
      })

      throw new ForbiddenException('您不是该组织的成员,无权访问')
    }

    // Attach organizationId and member info to request for use in controller
    request.orgId = orgId
    request.orgMember = member

    return true
  }
}
