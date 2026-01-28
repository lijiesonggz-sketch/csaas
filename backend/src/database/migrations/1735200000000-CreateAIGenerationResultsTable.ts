import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm'

export class CreateAIGenerationResultsTable1735200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 创建枚举类型
    await queryRunner.query(`
      CREATE TYPE "public"."ai_generation_results_review_status_enum" AS ENUM(
        'pending',
        'approved',
        'modified',
        'rejected'
      )
    `)

    await queryRunner.query(`
      CREATE TYPE "public"."ai_generation_results_confidence_level_enum" AS ENUM(
        'high',
        'medium',
        'low'
      )
    `)

    await queryRunner.query(`
      CREATE TYPE "public"."ai_generation_results_selected_model_enum" AS ENUM(
        'gpt4',
        'claude',
        'domestic'
      )
    `)

    // 创建ai_generation_results表
    await queryRunner.createTable(
      new Table({
        name: 'ai_generation_results',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'task_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'generation_type',
            type: 'enum',
            enum: ['summary', 'clustering', 'matrix', 'questionnaire', 'action_plan'],
            isNullable: false,
          },
          // AI生成的原始结果
          {
            name: 'gpt4_result',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'claude_result',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'domestic_result',
            type: 'jsonb',
            isNullable: true,
          },
          // 质量验证结果
          {
            name: 'quality_scores',
            type: 'jsonb',
            isNullable: true,
            comment: 'Structure: { structural: number, semantic: number, detail: number }',
          },
          {
            name: 'consistency_report',
            type: 'jsonb',
            isNullable: true,
            comment: 'Structure: { agreements: string[], disagreements: string[] }',
          },
          {
            name: 'coverage_report',
            type: 'jsonb',
            isNullable: true,
            comment: 'Structure: { covered: string[], missing: string[], coverageRate: number }',
          },
          // 最终选择的结果
          {
            name: 'selected_result',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'selected_model',
            type: '"ai_generation_results_selected_model_enum"',
            isNullable: true,
          },
          {
            name: 'confidence_level',
            type: '"ai_generation_results_confidence_level_enum"',
            isNullable: true,
          },
          // 人工审核状态
          {
            name: 'review_status',
            type: '"ai_generation_results_review_status_enum"',
            default: "'pending'",
          },
          {
            name: 'reviewed_by',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'reviewed_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'modified_result',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'review_notes',
            type: 'text',
            isNullable: true,
          },
          // 版本控制
          {
            name: 'version',
            type: 'integer',
            default: 1,
          },
          // 时间戳
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true,
    )

    // 创建外键
    await queryRunner.createForeignKey(
      'ai_generation_results',
      new TableForeignKey({
        columnNames: ['task_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'ai_tasks',
        onDelete: 'CASCADE',
      }),
    )

    await queryRunner.createForeignKey(
      'ai_generation_results',
      new TableForeignKey({
        columnNames: ['reviewed_by'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
    )

    // 创建索引
    await queryRunner.createIndex(
      'ai_generation_results',
      new TableIndex({
        name: 'IDX_ai_generation_results_task_id',
        columnNames: ['task_id'],
      }),
    )

    await queryRunner.createIndex(
      'ai_generation_results',
      new TableIndex({
        name: 'IDX_ai_generation_results_generation_type',
        columnNames: ['generation_type'],
      }),
    )

    await queryRunner.createIndex(
      'ai_generation_results',
      new TableIndex({
        name: 'IDX_ai_generation_results_review_status',
        columnNames: ['review_status'],
      }),
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 删除索引
    await queryRunner.dropIndex('ai_generation_results', 'IDX_ai_generation_results_review_status')
    await queryRunner.dropIndex(
      'ai_generation_results',
      'IDX_ai_generation_results_generation_type',
    )
    await queryRunner.dropIndex('ai_generation_results', 'IDX_ai_generation_results_task_id')

    // 删除表
    await queryRunner.dropTable('ai_generation_results')

    // 删除枚举类型
    await queryRunner.query(`DROP TYPE "public"."ai_generation_results_selected_model_enum"`)
    await queryRunner.query(`DROP TYPE "public"."ai_generation_results_confidence_level_enum"`)
    await queryRunner.query(`DROP TYPE "public"."ai_generation_results_review_status_enum"`)
  }
}
