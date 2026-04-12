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
import { TaxonomyL2 } from './taxonomy-l2.entity'
import { FailureMode } from './failure-mode.entity'

@Entity('taxonomy_failure_mode_maps')
@Unique('UQ_tfm_l2_code_failure_mode_id', ['l2Code', 'failureModeId'])
export class TaxonomyFailureModeMap {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'l2_code', type: 'varchar', length: 20 })
  l2Code: string

  @Column({ name: 'failure_mode_id', type: 'uuid' })
  failureModeId: string

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date

  @ManyToOne(() => TaxonomyL2, (taxonomyL2) => taxonomyL2.taxonomyFailureModeMaps, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'l2_code', referencedColumnName: 'l2Code' })
  taxonomyL2: TaxonomyL2

  @ManyToOne(() => FailureMode, (failureMode) => failureMode.taxonomyFailureModeMaps, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'failure_mode_id', referencedColumnName: 'failureModeId' })
  failureMode: FailureMode
}
