import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  QueryRunner,
  Unique,
  UpdateDateColumn,
} from 'typeorm'
import { ObligationControlMap } from './obligation-control-map.entity'
import { TaxonomyL1 } from './taxonomy-l1.entity'
import { TaxonomyL2 } from './taxonomy-l2.entity'

export const CONTROL_POINT_TYPES = ['governance', 'preventive', 'detective', 'corrective'] as const
export type ControlPointType = (typeof CONTROL_POINT_TYPES)[number]

export const CONTROL_POINT_RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH'] as const
export type ControlPointRiskLevel = (typeof CONTROL_POINT_RISK_LEVELS)[number]

export const CONTROL_POINT_STATUSES = ['ACTIVE', 'INACTIVE'] as const
export type ControlPointStatus = (typeof CONTROL_POINT_STATUSES)[number]

// ---------------------------------------------------------------------------
// KG V2 Governance enums & types (Story 1-2)
// ---------------------------------------------------------------------------

export const CONTROL_POINT_ORIGIN_TYPES = [
  'case_derived',
  'regulation_derived',
  'both',
  'candidate',
  'manual',
] as const
export type ControlPointOriginType = (typeof CONTROL_POINT_ORIGIN_TYPES)[number]

export const CONTROL_POINT_MATURITY_LEVELS = [
  'hard',
  'draft-hard',
  'candidate',
  'retired',
] as const
export type ControlPointMaturityLevel = (typeof CONTROL_POINT_MATURITY_LEVELS)[number]

export const APPLICABLE_SECTORS = ['银行', '证券', '保险', '基金', '期货', '通用'] as const
export type ApplicableSector = (typeof APPLICABLE_SECTORS)[number]

/** sector_requirements 的合法 key（不含 '通用'） */
export const SECTOR_REQUIREMENT_KEYS = ['银行', '证券', '保险', '基金', '期货'] as const
export type SectorRequirementKey = (typeof SECTOR_REQUIREMENT_KEYS)[number]

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface AuthorityProfile {
  has_source_basis: boolean
  has_applicability_scope: boolean
  has_control_activity: boolean
  has_expected_evidence: boolean
  has_human_review: boolean
  has_case_validation: boolean
}

const AUTHORITY_PROFILE_DIMENSIONS: (keyof AuthorityProfile)[] = [
  'has_source_basis',
  'has_applicability_scope',
  'has_control_activity',
  'has_expected_evidence',
  'has_human_review',
  'has_case_validation',
]

export interface SectorRequirement {
  log_retention?: string
  review_frequency?: string
  approval_level?: string
  [key: string]: unknown
}

export type SectorRequirements = {
  [K in SectorRequirementKey]?: SectorRequirement
}

@Entity('control_points')
@Unique('UQ_control_points_control_code', ['controlCode'])
export class ControlPoint {
  @PrimaryGeneratedColumn('uuid', { name: 'control_id' })
  controlId: string

  @Column({ name: 'control_code', type: 'varchar', length: 100 })
  controlCode: string

  @Column({ name: 'control_name', type: 'varchar', length: 300 })
  controlName: string

  @Column({ name: 'control_desc', type: 'text', nullable: true })
  controlDesc: string | null

  @Column({ name: 'aliases', type: 'jsonb', nullable: true })
  aliases: string[] | null

  @Column({ name: 'keywords', type: 'jsonb', nullable: true })
  keywords: string[] | null

  @Column({ name: 'canonical_theme', type: 'varchar', length: 300, nullable: true })
  canonicalTheme: string | null

  @Column({ name: 'l1_code', type: 'varchar', length: 20 })
  l1Code: string

  @Column({ name: 'l2_code', type: 'varchar', length: 20 })
  l2Code: string

  @Column({ name: 'control_family', type: 'varchar', length: 100 })
  controlFamily: string

  @Column({ name: 'control_type', type: 'varchar', length: 50 })
  controlType: ControlPointType

  @Column({ name: 'mandatory_default', type: 'boolean', default: false })
  mandatoryDefault: boolean

  @Column({ name: 'risk_level_default', type: 'varchar', length: 20, default: 'MEDIUM' })
  riskLevelDefault: ControlPointRiskLevel

