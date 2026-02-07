import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { RadarPush } from './radar-push.entity';
import { User } from './user.entity';

/**
 * PushFeedback Entity
 *
 * Stores user feedback (ratings and comments) for radar pushes.
 * Used for content quality management and optimization.
 *
 * @entity push_feedback
 * @story 7-2
 * @module backend/src/database/entities
 */
@Entity('push_feedback')
@Index(['pushId', 'userId'])
@Index(['rating'])
@Index(['createdAt'])
export class PushFeedback {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Associated push ID
   */
  @Column({ type: 'uuid', name: 'push_id' })
  @Index()
  pushId: string;

  @ManyToOne(() => RadarPush, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'push_id' })
  push: RadarPush;

  /**
   * User who submitted the feedback
   */
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /**
   * Rating from 1 to 5 stars
   */
  @Column({ type: 'int' })
  rating: number;

  /**
   * Optional comment/feedback text
   */
  @Column({ type: 'text', nullable: true })
  comment: string | null;

  /**
   * Feedback submission timestamp
   */
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
