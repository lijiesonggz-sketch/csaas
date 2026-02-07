import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

/**
 * Migration: Create push_feedback table
 *
 * Creates table for storing user feedback on radar pushes.
 * Supports content quality management features.
 *
 * @story 7-2
 * @module backend/src/database/migrations
 */
export class CreatePushFeedbackTable1738700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'push_feedback',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'push_id',
            type: 'uuid',
          },
          {
            name: 'user_id',
            type: 'uuid',
          },
          {
            name: 'rating',
            type: 'int',
          },
          {
            name: 'comment',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'NOW()',
          },
        ],
      }),
      true,
    );

    // Create foreign keys
    await queryRunner.createForeignKey(
      'push_feedback',
      new TableForeignKey({
        name: 'FK_push_feedback_push',
        columnNames: ['push_id'],
        referencedTableName: 'radar_pushes',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'push_feedback',
      new TableForeignKey({
        name: 'FK_push_feedback_user',
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // Create indexes
    await queryRunner.createIndex(
      'push_feedback',
      new TableIndex({
        name: 'IDX_push_feedback_push_user',
        columnNames: ['push_id', 'user_id'],
      }),
    );

    await queryRunner.createIndex(
      'push_feedback',
      new TableIndex({
        name: 'IDX_push_feedback_push_id',
        columnNames: ['push_id'],
      }),
    );

    await queryRunner.createIndex(
      'push_feedback',
      new TableIndex({
        name: 'IDX_push_feedback_rating',
        columnNames: ['rating'],
      }),
    );

    await queryRunner.createIndex(
      'push_feedback',
      new TableIndex({
        name: 'IDX_push_feedback_created_at',
        columnNames: ['created_at'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('push_feedback');
  }
}
