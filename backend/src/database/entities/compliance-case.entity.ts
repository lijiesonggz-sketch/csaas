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
import { CaseControlMap } from './case-control-map.entity'
import { TaxonomyL1 } from './taxonomy-l1.entity'
import { TaxonomyL2 } from './taxonomy-l2.entity'

export const COMPLIANCE_CASE_STATUSES = [
  'pending',
  'extracted',
  'clustered',
  'reviewed',
  'active',
  'inactive',
] as const
export type ComplianceCaseStatus = (typeof COMPLIANCE_CASE_STATUSES)[number]

export type ComplianceCaseClauseCandidate = {
  clauseId: string
  clauseCode: string
  summary: string | null
  matchedKeywords: string[]
  confidenceScore: number
}

export type ComplianceCaseControlPointDraft = {
  controlName: string
  sourceTheme: string
  confidenceScore: number
  reason: string
}

@Entity('compliance_cases')
@Unique('UQ_compliance_cases_case_code', ['caseCode'])
export class ComplianceCase {
  @PrimaryGeneratedColumn('uuid', { name: 'case_id' })
  caseId: string

  @Column({ name: 'case_code', type: 'varchar', length: 100 })
  caseCode: string

  @Column({ name: 'regulator_code', type: 'varchar', length: 20, nullable: true })
  regulatorCode: string | null

  @Column({ name: 'case_title', type: 'varchar', length: 500, nullable: true })
  caseTitle: string | null

  @Column({ name: 'source_org', type: 'varchar', length: 200, nullable: true })
  sourceOrg: string | null

  @Column({ name: 'industry', type: 'varchar', length: 50, nullable: true })
  industry: string | null

  @Column({ name: 'region', type: 'varchar', length: 100, nullable: true })
  region: string | null

  @Column({ name: 'case_date', type: 'date', nullable: true })
  caseDate: Date | null

  @Column({ name: 'authority_name', type: 'varchar', length: 200, nullable: true })
  authorityName: string | null

  @Column({ name: 'penalty_type', type: 'jsonb', nullable: true })
  penaltyType: string[] | null

  @Column({ name: 'case_facts', type: 'text', nullable: true })
  caseFacts: string | null

  @Column({ name: 'penalty_reason', type: 'text', nullable: true })
  penaltyReason: string | null

  @Column({ name: 'violation_themes', type: 'jsonb', nullable: true })
  violationThemes: string[] | null

  @Column({ name: 'clause_candidates', type: 'jsonb', nullable: true })
  clauseCandidates: ComplianceCaseClauseCandidate[] | null

  @Column({ name: 'extracted_at', type: 'timestamp', nullable: true })
  extractedAt: Date | null

  @Column({ name: 'normalized_themes', type: 'jsonb', nullable: true })
  normalizedThemes: string[] | null

  @Column({ name: 'candidate_control_points', type: 'jsonb', nullable: true })
  candidateControlPoints: ComplianceCaseControlPointDraft[] | null

  @Column({ name: 'clustered_at', type: 'timestamp', nullable: true })
  clusteredAt: Date | null

  @Column({ name: 'human_reviewed', type: 'boolean', default: false })
  humanReviewed: boolean

  @Column({ name: 'reviewed_by', type: 'varchar', length: 100, nullable: true })
  reviewedBy: string | null

  @Column({ name: 'reviewed_at', type: 'timestamp', nullable: true })
  reviewedAt: Date | null

  @Column({ name: 'raw_source_url', type: 'text', nullable: true })
  rawSourceUrl: string | null

  @Column({ name: 'raw_content_id', type: 'uuid', nullable: true })
  rawContentId: string | null

  @Column({ name: 'l1_code', type: 'varchar', length: 20, nullable: true })
  l1Code: string | null

  @Column({ name: 'l2_code', type: 'varchar', length: 20, nullable: true })
  l2Code: string | null

  @Column({ name: 'confidence_score', type: 'numeric', precision: 5, scale: 4, nullable: true })
  confidenceScore: string | null

  @Column({ name: 'import_batch_id', type: 'varchar', length: 100, nullable: true })
  importBatchId: string | null

  @Column({ type: 'varchar', length: 30, default: 'pending' })
  status: ComplianceCaseStatus

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date

  @ManyToOne(() => TaxonomyL1, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'l1_code', referencedColumnName: 'l1Code' })
  taxonomyL1: TaxonomyL1 | null

  @ManyToOne(() => TaxonomyL2, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'l2_code', referencedColumnName: 'l2Code' })
  taxonomyL2: TaxonomyL2 | null

  @OneToMany(() => CaseControlMap, (mapping) => mapping.caseRecord)
  caseControlMaps: CaseControlMap[]
}
