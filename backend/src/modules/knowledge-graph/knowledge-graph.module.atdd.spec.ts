import {
  expectedAppModuleImports,
  expectedKnowledgeGraphModuleMetadata,
} from './testing/atdd-story-2-1.fixtures'

type KnowledgeGraphModuleSubject = {
  moduleMetadata: {
    controllerNames: string[]
    importNames: string[]
  }
  appModuleImports: string[]
}

describe('Story 2.1 ATDD RED - knowledge-graph module wiring', () => {
  const createSubject = (): KnowledgeGraphModuleSubject => {
    throw new Error(
      'RED PHASE: KnowledgeGraphModule, its controllers, and AppModule registration are not implemented yet',
    )
  }

  test.skip('[P1][2.1-UNIT-012] should wire KnowledgeGraphModule with TaxonomyController, ControlPointController, TypeOrmModule, OrganizationsModule and AuditModule, and register it in AppModule', async () => {
    const subject = createSubject()

    expect(subject.moduleMetadata.controllerNames).toEqual(
      expect.arrayContaining(expectedKnowledgeGraphModuleMetadata.controllerNames),
    )
    expect(subject.moduleMetadata.importNames).toEqual(
      expect.arrayContaining(expectedKnowledgeGraphModuleMetadata.importNames),
    )
    expect(subject.appModuleImports).toEqual(expect.arrayContaining(expectedAppModuleImports))
  })
})
