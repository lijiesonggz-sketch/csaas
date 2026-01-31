import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddCompliancePlaybookFieldsToRadarPush1738300000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add compliance playbook fields to radar_pushes table
    await queryRunner.addColumns('radar_pushes', [
      new TableColumn({
        name: 'checklistCompletedAt',
        type: 'timestamp',
        isNullable: true,
      }),
      new TableColumn({
        name: 'playbookStatus',
        type: 'enum',
        enum: ['ready', 'generating', 'failed'],
        isNullable: true,
        default: "'ready'",
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove compliance playbook fields from radar_pushes table
    await queryRunner.dropColumn('radar_pushes', 'checklistCompletedAt');
    await queryRunner.dropColumn('radar_pushes', 'playbookStatus');
  }
}
