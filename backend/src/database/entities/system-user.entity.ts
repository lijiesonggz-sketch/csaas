import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm'

export enum SystemUserType {
  SYSTEM = 'SYSTEM',
  SERVICE = 'SERVICE',
}

@Entity('system_users')
export class SystemUser {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  email: string

  @Column()
  name: string

  @Column({
    type: 'enum',
    enum: SystemUserType,
    default: SystemUserType.SYSTEM,
  })
  type: SystemUserType

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date
}
