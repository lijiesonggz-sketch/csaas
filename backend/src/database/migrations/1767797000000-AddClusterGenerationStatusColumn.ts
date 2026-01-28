import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddClusterGenerationStatusColumn1767797000000 implements MigrationInterface {
  name = 'AddClusterGenerationStatusColumn1767797000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 添加聚类生成状态列
    await queryRunner.query(`
            ALTER TABLE "ai_tasks"
            ADD COLUMN "cluster_generation_status" jsonb
        `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "ai_tasks" DROP COLUMN "cluster_generation_status"
        `)
  }
}
