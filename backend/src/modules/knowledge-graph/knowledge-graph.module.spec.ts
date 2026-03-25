import { MODULE_METADATA } from '@nestjs/common/constants'
import { AppModule } from '../../app.module'
import { ApplicabilityEngineModule } from '../applicability-engine/applicability-engine.module'
import { AuditModule } from '../audit/audit.module'
import { OrganizationsModule } from '../organizations/organizations.module'
import { ComplianceCaseController } from './controllers/compliance-case.controller'
import { ControlPackLinkController } from './controllers/control-pack-link.controller'
import { ControlPointController } from './controllers/control-point.controller'
import { RegulationController } from './controllers/regulation.controller'
import { TaxonomyController } from './controllers/taxonomy.controller'
import { KnowledgeGraphModule } from './knowledge-graph.module'

describe('KnowledgeGraphModule', () => {
  it('should register expected controllers and imports', () => {
    const controllers = Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, KnowledgeGraphModule) ?? []
    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, KnowledgeGraphModule) ?? []

    expect(controllers).toEqual(
      expect.arrayContaining([
        TaxonomyController,
        ControlPointController,
        ControlPackLinkController,
        RegulationController,
        ComplianceCaseController,
      ]),
    )
    expect(imports).toEqual(
      expect.arrayContaining([OrganizationsModule, AuditModule, ApplicabilityEngineModule]),
    )
  })

  it('should be imported by AppModule', () => {
    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule) ?? []

    expect(imports).toEqual(expect.arrayContaining([KnowledgeGraphModule]))
  })
})

