import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm'
import { ApplicableSector } from './control-point.entity'
import { ObligationControlMap } from './obligation-control-map.entity'
import { RegulationClause } from './regulation-clause.entity'

export const OBLIGATION_TYPES = ['MANDATORY', 'PROHIBITIVE', 'RECOMMENDED'] as const
export type ObligationType = (typeof OBLIGATION_TYPES)[number]

export const OBLIGATION_STATUSES = ['ACTIVE', 'INACTIVE'] as const
export type ObligationStatus = (typeof OBLIGATION_STATUSES)[number]

@Entity('regulation_obligations')
@Unique('UQ_regulation_obligations_obligation_code', ['obligationCode'])
export class RegulationObligation {
  @PrimaryGeneratedColumn('uuid', { name: 'obligation_id' })
  obligationId: string

  @Column({ name: 'clause_id', type: 'uuid' })
  clauseId: string

  @Column({ name: 'obligation_code', type: 'varchar', length: 50 })
  obligationCode: string

  @Column({ name: 'obligation_text', type: 'text' })
  obligationText: string

  @Column({ name: 'obligation_type', type: 'varchar', length: 30, default: 'MANDATORY' })
  obligationType: ObligationType

  @Column({ name: 'applicable_sector', type: 'varchar', length: 50, array: true, default: '{}' })
  applicableSector: ApplicableSector[]

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'ACTIVE' })
  status: ObligationStatus

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date

  @ManyToOne(() => RegulationClause, (clause) => clause.obligations, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'clause_id', referencedColumnName: 'clauseId' })
  clause: RegulationClause

  @OneToMany(() => ObligationControlMap, (map) => map.obligation)
  obligationControlMaps: ObligationControlMap[]
}