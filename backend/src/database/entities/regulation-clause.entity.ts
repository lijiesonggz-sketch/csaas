import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm'
import { ClauseControlMap } from './clause-control-map.entity'
import { RegulationSource } from './regulation-source.entity'

export const REGULATION_CLAUSE_MANDATORY_LEVELS = [
  'MUST',
  'SHOULD',
  'MAY',
  'PROHIBITED',
] as const
export type RegulationClauseMandatoryLevel = (typeof REGULATION_CLAUSE_MANDATORY_LEVELS)[number]

@Entity('regulation_clauses')
@Unique('UQ_regulation_clauses_clause_code', ['clauseCode'])
export class RegulationClause {
  @PrimaryGeneratedColumn('uuid', { name: 'clause_id' })
  clauseId: string

  @Column({ name: 'source_id', type: 'uuid' })
  sourceId: string

  @Column({ name: 'clause_code', type: 'varchar', length: 100 })
  clauseCode: string

  @Column({ name: 'article_no', type: 'varchar', length: 100, nullable: true })
  articleNo: string | null

  @Column({ name: 'section_path', type: 'varchar', length: 500, nullable: true })
  sectionPath: string | null

  @Column({ name: 'clause_text', type: 'text' })
  clauseText: string

  @Column({ name: 'clause_summary', type: 'text', nullable: true })
  clauseSummary: string | null

  @Column({ name: 'mandatory_level', type: 'varchar', length: 20, nullable: true })
  mandatoryLevel: RegulationClauseMandatoryLevel | null

  @Column({ name: 'keywords', type: 'jsonb', nullable: true })
  keywords: string[] | null

  @Column({ name: 'embedding_id', type: 'varchar', length: 100, nullable: true })
  embeddingId: string | null

  @Column({ name: 'version_no', type: 'varchar', length: 50, nullable: true })
  versionNo: string | null

  @Column({ name: 'effective_from', type: 'date', nullable: true })
  effectiveFrom: Date | null

  @Column({ name: 'effective_to', type: 'date', nullable: true })
  effectiveTo: Date | null

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date

  @ManyToOne(() => RegulationSource, (source) => source.clauses, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'source_id', referencedColumnName: 'sourceId' })
  source: RegulationSource

  @OneToMany(() => ClauseControlMap, (mapping) => mapping.clause)
  clauseControlMaps: ClauseControlMap[]
}
