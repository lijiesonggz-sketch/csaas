import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { OrganizationsService } from './organizations.service'
import { OrganizationAutoCreateService } from './organization-auto-create.service'
import { OrganizationsController } from './organizations.controller'
import { WeaknessSnapshotService } from './weakness-snapshot.service'
import { Organization } from '../../database/entities/organization.entity'
import { OrganizationMember } from '../../database/entities/organization-member.entity'
import { User } from '../../database/entities/user.entity'
import { Project } from '../../database/entities/project.entity'
import { WeaknessSnapshot } from '../../database/entities/weakness-snapshot.entity'
import { WatchedTopic } from '../../database/entities/watched-topic.entity'
import { WatchedPeer } from '../../database/entities/watched-peer.entity'
import { TasksGateway } from '../ai-tasks/gateways/tasks.gateway'

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
    TasksGateway,
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
  exports: [OrganizationsService, OrganizationAutoCreateService, WeaknessSnapshotService], // Export for use in other modules
})
export class OrganizationsModule {}
