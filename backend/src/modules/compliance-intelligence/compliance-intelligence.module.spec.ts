import { MODULE_METADATA } from '@nestjs/common/constants'
import { AppModule } from '../../app.module'
import { ApplicabilityEngineModule } from '../applicability-engine/applicability-engine.module'
import { AuditModule } from '../audit/audit.module'
import { KnowledgeGraphModule } from '../knowledge-graph/knowledge-graph.module'
import { OrganizationsModule } from '../organizations/organizations.module'
import { SurveyModule } from '../survey/survey.module'
import { ControlReportController } from './controllers/control-report.controller'
import { ControlExplainController } from './controllers/control-explain.controller'
import { RadarRelevanceController } from './controllers/radar-relevance.controller'
import { ComplianceIntelligenceModule } from './compliance-intelligence.module'
import { ControlReportCompilerService } from './services/control-report-compiler.service'
import { ControlExplainService } from './services/control-explain.service'
import { RadarRelevanceEnhancedService } from './services/radar-relevance-enhanced.service'

describe('ComplianceIntelligenceModule', () => {
  it('should register expected controllers, imports and providers', () => {
    const controllers =
      Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, ComplianceIntelligenceModule) ?? []
    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, ComplianceIntelligenceModule) ?? []
    const providers =
      Reflect.getMetadata(MODULE_METADATA.PROVIDERS, ComplianceIntelligenceModule) ?? []

    expect(controllers).toEqual(
      expect.arrayContaining([
        ControlExplainController,
        RadarRelevanceController,
        ControlReportController,
      ]),
    )
    expect(imports).toEqual(
      expect.arrayContaining([
        KnowledgeGraphModule,
        OrganizationsModule,
        AuditModule,
        ApplicabilityEngineModule,
        SurveyModule,
      ]),
    )
    expect(providers).toEqual(
      expect.arrayContaining([
        ControlExplainService,
        RadarRelevanceEnhancedService,
        ControlReportCompilerService,
      ]),
    )
  })

  it('should be imported by AppModule', () => {
    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule) ?? []

    expect(imports).toEqual(expect.arrayContaining([ComplianceIntelligenceModule]))
  })
})
