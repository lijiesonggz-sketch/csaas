import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm'

import { Organization } from './organization.entity'

/**
 * WatchedPeer Entity
 *
 * Represents a peer institution (bank/organization) that an organization wants
 * to monitor for benchmarking and learning in Radar Service. Users select
 * peers during onboarding (AC 5) and can modify them later.
 *
 * Examples: "杭州银行", "绍兴银行", "招商银行"
 *
 * @table watched_peers
 * @module backend/src/database/entities/watched-peer.entity
 */
@Entity('watched_peers')
export class WatchedPeer {
  /**
   * Primary key - UUID v4
   */
  @PrimaryGeneratedColumn('uuid')
  id: string

  /**
   * Peer institution name
   *
   * The name of the peer organization to monitor for industry trends,
   * best practices, and benchmarking.
   *
   * @example "杭州银行", "绍兴银行", "招商银行"
   */
  @Column({ type: 'varchar' })
  name: string

  /**
   * Peer type (Story 3.2)
   * - benchmark: 标杆机构(学习对象)
   * - competitor: 竞争对手(监控对象)
   */
  @Column({
    type: 'enum',
    enum: ['benchmark', 'competitor'],
    default: 'benchmark',
  })
  peerType: 'benchmark' | 'competitor'

  /**
   * Organization that watches this peer
   *
   * Many watched peers can belong to one organization.
   */
  @ManyToOne(() => Organization, (org) => org.watchedPeers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization

  /**
   * Organization ID foreign key
   */
  @Column({ name: 'organization_id' })
  organizationId: string

  /**
   * Timestamp when peer was added
   */
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  /**
   * Timestamp when peer was last updated
   */
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date

  /**
   * Soft delete timestamp
   */
  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date
}
