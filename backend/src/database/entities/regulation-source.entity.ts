import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm'
import { RegulationClause } from './regulation-clause.entity'

export const REGULATION_SOURCE_LEVELS = ['law', 'regulation', 'guideline', 'standard'] as const
export type RegulationSourceLevel = (typeof REGULATION_SOURCE_LEVELS)[number]

export const REGULATION_SOURCE_STATUSES = ['ACTIVE', 'INACTIVE'] as const
export type RegulationSourceStatus = (typeof REGULATION_SOURCE_STATUSES)[number]

@Entity('regulation_sources')
@Unique('UQ_regulation_sources_source_code', ['sourceCode'])
export class RegulationSource {
  @PrimaryGeneratedColumn('uuid', { name: 'source_id' })
  sourceId: string

  @Column({ name: 'source_code', type: 'varchar', length: 100 })
  sourceCode: string

  @Column({ name: 'source_name', type: 'varchar', length: 300 })
  sourceName: string

  @Column({ name: 'source_level', type: 'varchar', length: 50 })
  sourceLevel: RegulationSourceLevel

  @Column({ name: 'authority_name', type: 'varchar', length: 200, nullable: true })
  authorityName: string | null

  @Column({ name: 'industry_scope', type: 'jsonb', nullable: true })
  industryScope: string[] | null

  @Column({ name: 'applicable_org_types', type: 'jsonb', nullable: true })
  applicableOrgTypes: string[] | null

  @Column({ name: 'effective_from', type: 'date', nullable: true })
  effectiveFrom: Date | null

  @Column({ name: 'effective_to', type: 'date', nullable: true })
  effectiveTo: Date | null

  @Column({ name: 'version_no', type: 'varchar', length: 50, nullable: true })
  versionNo: string | null

  @Column({ name: 'source_status', type: 'varchar', length: 30, default: 'ACTIVE' })
  sourceStatus: RegulationSourceStatus

  @Column({ name: 'raw_text_path', type: 'text', nullable: true })
  rawTextPath: string | null

  @Column({ name: 'metadata_json', type: 'jsonb', nullable: true })
  metadataJson: Record<string, unknown> | null

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date

  @OneToMany(() => RegulationClause, (clause) => clause.source)
  clauses: RegulationClause[]
}
