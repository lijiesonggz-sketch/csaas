import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateKGControlPackItems1772000000007 implements MigrationInterface {
  name = 'CreateKGControlPackItems1772000000007'

  public async up(queryRunner: QueryRunner): Promise<void> {
    const exists = await queryRunner.hasTable('control_pack_items')
    if (exists) {
      return
    }

    await queryRunner.query(`
      CREATE TABLE "control_pack_items" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "pack_id" uuid NOT NULL,
        "control_id" uuid NOT NULL,
        "item_role" character varying(20) NOT NULL DEFAULT 'INCLUDE',
        "priority" integer NOT NULL DEFAULT 100,
        CONSTRAINT "PK_control_pack_items_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_control_pack_items_pack_control" UNIQUE ("pack_id", "control_id"),
        CONSTRAINT "FK_control_pack_items_pack" FOREIGN KEY ("pack_id") REFERENCES "control_packs"("pack_id") ON DELETE RESTRICT,
        CONSTRAINT "FK_control_pack_items_control" FOREIGN KEY ("control_id") REFERENCES "control_points"("control_id") ON DELETE RESTRICT
      )
    `)
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_control_pack_items_pack" ON "control_pack_items" ("pack_id")',
    )
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_control_pack_items_control" ON "control_pack_items" ("control_id")',
    )
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_control_pack_items_role" ON "control_pack_items" ("item_role")',
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const exists = await queryRunner.hasTable('control_pack_items')
    if (!exists) {
      return
    }

    await queryRunner.query('DROP INDEX IF EXISTS "idx_control_pack_items_role"')
    await queryRunner.query('DROP INDEX IF EXISTS "idx_control_pack_items_control"')
    await queryRunner.query('DROP INDEX IF EXISTS "idx_control_pack_items_pack"')
    await queryRunner.query('DROP TABLE "control_pack_items"')
  }
}
