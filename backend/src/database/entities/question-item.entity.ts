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

export const QUESTION_ITEM_TYPES = [
  'YES_NO',
  'SINGLE_CHOICE',
  'MULTIPLE_CHOICE',
  'RATING',
  'TEXT',
] as const
export type QuestionItemType = (typeof QUESTION_ITEM_TYPES)[number]

export const QUESTION_ITEM_STATUSES = ['ACTIVE', 'INACTIVE'] as const
export type QuestionItemStatus = (typeof QUESTION_ITEM_STATUSES)[number]

@Entity('question_items')
@Unique('UQ_question_items_question_code', ['questionCode'])
export class QuestionItem {
  @PrimaryGeneratedColumn('uuid', { name: 'question_id' })
  questionId: string

  @Column({ name: 'question_code', type: 'varchar', length: 100 })
  questionCode: string

  @Column({ name: 'control_id', type: 'uuid' })
  controlId: string

  @Column({ name: 'question_text', type: 'text' })
  questionText: string

  @Column({ name: 'question_type', type: 'varchar', length: 30 })
  questionType: QuestionItemType

  @Column({ name: 'role_hint', type: 'jsonb', nullable: true })
  roleHint: string[] | null

  @Column({ name: 'answer_schema', type: 'jsonb', nullable: true })
  answerSchema: Record<string, unknown> | null

  @Column({ name: 'scoring_json', type: 'jsonb', nullable: true })
  scoringRule: Record<string, unknown> | null

  @Column({ name: 'applicable_tags', type: 'jsonb', nullable: true })
  applicableTags: string[] | null

  @Column({ type: 'boolean', default: true })
  required: boolean

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status: QuestionItemStatus

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date

  @ManyToOne(() => ControlPoint, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'control_id', referencedColumnName: 'controlId' })
  controlPoint: ControlPoint
}
