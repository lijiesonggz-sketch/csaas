import { Injectable, OnModuleInit, Optional } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { TaxonomyL2RuntimeProfile } from '../../../../database/entities/taxonomy-l2-runtime-profile.entity'
import type { TaxonomyMappingRecord } from './contracts/classification-result.contract'
import type { MappingRepository } from './mapping-repository.interface'

type HydratedRuntimeProfile = TaxonomyL2RuntimeProfile & {
  taxonomyL2?: {
    l2Code: string
    l1Code: string
    l2Name: string
    parent?: {
      l1Code: string
      l1Name: string
    } | null
  } | null
}

function cloneMapping(mapping: TaxonomyMappingRecord): TaxonomyMappingRecord {
  return {
    ...mapping,
    aliases: [...mapping.aliases],
    keywords: [...mapping.keywords],
  }
}

@Injectable()
export class TypeOrmBackedMappingRepository implements MappingRepository, OnModuleInit {
  private cachedMappings: TaxonomyMappingRecord[] | null = null
  private cachedVersion: string | null = null

  constructor(
    @Optional()
    @InjectRepository(TaxonomyL2RuntimeProfile)
    private readonly runtimeProfileRepository?: Repository<TaxonomyL2RuntimeProfile>,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.runtimeProfileRepository) {
      return
    }

    await this.refreshCache()
  }

  async refreshCache(): Promise<void> {
    if (!this.runtimeProfileRepository) {
      throw new Error('Taxonomy runtime profile repository is required to hydrate mapping cache.')
    }

    const rows = (await this.runtimeProfileRepository.find({
      relations: {
        taxonomyL2: {
          parent: true,
        },
      },
      order: {
        l2Code: 'ASC',
      },
    })) as HydratedRuntimeProfile[]

    if (rows.length === 0) {
      throw new Error(
        'No taxonomy runtime profiles found. Seed/bootstrap must hydrate companion runtime profile data before runtime classification starts.',
      )
    }

    const versionSet = new Set(
      rows.map((row) => row.sourceVersion).filter((value) => value.length > 0),
    )
    if (versionSet.size !== 1) {
      throw new Error(
        `Taxonomy runtime profiles contain inconsistent sourceVersion values: ${[
          ...versionSet,
        ].join(', ')}`,
      )
    }

    this.cachedMappings = rows.map((row) => {
      if (!row.taxonomyL2) {
        throw new Error(`Taxonomy runtime profile ${row.l2Code} is missing taxonomy_l2 relation.`)
      }
      if (!row.taxonomyL2.parent) {
        throw new Error(
          `Taxonomy runtime profile ${row.l2Code} is missing taxonomy_l1 parent relation.`,
        )
      }

      return {
        l1Code: row.taxonomyL2.l1Code,
        l1Name: row.taxonomyL2.parent.l1Name,
        l2Code: row.taxonomyL2.l2Code,
        l2Name: row.taxonomyL2.l2Name,
        definition: row.definition,
        canonicalTheme: row.canonicalTheme,
        aliases: [...(row.aliasesJson ?? [])],
        keywords: [...(row.keywordsJson ?? [])],
      }
    })
    this.cachedVersion = rows[0].sourceVersion
  }

  loadAll(): TaxonomyMappingRecord[] {
    if (!this.cachedMappings) {
      throw new Error(
        'Taxonomy runtime profile cache is not initialized. Call refreshCache() before reading mappings.',
      )
    }

    return this.cachedMappings.map(cloneMapping)
  }

  loadByL1Code(l1Code: string): TaxonomyMappingRecord[] {
    return this.loadAll().filter((mapping) => mapping.l1Code === l1Code)
  }

  getVersion(): string {
    if (!this.cachedVersion) {
      throw new Error(
        'Taxonomy runtime profile cache is not initialized. mappingVersion is unavailable.',
      )
    }

    return this.cachedVersion
  }

  snapshotCacheState(): { mappings: TaxonomyMappingRecord[]; version: string } | null {
    if (!this.cachedMappings || !this.cachedVersion) {
      return null
    }

    return {
      mappings: this.cachedMappings.map(cloneMapping),
      version: this.cachedVersion,
    }
  }

  replaceCacheState(mappings: TaxonomyMappingRecord[], version: string): void {
    this.cachedMappings = mappings.map(cloneMapping)
    this.cachedVersion = version
  }
}
