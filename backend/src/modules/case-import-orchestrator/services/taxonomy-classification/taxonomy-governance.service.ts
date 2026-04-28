import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common'
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm'
import { DataSource, In, Repository } from 'typeorm'
import { AuditAction, AuditLog } from '../../../../database/entities/audit-log.entity'
import { TaxonomyL1 } from '../../../../database/entities/taxonomy-l1.entity'
import { TaxonomyL2 } from '../../../../database/entities/taxonomy-l2.entity'
import { TaxonomyL2RuntimeProfile } from '../../../../database/entities/taxonomy-l2-runtime-profile.entity'
import {
  type TaxonomyGovernanceDomainSummaryDto,
  type TaxonomyGovernanceSummaryDto,
  type TaxonomyRuntimeProfileExportResultDto,
  type TaxonomyRuntimeProfileImportResultDto,
} from '../../dto/taxonomy-governance.dto'
import type { TaxonomyMappingRecord } from './contracts/classification-result.contract'
import { seedTaxonomyRuntimeProfiles } from '../../../applicability-engine/seeds/kg-seed.service'
import { CsvBackedMappingRepository } from './csv-backed-mapping.repository'
import { TAXONOMY_DOMAIN_REGISTRY } from './profiles/domain-registry'
import { loadAllRulebookManifests } from './rulebooks/rulebook-manifest.loader'
import { TypeOrmBackedMappingRepository } from './typeorm-backed-mapping.repository'

function escapeCsvValue(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }

  return value
}

function cloneMappingRecord(mapping: TaxonomyMappingRecord): TaxonomyMappingRecord {
  return {
    ...mapping,
    aliases: [...mapping.aliases],
    keywords: [...mapping.keywords],
  }
}

type HydratedRuntimeProfile = TaxonomyL2RuntimeProfile & {
  taxonomyL2?: (TaxonomyL2 & { parent?: TaxonomyL1 | null }) | null
}

const IMPORT_BAD_REQUEST_PATTERNS = [
  /taxonomy mapping csv schema validation failed/i,
  /duplicate taxonomy runtime profile mapping/i,
  /runtime profile import must be a full snapshot/i,
  /references unknown taxonomy_l2 code/i,
  /does not belong to taxonomy_l1/i,
  /missing canonical taxonomy_l1 relation/i,
  /must contain at least one data row/i,
]

