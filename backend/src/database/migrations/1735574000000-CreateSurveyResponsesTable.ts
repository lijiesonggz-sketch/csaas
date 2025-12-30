import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm'

export class CreateSurveyResponsesTable1735574000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 创建枚举类型
    await queryRunner.query(`
      CREATE TYPE survey_status AS ENUM ('draft', 'submitted', 'completed');
    `)

    // 创建 survey_responses 表
    await queryRunner.createTable(
      new Table({
        name: 'survey_responses',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'questionnaire_task_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'respondent_name',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'respondent_email',
            type: 'varchar',
            length: '200',
            isNullable: true,
          },
          {
            name: 'respondent_department',
            type: 'varchar',
            length: '200',
            isNullable: true,
          },
          {
            name: 'respondent_position',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'survey_status',
            default: "'draft'",
          },
          {
            name: 'answers',
            type: 'jsonb',
            isNullable: false,
            default: "'{}'",
          },
          {
            name: 'progress_percentage',
            type: 'int',
            default: 0,
          },
          {
            name: 'total_score',
            type: 'float',
            isNullable: true,
          },
          {
            name: 'max_score',
            type: 'float',
            isNullable: true,
          },
          {
            name: 'started_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'submitted_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
        ],
      }),
      true,
    )

    // 添加外键约束
    await queryRunner.createForeignKey(
      'survey_responses',
      new TableForeignKey({
        columnNames: ['questionnaire_task_id'],
        referencedTableName: 'ai_tasks',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    )

    // 创建索引
    await queryRunner.query(`
      CREATE INDEX idx_survey_responses_questionnaire_task_id ON survey_responses(questionnaire_task_id);
    `)

    await queryRunner.query(`
      CREATE INDEX idx_survey_responses_status ON survey_responses(status);
    `)

    await queryRunner.query(`
      CREATE INDEX idx_survey_responses_respondent_email ON survey_responses(respondent_email);
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 删除索引
    await queryRunner.query(`DROP INDEX IF EXISTS idx_survey_responses_respondent_email;`)
    await queryRunner.query(`DROP INDEX IF EXISTS idx_survey_responses_status;`)
    await queryRunner.query(`DROP INDEX IF EXISTS idx_survey_responses_questionnaire_task_id;`)

    // 删除表（会自动删除外键）
    await queryRunner.dropTable('survey_responses')

    // 删除枚举类型
    await queryRunner.query(`DROP TYPE IF EXISTS survey_status;`)
  }
}