  @Column({ name: 'owner_role_hint', type: 'jsonb', nullable: true })
  ownerRoleHint: string[] | null

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status: ControlPointStatus

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date

  @ManyToOne(() => TaxonomyL1, (taxonomyL1) => taxonomyL1.controlPoints, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'l1_code', referencedColumnName: 'l1Code' })
  taxonomyL1: TaxonomyL1

  @ManyToOne(() => TaxonomyL2, (taxonomyL2) => taxonomyL2.controlPoints, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'l2_code', referencedColumnName: 'l2Code' })
  taxonomyL2: TaxonomyL2

  @OneToMany(() => ObligationControlMap, (map) => map.controlPoint)
  obligationControlMaps: ObligationControlMap[]

  // ---------------------------------------------------------------------------
  // KG V2 Governance fields (Story 1-2)
  // ---------------------------------------------------------------------------

  @Column({ name: 'origin_type', type: 'varchar', length: 30, default: 'candidate' })
  originType: ControlPointOriginType

  @Column({ name: 'maturity_level', type: 'varchar', length: 20, default: 'candidate' })
  maturityLevel: ControlPointMaturityLevel

  @Column({ name: 'objective_summary', type: 'text', nullable: true })
  objectiveSummary: string | null

  @Column({ name: 'source_basis', type: 'jsonb', nullable: true })
  sourceBasis: Record<string, unknown> | null

  @Column({ name: 'authority_profile_json', type: 'jsonb', nullable: true })
  authorityProfileJson: AuthorityProfile | null

  @Column({ name: 'authoritative_score', type: 'numeric', precision: 5, scale: 4, nullable: true })
  authoritativeScore: number | null

  @Column({ name: 'superseded_by', type: 'uuid', nullable: true })
  supersededBy: string | null

  @ManyToOne(() => ControlPoint, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'superseded_by', referencedColumnName: 'controlId' })
  supersededByControlPoint: ControlPoint | null

  @Column({ name: 'retired_reason', type: 'text', nullable: true })
  retiredReason: string | null

  @Column({ name: 'applicable_sector', type: 'varchar', length: 50, array: true, default: '{}' })
  applicableSector: ApplicableSector[]

  @Column({ name: 'sector_requirements', type: 'jsonb', nullable: true })
  sectorRequirements: SectorRequirements | null

  // ---------------------------------------------------------------------------
  // Hooks: auto-calculate authoritative_score
  // ---------------------------------------------------------------------------

  @BeforeInsert()
  @BeforeUpdate()
  calculateAuthoritativeScore(): void {
    if (this.authorityProfileJson == null) {
      this.authoritativeScore = null
      return
    }
    const profile = this.authorityProfileJson as unknown as Record<string, unknown>
    const trueCount = AUTHORITY_PROFILE_DIMENSIONS.filter(
      (dim) => profile[dim] === true,
    ).length
    this.authoritativeScore = Number((trueCount / 6).toFixed(4))
  }

  // ---------------------------------------------------------------------------
  // Static: batch recalculate all scores via raw SQL
  // ---------------------------------------------------------------------------

  static async recalculateAllScores(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "control_points"
      SET "authoritative_score" = CASE
        WHEN "authority_profile_json" IS NULL THEN NULL
        ELSE (
          (CASE WHEN COALESCE("authority_profile_json"->>'has_source_basis', '') = 'true' THEN 1 ELSE 0 END +
           CASE WHEN COALESCE("authority_profile_json"->>'has_applicability_scope', '') = 'true' THEN 1 ELSE 0 END +
           CASE WHEN COALESCE("authority_profile_json"->>'has_control_activity', '') = 'true' THEN 1 ELSE 0 END +
           CASE WHEN COALESCE("authority_profile_json"->>'has_expected_evidence', '') = 'true' THEN 1 ELSE 0 END +
           CASE WHEN COALESCE("authority_profile_json"->>'has_human_review', '') = 'true' THEN 1 ELSE 0 END +
           CASE WHEN COALESCE("authority_profile_json"->>'has_case_validation', '') = 'true' THEN 1 ELSE 0 END
          )::NUMERIC(5,4) / 6
        )
      END
    `)
  }
}
