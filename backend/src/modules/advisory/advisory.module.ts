import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AdvisoryModuleConfig } from '../../database/entities/advisory-module-config.entity'
import { AuditModule } from '../audit/audit.module'
import { OrganizationsModule } from '../organizations/organizations.module'
import { AdvisoryAccessController } from './access/advisory-access.controller'
import { AdvisoryAccessService } from './access/advisory-access.service'
import { AdvisoryModuleConfigRepository } from './admin/advisory-module-config.repository'
import { AdvisoryAdminController } from './admin/advisory-admin.controller'
import { AdvisoryAdminService } from './admin/advisory-admin.service'
import { AdvisoryEventService } from './events/advisory-event.service'
import {
  THINKTANK_PROVIDER_GATEWAY_ADAPTERS,
  THINKTANK_PROVIDER_GATEWAY_CONFIG,
  resolveThinkTankProviderGatewayConfig,
} from './provider-gateway/thinktank-provider-gateway.config'
import { ThinkTankProviderGatewayService } from './provider-gateway/thinktank-provider-gateway.service'
import { AnthropicGlmProviderAdapter } from './provider-gateway/providers/anthropic-glm-provider.adapter'
import { FakeThinkTankProviderAdapter } from './provider-gateway/providers/fake-thinktank-provider.adapter'

@Module({
  imports: [
    ConfigModule,
    AuditModule,
    OrganizationsModule,
    TypeOrmModule.forFeature([AdvisoryModuleConfig]),
  ],
  controllers: [AdvisoryAccessController, AdvisoryAdminController],
  providers: [
    AdvisoryAccessService,
    AdvisoryAdminService,
    AdvisoryModuleConfigRepository,
    AdvisoryEventService,
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
  ],
  exports: [
    AdvisoryAccessService,
    AdvisoryAdminService,
    AdvisoryEventService,
    ThinkTankProviderGatewayService,
  ],
})
export class AdvisoryModule {}
