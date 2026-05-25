import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AdvisoryModuleConfig } from '../../database/entities/advisory-module-config.entity'
import { AdvisoryConversationMessage } from '../../database/entities/advisory-conversation-message.entity'
import { AdvisoryOrganizationContext } from '../../database/entities/advisory-organization-context.entity'
import { AdvisoryQuickConsultContext } from '../../database/entities/advisory-quick-consult-context.entity'
import { AdvisoryOutputRating } from '../../database/entities/advisory-output-rating.entity'
import { AdvisoryOutputKnowledgeBaseAssociation } from '../../database/entities/advisory-output-knowledge-base-association.entity'
import { AdvisoryRecommendationFeedback } from '../../database/entities/advisory-recommendation-feedback.entity'
import { AdvisoryWorkflowCheckpoint } from '../../database/entities/advisory-workflow-checkpoint.entity'
import { AdvisoryWorkflowOutput } from '../../database/entities/advisory-workflow-output.entity'
import { AdvisoryWorkflowSession } from '../../database/entities/advisory-workflow-session.entity'
import { AuditModule } from '../audit/audit.module'
import { OrganizationsModule } from '../organizations/organizations.module'
import { AdvisoryAccessController } from './access/advisory-access.controller'
import { AdvisoryAccessService } from './access/advisory-access.service'
import { AdvisoryModuleConfigRepository } from './admin/advisory-module-config.repository'
import { AdvisoryAdminController } from './admin/advisory-admin.controller'
import { AdvisoryAdminService } from './admin/advisory-admin.service'
import {
  ADVISORY_CHECKPOINT_HOT_STORE,
  AdvisoryCheckpointService,
  IORedisAdvisoryCheckpointHotStore,
} from './checkpoints/advisory-checkpoint.service'
import { AdvisoryWorkflowCheckpointRepository } from './checkpoints/advisory-workflow-checkpoint.repository'
import { ThinkTankContextCompressionService } from './context-compression/thinktank-context-compression.service'
import { AdvisoryEventService } from './events/advisory-event.service'
import {
  CSAAS_ENTERPRISE_SIGNALS_ADAPTER,
  CsaasEnterpriseSignalsService,
  CsaasNoDataEnterpriseSignalAdapter,
} from './integration/csaas-enterprise-signals.service'
import { AdvisoryOrganizationContextController } from './org-context/advisory-organization-context.controller'
import { AdvisoryOrganizationContextRepository } from './org-context/advisory-organization-context.repository'
import { AdvisoryOrganizationContextService } from './org-context/advisory-organization-context.service'
import { AdvisoryOperationsController } from './operations/advisory-operations.controller'
import { AdvisoryGovernanceService } from './operations/advisory-governance.service'
import { AdvisoryOperationsService } from './operations/advisory-operations.service'
import { AdvisoryQualityFeedbackService } from './operations/advisory-quality-feedback.service'
import { AdvisoryProviderTelemetryService } from './operations/advisory-provider-telemetry.service'
import {
  THINKTANK_PROVIDER_GATEWAY_ADAPTERS,
  THINKTANK_PROVIDER_GATEWAY_CONFIG,
  resolveThinkTankProviderGatewayConfig,
} from './provider-gateway/thinktank-provider-gateway.config'
import { ThinkTankProviderGatewayService } from './provider-gateway/thinktank-provider-gateway.service'
import { AnthropicGlmProviderAdapter } from './provider-gateway/providers/anthropic-glm-provider.adapter'
import { FakeThinkTankProviderAdapter } from './provider-gateway/providers/fake-thinktank-provider.adapter'
import { QuickConsultController } from './quick-consult/quick-consult.controller'
import { QuickConsultContextRepository } from './quick-consult/quick-consult.repository'
import {
  QuickConsultAnalysisRunner,
  QuickConsultIntakeAnalyzer,
  QuickConsultService,
} from './quick-consult/quick-consult.service'
import { QuickConsultMethodBrowseService } from './quick-consult/quick-consult-method-browse.service'
import { QuickConsultMethodRecommendationService } from './quick-consult/quick-consult-method-recommendation.service'
import { QuickConsultRecommendationFeedbackRepository } from './quick-consult/quick-consult-recommendation-feedback.repository'
import { QuickConsultRecommendationFeedbackService } from './quick-consult/quick-consult-recommendation-feedback.service'
import { ThinkTankBrandMapperService } from './runtime/brand-mapper.service'
import { ThinkTankPartyModeAdvisorPersonaService } from './runtime/party-mode-advisor-persona.service'
import { ThinkTankPromptAssemblerService } from './runtime/prompt-assembler.service'
import { ThinkTankRuntimeFileProviderService } from './runtime/runtime-file-provider.service'
import { ThinkTankWorkflowStepResolverService } from './runtime/workflow-step-resolver.service'
import { ThinkTankWorkflowParserService } from './runtime/workflow-parser.service'
import { ThinkTankWorkflowRegistryService } from './runtime/workflow-registry.service'
import { AdvisorySessionController } from './sessions/advisory-session.controller'
import { AdvisoryOutputExportService } from './outputs/advisory-output-export.service'
import { AdvisoryOutputPdfRendererService } from './outputs/advisory-output-pdf-renderer.service'
import { AdvisoryOutputKnowledgeBaseAssociationRepository } from './outputs/advisory-output-knowledge-base-association.repository'
import { AdvisoryOutputRatingRepository } from './outputs/advisory-output-rating.repository'
import { AdvisoryWorkflowOutputRepository } from './outputs/advisory-workflow-output.repository'
import {
  KNOWLEDGE_BASE_ASSOCIATION_PORT,
  PendingKnowledgeBaseAssociationAdapter,
} from './outputs/knowledge-base-association.port'
import { AdvisoryConversationMessageRepository } from './sessions/advisory-conversation-message.repository'
import { AdvisorySessionRepository } from './sessions/advisory-session.repository'
import { AdvisorySessionService } from './sessions/advisory-session.service'

