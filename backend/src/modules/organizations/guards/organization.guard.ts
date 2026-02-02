import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
} from '@nestjs/common'
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

    console.log('[OrganizationGuard] Request user:', user)

    // Skip if no user info (e.g., public routes)
    if (!user || !user.userId) {
      console.log('[OrganizationGuard] No user or userId, returning false')
      return false
    }

    // Extract organizationId from multiple possible sources
    // Priority: query/body params (explicit orgId) > route params (could be entity ID)
    let orgId =
      request.query?.organizationId ||
      request.body?.organizationId ||
      request.params.organizationId ||
      request.params.orgId ||
      request.params.id

    console.log('[OrganizationGuard] Extracted orgId:', orgId, 'from:', {
      paramsId: request.params.id,
      paramsOrgId: request.params.orgId,
      paramsOrganizationId: request.params.organizationId,
      queryOrganizationId: request.query?.organizationId,
      bodyOrganizationId: request.body?.organizationId,
    })

    // If no organizationId in request, get user's organization (MVP: user has only one org)
    if (!orgId) {
      console.log('[OrganizationGuard] No orgId in request, fetching user organization')
      const userMembership = await this.memberRepository.findOne({
        where: { userId: user.userId },
      })

      if (!userMembership) {
        console.log('[OrganizationGuard] User has no organization membership')
        return false
      }

      orgId = userMembership.organizationId
      console.log('[OrganizationGuard] Auto-detected orgId:', orgId)
    }

    // Validate UUID format to prevent database errors
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(orgId)) {
      console.log('[OrganizationGuard] Invalid UUID format:', orgId)
      return false
    }

    // Check if user is a member of the organization
    console.log('[OrganizationGuard] Checking membership for userId:', user.userId, 'orgId:', orgId)
    const member = await this.memberRepository.findOne({
      where: {
        userId: user.userId,
        organizationId: orgId,
      },
    })

    console.log('[OrganizationGuard] Member found:', member)

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

      console.log('[OrganizationGuard] Access denied - user not member')
      throw new ForbiddenException('您不是该组织的成员,无权访问')
    }

    // Attach organizationId and member info to request for use in controller
    request.orgId = orgId
    request.orgMember = member

    console.log('[OrganizationGuard] Access granted')
    return true
  }
}