@Injectable()
export class TaxonomyGovernanceService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(TaxonomyL1)
    private readonly taxonomyL1Repository: Repository<TaxonomyL1>,
    @InjectRepository(TaxonomyL2)
    private readonly taxonomyL2Repository: Repository<TaxonomyL2>,
    @InjectRepository(TaxonomyL2RuntimeProfile)
    private readonly runtimeProfileRepository: Repository<TaxonomyL2RuntimeProfile>,
    private readonly mappingRepository: TypeOrmBackedMappingRepository,
  ) {}

  async getSummary(tenantId: string): Promise<TaxonomyGovernanceSummaryDto> {
    void tenantId
    const [taxonomyL1Items, taxonomyL2Items, runtimeProfiles] = await Promise.all([
      this.taxonomyL1Repository.find({
        where: { status: 'ACTIVE' },
        order: { sortOrder: 'ASC', l1Code: 'ASC' },
      }),
      this.taxonomyL2Repository.find({
        where: { status: 'ACTIVE' },
        order: { l1Code: 'ASC', sortOrder: 'ASC', l2Code: 'ASC' },
      }),
      this.runtimeProfileRepository.find({
        relations: {
          taxonomyL2: true,
        },
        order: { l2Code: 'ASC' },
      }),
    ])

    const activeRuntimeProfiles = this.selectCanonicalActiveRuntimeProfiles(runtimeProfiles)
    const sourceVersion = this.resolveSingleSourceVersion(activeRuntimeProfiles)
    const manifests = loadAllRulebookManifests()

    const catalogCountByDomain = new Map<string, number>()
    for (const taxonomyL2 of taxonomyL2Items) {
      catalogCountByDomain.set(
        taxonomyL2.l1Code,
        (catalogCountByDomain.get(taxonomyL2.l1Code) ?? 0) + 1,
      )
    }

    const runtimeCountByDomain = new Map<string, number>()
    for (const profile of activeRuntimeProfiles) {
      runtimeCountByDomain.set(
        profile.taxonomyL2!.l1Code,
        (runtimeCountByDomain.get(profile.taxonomyL2!.l1Code) ?? 0) + 1,
      )
    }

    const domains: TaxonomyGovernanceDomainSummaryDto[] = taxonomyL1Items.map((taxonomyL1) => {
      const registryEntry = TAXONOMY_DOMAIN_REGISTRY[taxonomyL1.l1Code]
      const manifest = manifests[taxonomyL1.l1Code]

      return {
        l1Code: taxonomyL1.l1Code,
        l1Name: taxonomyL1.l1Name,
        catalogL2Count: catalogCountByDomain.get(taxonomyL1.l1Code) ?? 0,
        runtimeProfileCount: runtimeCountByDomain.get(taxonomyL1.l1Code) ?? 0,
        rulebookEntryCount: manifest?.entries.length ?? 0,
        mappingSourceVersion: sourceVersion,
        rulebookVersion: manifest?.version ?? null,
        fallbackBucket: manifest?.fallbackBucket ?? null,
        readinessStage: registryEntry?.readiness.stage ?? null,
      }
    })

    return {
      generatedAt: new Date().toISOString(),
      sourceVersion,
      domains,
    }
  }

  async importRuntimeProfile(input: {
    tenantId: string
    actorUserId: string
    sourceVersion: string
    csvText: string
    originalFileName?: string
    ipAddress?: string | null
    userAgent?: string | null
  }): Promise<TaxonomyRuntimeProfileImportResultDto> {
    const sourceVersion = input.sourceVersion.trim()
    const mappingRecords = this.parseRuntimeProfileCsv(input.csvText, sourceVersion)

    if (mappingRecords.length === 0) {
      throw new BadRequestException('Runtime profile import CSV must contain at least one data row')
    }

    const normalizedMappings = await this.validateAndNormalizeMappings(mappingRecords)

    const queryRunner = this.dataSource.createQueryRunner()
    await queryRunner.connect()
    await queryRunner.startTransaction()

    try {
      const importedRowCount = await seedTaxonomyRuntimeProfiles(
        queryRunner,
        normalizedMappings,
        sourceVersion,
      )

      await queryRunner.manager.getRepository(AuditLog).save({
        userId: input.actorUserId,
        tenantId: input.tenantId,
        action: AuditAction.UPDATE,
        entityType: 'TaxonomyRuntimeProfileImport',
        entityId: null,
        details: {
          sourceVersion,
          importedRowCount,
          replacedSnapshot: true,
          originalFileName: input.originalFileName ?? null,
        },
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      })

      await queryRunner.commitTransaction()
      this.mappingRepository.replaceCacheState(normalizedMappings, sourceVersion)

      return {
        sourceVersion,
        importedRowCount,
        cacheRefreshed: true,
        replacedSnapshot: true,
      }
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction()
      }

      throw this.normalizeImportError(error)
    } finally {
      await queryRunner.release()
    }
  }

  async exportRuntimeProfileCsv(tenantId: string): Promise<TaxonomyRuntimeProfileExportResultDto> {
    void tenantId
    const runtimeProfiles = await this.runtimeProfileRepository.find({
      relations: {
        taxonomyL2: {
          parent: true,
        },
      },
      order: {
        l2Code: 'ASC',
      },
    })

    const activeRuntimeProfiles = this.selectCanonicalActiveRuntimeProfiles(runtimeProfiles)
    const sourceVersion = this.resolveSingleSourceVersion(activeRuntimeProfiles)
    if (!sourceVersion) {
      throw new BadRequestException('No active taxonomy runtime profiles found for export')
    }

    const orderedProfiles = [...activeRuntimeProfiles].sort((left, right) => {
      const leftL1Code = left.taxonomyL2!.l1Code
      const rightL1Code = right.taxonomyL2!.l1Code

      if (leftL1Code !== rightL1Code) {
        return leftL1Code.localeCompare(rightL1Code)
      }

      return left.l2Code.localeCompare(right.l2Code)
    })

    const lines = [
      '\uFEFF一级编码,一级类型,二级编码,二级子类型,定义口径,建议canonicalTheme,建议aliases,建议keywords',
      ...orderedProfiles.map((profile) => {
        if (!profile.taxonomyL2?.parent) {
          throw new BadRequestException(
            `Taxonomy runtime profile ${profile.l2Code} is missing taxonomy hierarchy relations.`,
          )
        }

        return [
          profile.taxonomyL2.l1Code,
          profile.taxonomyL2.parent.l1Name,
          profile.taxonomyL2.l2Code,
          profile.taxonomyL2.l2Name,
          profile.definition,
          profile.canonicalTheme,
          (profile.aliasesJson ?? []).join('|'),
          (profile.keywordsJson ?? []).join('|'),
        ]
          .map((value) => escapeCsvValue(value ?? ''))
          .join(',')
      }),
    ]

    return {
      fileName: `taxonomy-runtime-profile-${sourceVersion.replace(/[^A-Za-z0-9._-]/g, '_')}.csv`,
      csvContent: lines.join('\n'),
      sourceVersion,
      rowCount: orderedProfiles.length,
    }
  }

  private parseRuntimeProfileCsv(csvText: string, sourceVersion: string): TaxonomyMappingRecord[] {
    try {
      const csvRepository = new CsvBackedMappingRepository({
        csvText,
        mappingVersion: sourceVersion,
      })

      return csvRepository.loadAll()
    } catch (error) {
      throw this.normalizeImportError(error)
    }
  }

  private async validateAndNormalizeMappings(
    mappingRecords: TaxonomyMappingRecord[],
  ): Promise<TaxonomyMappingRecord[]> {
    const l2Codes = mappingRecords.map((mapping) => mapping.l2Code)
    const taxonomyRows = await this.taxonomyL2Repository.find({
      where: {
        l2Code: In(l2Codes),
        status: 'ACTIVE',
      },
      relations: {
        parent: true,
      },
      order: {
        l2Code: 'ASC',
      },
    })

    const activeTaxonomyRows = await this.taxonomyL2Repository.find({
      where: {
        status: 'ACTIVE',
      },
      select: {
        l2Code: true,
      },
      order: {
        l2Code: 'ASC',
      },
    })

    const taxonomyByCode = new Map(taxonomyRows.map((taxonomy) => [taxonomy.l2Code, taxonomy]))
    const importedCodeSet = new Set(l2Codes)
    const activeCodeSet = new Set(activeTaxonomyRows.map((taxonomy) => taxonomy.l2Code))

    if (importedCodeSet.size !== activeCodeSet.size) {
      throw new BadRequestException(
        'Runtime profile import must be a full snapshot of ACTIVE taxonomy_l2',
      )
    }

    for (const activeCode of activeCodeSet) {
      if (!importedCodeSet.has(activeCode)) {
        throw new BadRequestException(
          'Runtime profile import must be a full snapshot of ACTIVE taxonomy_l2',
        )
      }
    }

    const normalizedMappings: TaxonomyMappingRecord[] = []

    for (const mapping of mappingRecords) {
      const taxonomy = taxonomyByCode.get(mapping.l2Code)

      if (!taxonomy) {
        throw new BadRequestException(
          `Imported runtime profile row references unknown taxonomy_l2 code ${mapping.l2Code}`,
        )
      }

      if (taxonomy.l1Code !== mapping.l1Code) {
        throw new BadRequestException(
          `Imported runtime profile row ${mapping.l2Code} does not belong to taxonomy_l1 ${mapping.l1Code}`,
        )
      }

      if (!taxonomy.parent) {
        throw new BadRequestException(
          `Imported runtime profile row ${mapping.l2Code} is missing canonical taxonomy_l1 relation`,
        )
      }

      normalizedMappings.push(
        cloneMappingRecord({
          ...mapping,
          l1Code: taxonomy.l1Code,
          l1Name: taxonomy.parent.l1Name,
          l2Code: taxonomy.l2Code,
          l2Name: taxonomy.l2Name,
        }),
      )
    }

    return normalizedMappings
  }

  private resolveSingleSourceVersion(
    runtimeProfiles: Array<Pick<TaxonomyL2RuntimeProfile, 'sourceVersion'>>,
  ): string | null {
    if (runtimeProfiles.length === 0) {
      return null
    }

    const versions = new Set(
      runtimeProfiles
        .map((runtimeProfile) => runtimeProfile.sourceVersion?.trim())
        .filter((version): version is string => Boolean(version)),
    )

    if (versions.size > 1) {
      throw new BadRequestException(
        `Taxonomy runtime profiles contain inconsistent sourceVersion values: ${[...versions].join(
          ', ',
        )}`,
      )
    }

    return [...versions][0] ?? null
  }

  private selectCanonicalActiveRuntimeProfiles(
    runtimeProfiles: HydratedRuntimeProfile[],
  ): HydratedRuntimeProfile[] {
    return runtimeProfiles.filter((runtimeProfile) => {
      if (!runtimeProfile.taxonomyL2) {
        return false
      }

      return (
        runtimeProfile.taxonomyL2.status === undefined ||
        runtimeProfile.taxonomyL2.status === 'ACTIVE'
      )
    })
  }

  private normalizeImportError(error: unknown): BadRequestException | InternalServerErrorException {
    if (error instanceof BadRequestException) {
      return error
    }

    if (
      error instanceof Error &&
      IMPORT_BAD_REQUEST_PATTERNS.some((pattern) => pattern.test(error.message))
    ) {
      return new BadRequestException(error.message)
    }

    return new InternalServerErrorException('Runtime profile import failed')
  }
}
