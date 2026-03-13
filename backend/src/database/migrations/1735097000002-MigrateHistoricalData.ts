import { MigrationInterface, QueryRunner } from 'typeorm'

export class MigrateHistoricalData1735097000002 implements MigrationInterface {
  name = 'MigrateHistoricalData1735097000002'

  public async up(queryRunner: QueryRunner): Promise<void> {
    const users: Array<{ id: string }> = await queryRunner.query(`SELECT "id" FROM "users" LIMIT 1`)
    if (users.length === 0) {
      return
    }

    const ownerId = users[0].id

    const existingProject: Array<{ id: string }> = await queryRunner.query(
      `SELECT "id" FROM "projects" WHERE "name" = $1 AND "owner_id" = $2 LIMIT 1`,
      ['Project Workbench', ownerId],
    )

    let projectId = existingProject[0]?.id
    if (!projectId) {
      const metadataColumn: Array<{ exists: boolean }> = await queryRunner.query(
        `
          SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'projects'
              AND column_name = 'metadata'
          ) AS "exists"
        `,
      )

      if (metadataColumn[0]?.exists) {
        const inserted: Array<{ id: string }> = await queryRunner.query(
          `
            INSERT INTO "projects" (
              "id",
              "name",
              "description",
              "client_name",
              "standard_name",
              "owner_id",
              "status",
              "metadata",
              "created_at",
              "updated_at"
            )
            VALUES (
              uuid_generate_v4(),
              'Project Workbench',
              'System bootstrap project',
              'System Tenant',
              'General Standard',
              $1,
              'completed',
              '{}'::jsonb,
              NOW(),
              NOW()
            )
            RETURNING "id"
          `,
          [ownerId],
        )
        projectId = inserted[0].id
      } else {
        const inserted: Array<{ id: string }> = await queryRunner.query(
          `
            INSERT INTO "projects" (
              "id",
              "name",
              "description",
              "client_name",
              "standard_name",
              "owner_id",
              "status",
              "created_at",
              "updated_at"
            )
            VALUES (
              uuid_generate_v4(),
              'Project Workbench',
              'System bootstrap project',
              'System Tenant',
              'General Standard',
              $1,
              'completed',
              NOW(),
              NOW()
            )
            RETURNING "id"
          `,
          [ownerId],
        )
        projectId = inserted[0].id
      }
    }

    await queryRunner.query(
      `
        INSERT INTO "project_members" ("project_id", "user_id", "role", "added_at")
        VALUES ($1, $2, 'OWNER', NOW())
        ON CONFLICT ("project_id", "user_id") DO NOTHING
      `,
      [projectId, ownerId],
    )

    await queryRunner.query(
      `
        UPDATE "ai_tasks"
        SET "project_id" = $1
        WHERE "project_id" IS NULL
      `,
      [projectId],
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "project_members"
      WHERE "project_id" IN (
        SELECT "id" FROM "projects" WHERE "name" = 'Project Workbench'
      );
    `)
  }
}
