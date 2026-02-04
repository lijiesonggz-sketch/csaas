import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddSourceTypeToActionPlanMeasures1738650000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 创建枚举类型
    await queryRunner.query(`
      CREATE TYPE action_plan_measure_source_type_enum AS ENUM (
        'MATURITY_GAP',
        'BINARY_GAP',
        'QUICK_GAP'
      );
    `);

    // 添加 source_type 列
    await queryRunner.addColumn(
      'action_plan_measures',
      new TableColumn({
        name: 'source_type',
        type: 'action_plan_measure_source_type_enum',
        isNullable: true,
      }),
    );

    // 为现有数据设置默认值为 MATURITY_GAP（原有的成熟度差距分析）
    await queryRunner.query(`
      UPDATE action_plan_measures
      SET source_type = 'MATURITY_GAP'
      WHERE source_type IS NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 删除列
    await queryRunner.dropColumn('action_plan_measures', 'source_type');

    // 删除枚举类型
    await queryRunner.query(`
      DROP TYPE IF EXISTS action_plan_measure_source_type_enum;
    `);
  }
}
