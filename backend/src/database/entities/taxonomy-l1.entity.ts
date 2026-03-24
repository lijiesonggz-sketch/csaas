import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm'
import { TaxonomyL2 } from './taxonomy-l2.entity'
import { ControlPoint } from './control-point.entity'

export const TAXONOMY_STATUSES = ['ACTIVE', 'INACTIVE'] as const
export type TaxonomyStatus = (typeof TAXONOMY_STATUSES)[number]

@Entity('taxonomy_l1')
export class TaxonomyL1 {
  @PrimaryColumn({ name: 'l1_code', type: 'varchar', length: 20 })
  l1Code: string

  @Column({ name: 'l1_name', type: 'varchar', length: 200 })
  l1Name: string

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status: TaxonomyStatus

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date

  @OneToMany(() => TaxonomyL2, (taxonomyL2) => taxonomyL2.parent)
  children: TaxonomyL2[]

  @OneToMany(() => ControlPoint, (controlPoint) => controlPoint.taxonomyL1)
  controlPoints: ControlPoint[]
}
