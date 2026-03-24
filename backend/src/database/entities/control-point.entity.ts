import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm'
import { TaxonomyL1 } from './taxonomy-l1.entity'
import { TaxonomyL2 } from './taxonomy-l2.entity'

export const CONTROL_POINT_TYPES = ['governance', 'preventive', 'detective', 'corrective'] as const
export type ControlPointType = (typeof CONTROL_POINT_TYPES)[number]

export const CONTROL_POINT_RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH'] as const
export type ControlPointRiskLevel = (typeof CONTROL_POINT_RISK_LEVELS)[number]

export const CONTROL_POINT_STATUSES = ['ACTIVE', 'INACTIVE'] as const
export type ControlPointStatus = (typeof CONTROL_POINT_STATUSES)[number]

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
}
