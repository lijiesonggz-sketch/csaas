import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ThrottlerModule } from '@nestjs/throttler'
import { OrganizationsService } from './organizations.service'
import { OrganizationAutoCreateService } from './organization-auto-create.service'
import { OrganizationsController } from './organizations.controller'
import { Organization } from '../../database/entities/organization.entity'
import { OrganizationMember } from '../../database/entities/organization-member.entity'
import { User } from '../../database/entities/user.entity'
import { Project } from '../../database/entities/project.entity'

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
    ]),
    ThrottlerModule.forRoot([{
      throttle: 10, // 10 requests
      ttl: 60000,   // per 60 seconds
    }]),
  ],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, OrganizationAutoCreateService],
  exports: [OrganizationsService, OrganizationAutoCreateService], // Export for use in other modules
})
export class OrganizationsModule {}
