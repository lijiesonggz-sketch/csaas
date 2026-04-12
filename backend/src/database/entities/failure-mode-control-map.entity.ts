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
import { FailureMode } from './failure-mode.entity'
import { ControlPoint } from './control-point.entity'

export const FAILURE_MODE_CONTROL_RELEVANCES = ['PRIMARY', 'SECONDARY'] as const
export type FailureModeControlRelevance = (typeof FAILURE_MODE_CONTROL_RELEVANCES)[number]

@Entity('failure_mode_control_maps')
@Unique('UQ_fmcm_failure_mode_id_control_id', ['failureModeId', 'controlId'])
export class FailureModeControlMap {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'failure_mode_id', type: 'uuid' })
  failureModeId: string

  @Column({ name: 'control_id', type: 'uuid' })
  controlId: string

  @Column({ name: 'relevance', type: 'varchar', length: 20 })
  relevance: FailureModeControlRelevance

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date

  @ManyToOne(() => FailureMode, (failureMode) => failureMode.failureModeControlMaps, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'failure_mode_id', referencedColumnName: 'failureModeId' })
  failureMode: FailureMode

  @ManyToOne(() => ControlPoint, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'control_id', referencedColumnName: 'controlId' })
  controlPoint: ControlPoint
}
