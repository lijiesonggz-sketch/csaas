import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm'
import { TaxonomyFailureModeMap } from './taxonomy-failure-mode-map.entity'
import { FailureModeControlMap } from './failure-mode-control-map.entity'

export const FAILURE_MODE_CATEGORIES = [
  'DEFINITION_ERROR',
  'MAPPING_ERROR',
  'MISSING_CONTROL',
  'TIMELINESS_FAILURE',
  'INTEGRITY_FAILURE',
  'UNAUTHORIZED_ACTION',
  'FALSIFICATION',
] as const
export type FailureModeCategory = (typeof FAILURE_MODE_CATEGORIES)[number]

export const FAILURE_MODE_STATUSES = ['ACTIVE', 'INACTIVE'] as const
export type FailureModeStatus = (typeof FAILURE_MODE_STATUSES)[number]

@Entity('failure_modes')
@Unique('UQ_failure_modes_failure_mode_code', ['failureModeCode'])
export class FailureMode {
  @PrimaryGeneratedColumn('uuid', { name: 'failure_mode_id' })
  failureModeId: string

  @Column({ name: 'failure_mode_code', type: 'varchar', length: 100 })
  failureModeCode: string

  @Column({ name: 'name', type: 'varchar', length: 300 })
  name: string

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null

  @Column({ name: 'category', type: 'varchar', length: 50 })
  category: FailureModeCategory

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status: FailureModeStatus

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date

  @OneToMany(() => TaxonomyFailureModeMap, (map) => map.failureMode)
  taxonomyFailureModeMaps: TaxonomyFailureModeMap[]

  @OneToMany(() => FailureModeControlMap, (map) => map.failureMode)
  failureModeControlMaps: FailureModeControlMap[]
}
