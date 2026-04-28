import { DataSourceOptions } from 'typeorm'
import { databaseConfig } from './database.config'
import { APP_ENTITIES, APP_ENTITY_NAMES } from './typeorm.entities'
import { AppDataSource } from './typeorm.config'

function normalizeEntityNames(entities: unknown[]): string[] {
  return entities
    .map((entity) => {
      if (typeof entity === 'function' && entity.name) {
        return entity.name
      }

      return String(entity)
    })
    .sort((left, right) => left.localeCompare(right))
}

describe('typeorm entity parity', () => {
  it('databaseConfig and AppDataSource should both use APP_ENTITIES as the single source of truth', () => {
    const runtimeOptions = databaseConfig()
    const scriptOptions = AppDataSource.options as DataSourceOptions

    expect(runtimeOptions.entities).toBeDefined()
    expect(scriptOptions.entities).toBeDefined()

    expect(normalizeEntityNames(runtimeOptions.entities as unknown[])).toEqual(
      normalizeEntityNames([...APP_ENTITIES]),
    )
    expect(normalizeEntityNames(scriptOptions.entities as unknown[])).toEqual(
      normalizeEntityNames([...APP_ENTITIES]),
    )
  })

  it('APP_ENTITIES should not contain duplicate registrations', () => {
    const duplicates = APP_ENTITY_NAMES.filter(
      (entityName, index) => APP_ENTITY_NAMES.indexOf(entityName) !== index,
    )

    expect(duplicates).toEqual([])
  })

  it('APP_ENTITIES should include runtime-critical taxonomy governance entities', () => {
    expect(APP_ENTITY_NAMES).toEqual(
      expect.arrayContaining([
        'TaxonomyL2',
        'TaxonomyL2RuntimeProfile',
        'ComplianceCaseClassificationRun',
        'KgTaxonomyDomainRolloutPolicy',
      ]),
    )
  })
})
