import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm'
import { ControlPoint } from './control-point.entity'
import { EvidenceType } from './evidence-type.entity'

export const CONTROL_EVIDENCE_REQUIRED_LEVELS = [
  'REQUIRED',
  'RECOMMENDED',
  'OPTIONAL',
] as const
export type ControlEvidenceRequiredLevel = (typeof CONTROL_EVIDENCE_REQUIRED_LEVELS)[number]

export const EVIDENCE_FREQUENCIES = [
  'DAILY',
  'WEEKLY',
  'MONTHLY',
  'QUARTERLY',
  'ANNUALLY',
  'EVENT_TRIGGERED',
] as const
export type EvidenceFrequency = (typeof EVIDENCE_FREQUENCIES)[number]

export const EVIDENCE_SAMPLING_REQUIREMENTS = ['FULL', 'SAMPLING', 'KEY_SAMPLE'] as const
export type EvidenceSamplingRequirement = (typeof EVIDENCE_SAMPLING_REQUIREMENTS)[number]

@Entity('control_evidence_maps')
@Unique('UQ_control_evidence_maps_control_evidence', ['controlId', 'evidenceId'])
export class ControlEvidenceMap {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'control_id', type: 'uuid' })
  controlId: string

  @Column({ name: 'evidence_id', type: 'uuid' })
  evidenceId: string

  @Column({ name: 'required_level', type: 'varchar', length: 20, default: 'RECOMMENDED' })
  requiredLevel: ControlEvidenceRequiredLevel

  @Column({ type: 'varchar', length: 30, nullable: true })
  frequency: EvidenceFrequency | null

  @Column({ name: 'owner_role', type: 'varchar', length: 100, nullable: true })
  ownerRole: string | null

  @Column({ name: 'sampling_requirement', type: 'varchar', length: 50, nullable: true })
  samplingRequirement: EvidenceSamplingRequirement | null

  @Column({ type: 'text', nullable: true })
  notes: string | null

  @ManyToOne(() => ControlPoint, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'control_id', referencedColumnName: 'controlId' })
  controlPoint: ControlPoint

  @ManyToOne(() => EvidenceType, (evidenceType) => evidenceType.controlEvidenceMaps, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'evidence_id', referencedColumnName: 'evidenceId' })
  evidenceType: EvidenceType
}