@Module({
  imports: [
    ConfigModule,
    AuditModule,
    OrganizationsModule,
    TypeOrmModule.forFeature([
      AdvisoryModuleConfig,
      AdvisoryConversationMessage,
      AdvisoryOrganizationContext,
      AdvisoryQuickConsultContext,
      AdvisoryOutputKnowledgeBaseAssociation,
      AdvisoryOutputRating,
      AdvisoryRecommendationFeedback,
      AdvisoryWorkflowCheckpoint,
      AdvisoryWorkflowOutput,
      AdvisoryWorkflowSession,
    ]),
  ],
  controllers: [
    AdvisoryAccessController,
    AdvisoryAdminController,
    AdvisoryOrganizationContextController,
    AdvisoryOperationsController,
    AdvisorySessionController,
    QuickConsultController,
  ],
  providers: [
    AdvisoryAccessService,
    AdvisoryAdminService,
    AdvisoryModuleConfigRepository,
    AdvisoryWorkflowCheckpointRepository,
    AdvisoryCheckpointService,
    ThinkTankContextCompressionService,
    IORedisAdvisoryCheckpointHotStore,
    {
      provide: ADVISORY_CHECKPOINT_HOT_STORE,
      useExisting: IORedisAdvisoryCheckpointHotStore,
    },
    AdvisoryOrganizationContextRepository,
    AdvisoryOrganizationContextService,
    AdvisoryOperationsService,
    AdvisoryGovernanceService,
    AdvisoryQualityFeedbackService,
    AdvisoryProviderTelemetryService,
    AdvisoryConversationMessageRepository,
    AdvisoryOutputRatingRepository,
    AdvisoryOutputKnowledgeBaseAssociationRepository,
    AdvisoryWorkflowOutputRepository,
    AdvisoryOutputExportService,
    AdvisoryOutputPdfRendererService,
    AdvisorySessionRepository,
    AdvisorySessionService,
    AdvisoryEventService,
    PendingKnowledgeBaseAssociationAdapter,
    {
      provide: KNOWLEDGE_BASE_ASSOCIATION_PORT,
      useExisting: PendingKnowledgeBaseAssociationAdapter,
    },
    CsaasNoDataEnterpriseSignalAdapter,
    {
      provide: CSAAS_ENTERPRISE_SIGNALS_ADAPTER,
      useExisting: CsaasNoDataEnterpriseSignalAdapter,
    },
    CsaasEnterpriseSignalsService,
    QuickConsultContextRepository,
    QuickConsultRecommendationFeedbackRepository,
    QuickConsultIntakeAnalyzer,
    QuickConsultAnalysisRunner,
    QuickConsultMethodBrowseService,
    QuickConsultMethodRecommendationService,
    QuickConsultRecommendationFeedbackService,
    QuickConsultService,
    {
      provide: THINKTANK_PROVIDER_GATEWAY_CONFIG,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        resolveThinkTankProviderGatewayConfig(configService),
    },
    {
      provide: THINKTANK_PROVIDER_GATEWAY_ADAPTERS,
      inject: [THINKTANK_PROVIDER_GATEWAY_CONFIG],
      useFactory: (config: ReturnType<typeof resolveThinkTankProviderGatewayConfig>) => [
        new FakeThinkTankProviderAdapter(),
        new AnthropicGlmProviderAdapter(config),
      ],
    },
    ThinkTankProviderGatewayService,
    ThinkTankRuntimeFileProviderService,
    ThinkTankBrandMapperService,
    ThinkTankPartyModeAdvisorPersonaService,
    ThinkTankWorkflowParserService,
    ThinkTankWorkflowRegistryService,
    ThinkTankWorkflowStepResolverService,
    ThinkTankPromptAssemblerService,
  ],
  exports: [
    AdvisoryAccessService,
    AdvisoryAdminService,
    AdvisoryEventService,
    AdvisoryWorkflowCheckpointRepository,
    AdvisoryCheckpointService,
    ThinkTankContextCompressionService,
    CsaasEnterpriseSignalsService,
    AdvisoryOrganizationContextRepository,
    AdvisoryOrganizationContextService,
    AdvisoryOperationsService,
    AdvisoryGovernanceService,
    AdvisoryQualityFeedbackService,
    AdvisoryProviderTelemetryService,
    AdvisoryConversationMessageRepository,
    AdvisoryOutputRatingRepository,
    AdvisoryOutputKnowledgeBaseAssociationRepository,
    AdvisoryWorkflowOutputRepository,
    AdvisoryOutputExportService,
    AdvisoryOutputPdfRendererService,
    AdvisorySessionService,
    AdvisorySessionRepository,
    QuickConsultService,
    QuickConsultContextRepository,
    QuickConsultRecommendationFeedbackRepository,
    QuickConsultMethodBrowseService,
    QuickConsultMethodRecommendationService,
    QuickConsultRecommendationFeedbackService,
    ThinkTankProviderGatewayService,
    ThinkTankRuntimeFileProviderService,
    ThinkTankBrandMapperService,
    ThinkTankPartyModeAdvisorPersonaService,
    ThinkTankWorkflowParserService,
    ThinkTankWorkflowRegistryService,
    ThinkTankWorkflowStepResolverService,
    ThinkTankPromptAssemblerService,
  ],
})
export class AdvisoryModule {}
