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
import { ControlPoint } from './control-point.entity'
import { RegulationObligation } from './regulation-obligation.entity'

export const OBLIGATION_COVERAGES = ['FULL', 'PARTIAL'] as const
export type ObligationCoverage = (typeof OBLIGATION_COVERAGES)[number]

@Entity('obligation_control_maps')
@Unique('UQ_ocm_obligation_id_control_id', ['obligationId', 'controlId'])
export class ObligationControlMap {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'obligation_id', type: 'uuid' })
  obligationId: string

  @Column({ name: 'control_id', type: 'uuid' })
  controlId: string

  @Column({ name: 'coverage', type: 'varchar', length: 20, default: 'FULL' })
  coverage: ObligationCoverage

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date

  @ManyToOne(() => RegulationObligation, (obligation) => obligation.obligationControlMaps, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'obligation_id', referencedColumnName: 'obligationId' })
  obligation: RegulationObligation

  @ManyToOne(() => ControlPoint, (controlPoint) => controlPoint.obligationControlMaps, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'control_id', referencedColumnName: 'controlId' })
  controlPoint: ControlPoint
}
