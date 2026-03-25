import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm'
import { ControlPack } from './control-pack.entity'
import { ControlPoint } from './control-point.entity'

export const CONTROL_PACK_ITEM_ROLES = ['INCLUDE', 'RECOMMEND', 'STRENGTHEN'] as const
export type ControlPackItemRole = (typeof CONTROL_PACK_ITEM_ROLES)[number]

@Entity('control_pack_items')
@Unique('UQ_control_pack_items_pack_control', ['packId', 'controlId'])
export class ControlPackItem {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'pack_id', type: 'uuid' })
  packId: string

  @Column({ name: 'control_id', type: 'uuid' })
  controlId: string

  @Column({ name: 'item_role', type: 'varchar', length: 20, default: 'INCLUDE' })
  itemRole: ControlPackItemRole

  @Column({ type: 'int', default: 100 })
  priority: number

  @ManyToOne(() => ControlPack, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'pack_id', referencedColumnName: 'packId' })
  controlPack: ControlPack

  @ManyToOne(() => ControlPoint, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'control_id', referencedColumnName: 'controlId' })
  controlPoint: ControlPoint
}
