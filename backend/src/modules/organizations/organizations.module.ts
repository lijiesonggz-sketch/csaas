import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { OrganizationsService } from './organizations.service'
import { OrganizationAutoCreateService } from './organization-auto-create.service'
import { OrganizationsController } from './organizations.controller'
import { WeaknessSnapshotService } from './weakness-snapshot.service'
import { OrganizationGuard } from './guards/organization.guard'
import { OrganizationOwnershipGuard } from './guards/organization-ownership.guard'
import { Organization } from '../../database/entities/organization.entity'
import { OrganizationProfile } from '../../database/entities/organization-profile.entity'
import { OrganizationMember } from '../../database/entities/organization-member.entity'
import { User } from '../../database/entities/user.entity'
import { Project } from '../../database/entities/project.entity'
import { WeaknessSnapshot } from '../../database/entities/weakness-snapshot.entity'
import { WatchedTopic } from '../../database/entities/watched-topic.entity'
import { WatchedPeer } from '../../database/entities/watched-peer.entity'
import { TasksGateway } from '../ai-tasks/gateways/tasks.gateway'
import { OrganizationRepository, ProjectRepository } from '../../database/repositories'

/**
 * OrganizationsModule
 *
 * Module for managing organizations and organization members.
 * Provides services and controllers for organization-level operations.
 *
 * @module backend/src/modules/organizations
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Organization,
      OrganizationProfile,
      OrganizationMember,
      User,
      Project,
      WeaknessSnapshot,
      WatchedTopic,
      WatchedPeer,
    ]),
  ],
  controllers: [OrganizationsController],
  providers: [
    OrganizationsService,
    OrganizationAutoCreateService,
    WeaknessSnapshotService,
    OrganizationGuard,
    OrganizationOwnershipGuard,
    TasksGateway,
    OrganizationRepository,
    ProjectRepository,
    {
      provide: 'AuditLogService',
      useFactory: () => ({
        log: async (params: any) => {
          // Placeholder for audit logging
          // In production, this would use the actual AuditLogService from ProjectsModule
          // For now, we log to console to avoid circular dependency
          console.log('[AuditLog]', params.action, params.entityType, params.entityId)
        },
      }),
    },
  ],
  exports: [
    OrganizationsService,
    OrganizationAutoCreateService,
    WeaknessSnapshotService,
    OrganizationGuard,
    OrganizationOwnershipGuard,
    OrganizationRepository,
    ProjectRepository,
    'AuditLogService', // Export AuditLogService for OrganizationGuard
  ], // Export for use in other modules
})
export class OrganizationsModule {}
