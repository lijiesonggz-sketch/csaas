import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Add radarActivated column to organizations table
 *
 * This migration adds the `radar_activated` boolean field to track whether
 * an organization has completed the Radar Service onboarding process.
 *
 * Story 1.4 - AC 6: 引导完成和雷达激活
 */
export class AddRadarActivatedColumn1768700000000
  implements MigrationInterface
{
  name = 'AddRadarActivatedColumn1768700000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "organizations"
      ADD COLUMN "radar_activated" boolean NOT NULL DEFAULT false
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "organizations"
      DROP COLUMN "radar_activated"
    `)
  }
}
