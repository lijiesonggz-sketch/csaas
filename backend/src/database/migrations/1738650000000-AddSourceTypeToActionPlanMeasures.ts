import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm'

export class AddSourceTypeToActionPlanMeasures1738650000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE t.typname = 'action_plan_measure_source_type_enum'
            AND n.nspname = 'public'
        ) THEN
          CREATE TYPE action_plan_measure_source_type_enum AS ENUM (
            'MATURITY_GAP',
            'BINARY_GAP',
            'QUICK_GAP'
          );
        END IF;
      END $$;
    `)

    if (await queryRunner.hasTable('action_plan_measures')) {
      if (!(await queryRunner.hasColumn('action_plan_measures', 'source_type'))) {
        await queryRunner.addColumn(
          'action_plan_measures',
          new TableColumn({
            name: 'source_type',
            type: 'action_plan_measure_source_type_enum',
            isNullable: true,
          }),
        )
      }

      await queryRunner.query(`
        UPDATE action_plan_measures
        SET source_type = 'MATURITY_GAP'
        WHERE source_type IS NULL;
      `)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('action_plan_measures')) {
      if (await queryRunner.hasColumn('action_plan_measures', 'source_type')) {
        await queryRunner.dropColumn('action_plan_measures', 'source_type')
      }
    }

    await queryRunner.query(`DROP TYPE IF EXISTS action_plan_measure_source_type_enum`)
  }
}
