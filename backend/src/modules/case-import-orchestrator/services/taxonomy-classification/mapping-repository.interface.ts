import type { TaxonomyMappingRecord } from './contracts/classification-result.contract'

export const TAXONOMY_MAPPING_REPOSITORY = Symbol('TAXONOMY_MAPPING_REPOSITORY')

export interface MappingRepository {
  loadAll(): TaxonomyMappingRecord[]
  loadByL1Code(l1Code: string): TaxonomyMappingRecord[]
  getVersion(): string
}
