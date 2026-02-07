import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { HttpModule } from '@nestjs/axios'
import { ScheduleModule } from '@nestjs/schedule'
import { AdminClientsController } from './clients/admin-clients.controller'
import { AdminClientsService } from './clients/admin-clients.service'
import { AdminClientGroupsController } from './clients/admin-client-groups.controller'
import { AdminBrandingController, PublicBrandingController } from './branding/admin-branding.controller'
import { AdminBrandingService } from './branding/admin-branding.service'
import { FileUploadService } from './branding/file-upload.service'
import { EmailTemplateService } from './branding/email-template.service'
import { CsvParserService } from './clients/csv-parser.service'
import { EmailService } from './clients/email.service'
import { DashboardController } from './dashboard/dashboard.controller'
import { DashboardService } from './dashboard/dashboard.service'
import { AlertService } from './dashboard/alert.service'
import { HealthMonitorService } from './dashboard/health-monitor.service'
import { Organization } from '../../database/entities/organization.entity'
import { ClientGroup } from '../../database/entities/client-group.entity'
import { ClientGroupMembership } from '../../database/entities/client-group-membership.entity'
import { PushPreference } from '../../database/entities/push-preference.entity'
import { Tenant } from '../../database/entities/tenant.entity'
import { SystemHealthLog } from '../../database/entities/system-health-log.entity'
import { Alert } from '../../database/entities/alert.entity'
import { RadarPush } from '../../database/entities/radar-push.entity'
import { PushFeedback } from '../../database/entities/push-feedback.entity'
import { CustomerActivityLog } from '../../database/entities/customer-activity-log.entity'
import { CustomerIntervention } from '../../database/entities/customer-intervention.entity'
import { SystemHealthLogRepository } from '../../database/repositories/system-health-log.repository'
import { AlertRepository } from '../../database/repositories/alert.repository'
import { CustomerActivityLogRepository } from '../../database/repositories/customer-activity-log.repository'
import { CustomerInterventionRepository } from '../../database/repositories/customer-intervention.repository'
import { RadarPushRepository } from '../../database/repositories/radar-push.repository'
import { PushFeedbackRepository } from '../../database/repositories/push-feedback.repository'
import { OrganizationRepository } from '../../database/repositories/organization.repository'
import { OrganizationsModule } from '../organizations/organizations.module'
import { ContentQualityController } from './content-quality/content-quality.controller'
import { ContentQualityService } from './content-quality/content-quality.service'
import { CustomerActivityController } from './clients/customer-activity.controller'
import { CustomerActivityService } from './clients/customer-activity.service'
import { CustomerInterventionService } from './clients/customer-intervention.service'

/**
 * AdminModule
 *
 * Module for admin/consulting company management features.
 * Provides bulk client management, white-label configuration, and operations dashboard.
 *
 * @story 6-2, 6-3, 7-1, 7-2
 * @module backend/src/modules/admin
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Organization,
      ClientGroup,
      ClientGroupMembership,
      PushPreference,
      Tenant,
      SystemHealthLog,
      Alert,
      RadarPush,
      PushFeedback,
      CustomerActivityLog,
      CustomerIntervention,
    ]),
    HttpModule,
    ScheduleModule.forRoot(),
    OrganizationsModule,
  ],
  controllers: [
    AdminClientsController,
    AdminClientGroupsController,
    AdminBrandingController,
    PublicBrandingController,
    DashboardController,
    ContentQualityController,
    CustomerActivityController,
  ],
  providers: [
    AdminClientsService,
    AdminBrandingService,
    FileUploadService,
    EmailTemplateService,
    CsvParserService,
    EmailService,
    DashboardService,
    AlertService,
    HealthMonitorService,
    SystemHealthLogRepository,
    AlertRepository,
    RadarPushRepository,
    PushFeedbackRepository,
    OrganizationRepository,
    CustomerActivityLogRepository,
    CustomerInterventionRepository,
    ContentQualityService,
    CustomerActivityService,
    CustomerInterventionService,
  ],
  exports: [
    AdminClientsService,
    AdminBrandingService,
    FileUploadService,
    EmailTemplateService,
    CsvParserService,
    EmailService,
    DashboardService,
    AlertService,
    HealthMonitorService,
    ContentQualityService,
    CustomerActivityLogRepository,
    CustomerInterventionRepository,
    CustomerActivityService,
    CustomerInterventionService,
  ],
})
export class AdminModule {}
