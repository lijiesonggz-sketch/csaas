import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm'
import { ControlPoint } from './control-point.entity'
import { RegulationClause } from './regulation-clause.entity'

export const CLAUSE_CONTROL_MAPPING_TYPES = ['direct', 'supporting', 'interpretive'] as const
export type ClauseControlMappingType = (typeof CLAUSE_CONTROL_MAPPING_TYPES)[number]

export const MAP_REVIEW_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const
export type MapReviewStatus = (typeof MAP_REVIEW_STATUSES)[number]

@Entity('clause_control_maps')
@Unique('UQ_clause_control_maps_clause_control', ['clauseId', 'controlId'])
export class ClauseControlMap {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'clause_id', type: 'uuid' })
  clauseId: string

  @Column({ name: 'control_id', type: 'uuid' })
  controlId: string

  @Column({ name: 'mapping_type', type: 'varchar', length: 30 })
  mappingType: ClauseControlMappingType

  @Column({ name: 'confidence_score', type: 'numeric', precision: 5, scale: 4, nullable: true })
  confidenceScore: string | null

  @Column({ name: 'review_status', type: 'varchar', length: 20, default: 'PENDING' })
  reviewStatus: MapReviewStatus

  @Column({ name: 'reviewer_id', type: 'uuid', nullable: true })
  reviewerId: string | null

  @Column({ name: 'reviewed_at', type: 'timestamp', nullable: true })
  reviewedAt: Date | null

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null

  @ManyToOne(() => RegulationClause, (clause) => clause.clauseControlMaps, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'clause_id', referencedColumnName: 'clauseId' })
  clause: RegulationClause

  @ManyToOne(() => ControlPoint, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'control_id', referencedColumnName: 'controlId' })
  controlPoint: ControlPoint
}
