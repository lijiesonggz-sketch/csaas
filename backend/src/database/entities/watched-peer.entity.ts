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
  @Column({ name: 'name', type: 'varchar', length: 100 })
  peerName: string

  /**
   * Industry classification
   *
   * Supports multi-industry SaaS architecture:
   * - banking: 银行业
   * - securities: 证券业
   * - insurance: 保险业
   * - enterprise: 传统企业
   */
  @Column({ name: 'industry', type: 'varchar', length: 50 })
  industry: string

  /**
   * Institution type within the industry
   *
   * Examples:
   * - Banking: 城商行, 股份制银行, 互联网银行, 国有大行, 农商行
   * - Securities: 券商, 基金公司, 期货公司
   * - Insurance: 寿险公司, 财险公司, 再保险公司
   * - Enterprise: 制造业, 零售业, 物流业, 能源企业
   */
  @Column({ name: 'institution_type', type: 'varchar', length: 100 })
  institutionType: string

  /**
   * Optional description of the peer institution
   */
  @Column({ type: 'text', nullable: true })
  description: string

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
   * 租户ID（咨询公司）
   *
   * 用于多租户数据隔离，确保咨询公司 A 的数据对咨询公司 B 不可见
   *
   * @story Story 6.1A - Multi-tenant API/Service Layer Isolation
   */
  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string

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
