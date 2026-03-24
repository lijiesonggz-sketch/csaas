import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm'

export const CONTROL_PACK_TYPES = ['base', 'sector', 'scene', 'strength'] as const
export const CONTROL_PACK_MATURITY_LEVELS = ['stable', 'preview'] as const

export type ControlPackType = (typeof CONTROL_PACK_TYPES)[number]
export type ControlPackMaturityLevel = (typeof CONTROL_PACK_MATURITY_LEVELS)[number]

@Entity('control_packs')
@Unique('UQ_control_packs_pack_code', ['packCode'])
export class ControlPack {
  @PrimaryGeneratedColumn('uuid', { name: 'pack_id' })
  packId: string

  @Column({ name: 'pack_code', type: 'varchar', length: 100 })
  packCode: string

  @Column({ name: 'pack_name', type: 'varchar', length: 200 })
  packName: string

  @Column({ name: 'pack_type', type: 'varchar', length: 30 })
  packType: ControlPackType

  @Column({ name: 'maturity_level', type: 'varchar', length: 20, default: 'preview' })
  maturityLevel: ControlPackMaturityLevel

  @Column({ type: 'int', default: 100 })
  priority: number

  @Column({ type: 'text', nullable: true })
  description?: string | null

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status: string

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date
}
