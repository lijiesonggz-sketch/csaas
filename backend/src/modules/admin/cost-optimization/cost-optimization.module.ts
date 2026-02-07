import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AIUsageLog } from '@/database/entities/ai-usage-log.entity';
import { Organization } from '@/database/entities/organization.entity';
import { Alert } from '@/database/entities/alert.entity';
import { AuditLog } from '@/database/entities/audit-log.entity';
import { AIUsageLogRepository } from '@/database/repositories/ai-usage-log.repository';
import { OrganizationRepository } from '@/database/repositories/organization.repository';
import { AlertRepository } from '@/database/repositories/alert.repository';
import { AuditLogRepository } from '@/database/repositories/audit-log.repository';
import { AIUsageService } from './ai-usage.service';
import { CostOptimizationService } from './cost-optimization.service';
import { CostOptimizationController } from './cost-optimization.controller';
import { EmailService } from '../clients/email.service';
import { EmailTemplateService } from '../branding/email-template.service';
import { AdminBrandingService } from '../branding/admin-branding.service';
import { FileUploadService } from '../branding/file-upload.service';
import { Tenant } from '@/database/entities/tenant.entity';

/**
 * Cost Optimization Module
 *
 * Provides AI usage tracking and cost optimization services.
 *
 * @story 7-4
 * @module backend/src/modules/admin/cost-optimization
 */
@Module({
  imports: [TypeOrmModule.forFeature([AIUsageLog, Organization, Alert, AuditLog, Tenant])],
  controllers: [CostOptimizationController],
  providers: [
    AIUsageService,
    AIUsageLogRepository,
    CostOptimizationService,
    OrganizationRepository,
    AlertRepository,
    AuditLogRepository,
    EmailService,
    EmailTemplateService,
    AdminBrandingService,
    FileUploadService,
  ],
  exports: [AIUsageService, AIUsageLogRepository, CostOptimizationService],
})
export class CostOptimizationModule {}
