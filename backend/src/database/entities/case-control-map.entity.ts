import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm'
import { ComplianceCase } from './compliance-case.entity'
import { ControlPoint } from './control-point.entity'
import { MapReviewStatus } from './clause-control-map.entity'

export const CASE_CONTROL_RELATION_TYPES = ['VIOLATES', 'RELATED', 'SUPPORTS'] as const
export type CaseControlRelationType = (typeof CASE_CONTROL_RELATION_TYPES)[number]
export const CASE_CONTROL_MAP_SOURCES = [
  'RULE',
  'LLM_ASSISTED_RULE',
  'LLM_FALLBACK',
  'MANUAL',
  'FAILURE_MODE_CHAIN',
] as const
export type CaseControlMapSource = (typeof CASE_CONTROL_MAP_SOURCES)[number]

@Entity('case_control_maps')
@Unique('UQ_case_control_maps_case_control', ['caseId', 'controlId'])
export class CaseControlMap {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'case_id', type: 'uuid' })
  caseId: string

  @Column({ name: 'control_id', type: 'uuid' })
  controlId: string

  @Column({ name: 'relation_type', type: 'varchar', length: 30, default: 'VIOLATES' })
  relationType: CaseControlRelationType

  @Column({ name: 'confidence_score', type: 'numeric', precision: 5, scale: 4, nullable: true })
  confidenceScore: string | null

  @Column({ name: 'review_status', type: 'varchar', length: 20, default: 'PENDING' })
  reviewStatus: MapReviewStatus

  @Column({ name: 'source', type: 'varchar', length: 30, default: 'RULE' })
  source: CaseControlMapSource

  @ManyToOne(() => ComplianceCase, (caseRecord) => caseRecord.caseControlMaps, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'case_id', referencedColumnName: 'caseId' })
  caseRecord: ComplianceCase

  @ManyToOne(() => ControlPoint, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'control_id', referencedColumnName: 'controlId' })
  controlPoint: ControlPoint
}
