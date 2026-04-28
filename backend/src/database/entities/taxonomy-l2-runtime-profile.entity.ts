import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm'
import { TaxonomyL2 } from './taxonomy-l2.entity'

@Entity('taxonomy_l2_runtime_profiles')
@Index('idx_taxonomy_runtime_profiles_source_version', ['sourceVersion'])
export class TaxonomyL2RuntimeProfile {
  @PrimaryColumn({ name: 'l2_code', type: 'varchar', length: 20 })
  l2Code: string

  @Column({ name: 'definition', type: 'text', default: '' })
  definition: string

  @Column({ name: 'canonical_theme', type: 'varchar', length: 200, default: '' })
  canonicalTheme: string

  @Column({ name: 'aliases_json', type: 'jsonb', default: () => "'[]'::jsonb" })
  aliasesJson: string[]

  @Column({ name: 'keywords_json', type: 'jsonb', default: () => "'[]'::jsonb" })
  keywordsJson: string[]

  @Column({ name: 'source_version', type: 'varchar', length: 50 })
  sourceVersion: string

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date

  @OneToOne(() => TaxonomyL2, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'l2_code', referencedColumnName: 'l2Code' })
  taxonomyL2: TaxonomyL2
}
