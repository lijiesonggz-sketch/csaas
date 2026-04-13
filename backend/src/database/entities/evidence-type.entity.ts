import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm'
import { ControlEvidenceMap } from './control-evidence-map.entity'

export const EVIDENCE_CATEGORIES = [
  'POLICY',
  'PROCESS',
  'SYSTEM',
  'LOG',
  'APPROVAL_RECORD',
  'REPORT',
  'CONFIG',
  'SAMPLE_RECORD',
] as const
export type EvidenceCategory = (typeof EVIDENCE_CATEGORIES)[number]

export const EVIDENCE_TYPE_STATUSES = ['ACTIVE', 'INACTIVE'] as const
export type EvidenceTypeStatus = (typeof EVIDENCE_TYPE_STATUSES)[number]

@Entity('evidence_types')
@Unique('UQ_evidence_types_evidence_code', ['evidenceCode'])
export class EvidenceType {
  @PrimaryGeneratedColumn('uuid', { name: 'evidence_id' })
  evidenceId: string

  @Column({ name: 'evidence_code', type: 'varchar', length: 100 })
  evidenceCode: string

  @Column({ name: 'evidence_name', type: 'varchar', length: 200 })
  evidenceName: string

  @Column({ name: 'evidence_desc', type: 'text', nullable: true })
  evidenceDesc: string | null

  @Column({ name: 'evidence_category', type: 'varchar', length: 50, nullable: true })
  evidenceCategory: EvidenceCategory | null

  @Column({ name: 'auto_collectable', type: 'boolean', default: false })
  autoCollectable: boolean

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status: EvidenceTypeStatus

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date

  @OneToMany(() => ControlEvidenceMap, (mapping) => mapping.evidenceType)
  controlEvidenceMaps: ControlEvidenceMap[]
}
