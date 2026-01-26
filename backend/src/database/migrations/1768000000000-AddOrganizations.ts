import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddOrganizations1768000000000 implements MigrationInterface {
  name = 'AddOrganizations1768000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================================
    // STEP 1: Create ENUM types
    // ============================================================

    // Create organization_member_role_enum
    await queryRunner.query(`
      CREATE TYPE "organization_member_role_enum" AS ENUM ('admin', 'member');
    `)

    // Create weakness_category_enum (8 predefined categories from Csaas assessment standards)
    await queryRunner.query(`
      CREATE TYPE "weakness_category_enum" AS ENUM (
        'data_security',
        'network_security',
        'cloud_native',
        'ai_application',
        'mobile_financial',
        'devops',
        'cost_optimization',
        'compliance'
      );
    `)

    // ============================================================
    // STEP 2: Create organizations table
    // ============================================================

    await queryRunner.query(`
      CREATE TABLE "organizations" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP
      )
    `)

    // Create indexes for organizations
    await queryRunner.query(`
      CREATE INDEX "IDX_organizations_name" ON "organizations" ("name");
      CREATE INDEX "IDX_organizations_created_at" ON "organizations" ("created_at");
      CREATE INDEX "IDX_organizations_deleted_at" ON "organizations" ("deleted_at");
    `)

    // ============================================================
    // STEP 3: Create organization_members table
    // ============================================================

    await queryRunner.query(`
      CREATE TABLE "organization_members" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "role" "organization_member_role_enum" NOT NULL DEFAULT 'member',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_organization_members_organization" FOREIGN KEY ("organization_id")
          REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_organization_members_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_organization_members_org_user" UNIQUE ("organization_id", "user_id")
      )
    `)

    // Create indexes for organization_members
    await queryRunner.query(`
      CREATE INDEX "IDX_organization_members_organization_id" ON "organization_members" ("organization_id");
      CREATE INDEX "IDX_organization_members_user_id" ON "organization_members" ("user_id");
      CREATE INDEX "IDX_organization_members_role" ON "organization_members" ("role");
    `)

    // ============================================================
    // STEP 4: Create weakness_snapshots table
    // ============================================================

    await queryRunner.query(`
      CREATE TABLE "weakness_snapshots" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "project_id" uuid,
        "category" "weakness_category_enum" NOT NULL,
        "level" integer NOT NULL CHECK (level >= 1 AND level <= 5),
        "description" text,
        "project_ids" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_weakness_snapshots_organization" FOREIGN KEY ("organization_id")
          REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_weakness_snapshots_project" FOREIGN KEY ("project_id")
          REFERENCES "projects"("id") ON DELETE CASCADE
      )
    `)

    // Create indexes for weakness_snapshots
    await queryRunner.query(`
      CREATE INDEX "IDX_weakness_snapshots_organization_id" ON "weakness_snapshots" ("organization_id");
      CREATE INDEX "IDX_weakness_snapshots_project_id" ON "weakness_snapshots" ("project_id");
      CREATE INDEX "IDX_weakness_snapshots_category" ON "weakness_snapshots" ("category");
    `)

    // Composite index for aggregation queries (CRITICAL for performance)
    await queryRunner.query(`
      CREATE INDEX "IDX_weakness_snapshots_org_category" ON "weakness_snapshots" ("organization_id", "category");
    `)

    // ============================================================
    // STEP 5: Add organization_id column to projects table
    // ============================================================

    await queryRunner.query(`
      ALTER TABLE "projects"
      ADD COLUMN "organization_id" uuid;
    `)

    // Add foreign key constraint for projects.organization_id
    await queryRunner.query(`
      ALTER TABLE "projects"
      ADD CONSTRAINT "FK_projects_organization"
      FOREIGN KEY ("organization_id")
      REFERENCES "organizations"("id")
      ON DELETE CASCADE;
    `)

    // Create index for projects.organization_id
    await queryRunner.query(`
      CREATE INDEX "IDX_projects_organization_id" ON "projects" ("organization_id");
    `)

    // ============================================================
    // STEP 6: DATA MIGRATION - Create one organization per user
    // ============================================================
    // CRITICAL: Each existing user gets their own organization
    // NOT one global organization for all users

    console.log('Starting data migration: Creating organizations for existing users...')

    // Step 6.1: Create a temporary table to store user->organization mapping
    await queryRunner.query(`
      CREATE TEMP TABLE temp_user_org_mapping (
        user_id uuid PRIMARY KEY,
        org_id uuid NOT NULL,
        created_at TIMESTAMP NOT NULL
      );
    `)

    // Step 6.2: Generate organization IDs for each user
    await queryRunner.query(`
      INSERT INTO temp_user_org_mapping (user_id, org_id, created_at)
      SELECT
        u.id as user_id,
        uuid_generate_v4() as org_id,
        u.created_at
      FROM users u
      WHERE u.deleted_at IS NULL;
    `)

    console.log('User->organization mapping created')

    // Step 6.3: Create organizations using the mapping
    await queryRunner.query(`
      INSERT INTO organizations (id, name, created_at, updated_at)
      SELECT
        m.org_id,
        '用户的组织',  -- Default organization name
        m.created_at,
        m.created_at
      FROM temp_user_org_mapping m;
    `)

    console.log('Organizations created for each user')

    // Step 6.4: Insert organization_members to link users to their organizations
    await queryRunner.query(`
      INSERT INTO organization_members (id, organization_id, user_id, role, created_at)
      SELECT
        uuid_generate_v4() as id,
        m.org_id as organization_id,
        m.user_id as user_id,
        'admin' as role,  -- User is admin of their own organization
        m.created_at as created_at
      FROM temp_user_org_mapping m
      ON CONFLICT ("organization_id", "user_id") DO NOTHING;
    `)

    console.log('Users linked to their organizations as admins')

    // Step 6.5: Clean up temporary table
    await queryRunner.query(`
      DROP TABLE temp_user_org_mapping;
    `)

    // Step 6.6: Link existing projects to user's organization
    await queryRunner.query(`
      UPDATE projects p
      SET organization_id = om.organization_id
      FROM organization_members om
      WHERE p.owner_id = om.user_id
        AND p.organization_id IS NULL
        AND om.role = 'admin';
    `)

    console.log('Projects linked to user organizations')

    console.log('Data migration completed: Organizations created and linked')

    // ============================================================
    // STEP 7: Validate migration
    // ============================================================

    const result = await queryRunner.query(`
      SELECT
        (SELECT COUNT(*) FROM organizations) as org_count,
        (SELECT COUNT(*) FROM organization_members) as member_count,
        (SELECT COUNT(*) FROM projects WHERE organization_id IS NOT NULL) as linked_projects;
    `)

    console.log('Migration validation:', result[0])
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ============================================================
    // ROLLBACK: Reverse all changes in reverse order
    // ============================================================

    console.log('Starting rollback...')

    // STEP 7: Remove organization_id from projects (reverse of STEP 5)
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_projects_organization_id";
    `)

    await queryRunner.query(`
      ALTER TABLE "projects" DROP CONSTRAINT IF EXISTS "FK_projects_organization";
    `)

    await queryRunner.query(`
      ALTER TABLE "projects" DROP COLUMN IF EXISTS "organization_id";
    `)

    // STEP 6: Delete migrated data (automatically cleaned by CASCADE deletes above)
    console.log('Data cleaned during table drop operations')

    // STEP 4: Drop weakness_snapshots table (reverse of STEP 4)
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_weakness_snapshots_org_category";
    `)

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_weakness_snapshots_category";
    `)

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_weakness_snapshots_project_id";
    `)

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_weakness_snapshots_organization_id";
    `)

    await queryRunner.query(`
      DROP TABLE IF EXISTS "weakness_snapshots";
    `)

    // STEP 3: Drop organization_members table (reverse of STEP 3)
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_organization_members_role";
    `)

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_organization_members_user_id";
    `)

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_organization_members_organization_id";
    `)

    await queryRunner.query(`
      DROP TABLE IF EXISTS "organization_members";
    `)

    // STEP 2: Drop organizations table (reverse of STEP 2)
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_organizations_deleted_at";
    `)

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_organizations_created_at";
    `)

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_organizations_name";
    `)

    await queryRunner.query(`
      DROP TABLE IF EXISTS "organizations";
    `)

    // STEP 1: Drop ENUM types (reverse of STEP 1)
    await queryRunner.query(`
      DROP TYPE IF EXISTS "weakness_category_enum";
    `)

    await queryRunner.query(`
      DROP TYPE IF EXISTS "organization_member_role_enum";
    `)

    console.log('Rollback completed successfully')
  }
}
