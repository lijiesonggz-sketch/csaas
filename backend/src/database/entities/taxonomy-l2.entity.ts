import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm'
import { ControlPoint } from './control-point.entity'
import { TaxonomyL1, TaxonomyStatus } from './taxonomy-l1.entity'

@Entity('taxonomy_l2')
export class TaxonomyL2 {
  @PrimaryColumn({ name: 'l2_code', type: 'varchar', length: 20 })
  l2Code: string

  @Column({ name: 'l1_code', type: 'varchar', length: 20 })
  l1Code: string

  @Column({ name: 'l2_name', type: 'varchar', length: 200 })
  l2Name: string

  @Column({ name: 'l2_desc', type: 'text', nullable: true })
  l2Desc: string | null

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status: TaxonomyStatus

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date

  @ManyToOne(() => TaxonomyL1, (taxonomyL1) => taxonomyL1.children, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'l1_code', referencedColumnName: 'l1Code' })
  parent: TaxonomyL1

  @OneToMany(() => ControlPoint, (controlPoint) => controlPoint.taxonomyL2)
  controlPoints: ControlPoint[]
}
