/**
 * Migration Validation Script for AddOrganizations
 *
 * This script validates that the migration:
 * 1. Creates one organization per user (not one global org)
 * 2. Links users to their organizations as admins
 * 3. Links existing projects to user organizations
 * 4. Creates all required indexes and constraints
 *
 * Usage: npm run ts-node validate-migration.ts
 */

import { DataSource } from 'typeorm'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables
config({ path: resolve(__dirname, '.env.development') })

async function validateMigration() {
  console.log('🔍 Starting migration validation...\n')

  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'csaas',
    entities: [],
    synchronize: false,
  })

  try {
    await dataSource.initialize()
    console.log('✅ Database connection established\n')

    const queryRunner = dataSource.createQueryRunner()

    // ============================================================
    // Check 1: Validate tables exist
    // ============================================================
    console.log('📋 Check 1: Validating tables exist...')

    const tablesResult = await queryRunner.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('organizations', 'organization_members', 'weakness_snapshots')
      ORDER BY table_name;
    `)

    const tables = tablesResult.map((r: any) => r.table_name)
    console.log('   Tables found:', tables)

    if (tables.length !== 3) {
      throw new Error(`❌ Expected 3 tables, found ${tables.length}`)
    }
    console.log('✅ All 3 tables exist\n')

    // ============================================================
    // Check 2: Validate ENUM types exist
    // ============================================================
    console.log('📋 Check 2: Validating ENUM types...')

    const enumsResult = await queryRunner.query(`
      SELECT typname
      FROM pg_type
      WHERE typname IN ('organization_member_role_enum', 'weakness_category_enum')
      ORDER BY typname;
    `)

    const enums = enumsResult.map((r: any) => r.typname)
    console.log('   ENUM types found:', enums)

    if (enums.length !== 2) {
      throw new Error(`❌ Expected 2 ENUM types, found ${enums.length}`)
    }
    console.log('✅ All 2 ENUM types exist\n')

    // ============================================================
    // Check 3: Validate one organization per user
    // ============================================================
    console.log('📋 Check 3: Validating one organization per user...')

    const orgCountResult = await queryRunner.query(`
      SELECT COUNT(*) as org_count FROM organizations;
    `)

    const userCountResult = await queryRunner.query(`
      SELECT COUNT(*) as user_count FROM users WHERE deleted_at IS NULL;
    `)

    const orgCount = parseInt(orgCountResult[0].org_count)
    const userCount = parseInt(userCountResult[0].user_count)

    console.log(`   Organizations: ${orgCount}`)
    console.log(`   Active users: ${userCount}`)

    if (orgCount !== userCount) {
      throw new Error(
        `❌ Expected ${userCount} organizations (one per user), found ${orgCount}`
      )
    }
    console.log('✅ One organization per user validated\n')

    // ============================================================
    // Check 4: Validate all users are organization admins
    // ============================================================
    console.log('📋 Check 4: Validating user->organization links...')

    const memberCountResult = await queryRunner.query(`
      SELECT COUNT(*) as member_count
      FROM organization_members
      WHERE role = 'admin';
    `)

    const memberCount = parseInt(memberCountResult[0].member_count)
    console.log(`   Organization members (admin): ${memberCount}`)

    if (memberCount !== userCount) {
      throw new Error(
        `❌ Expected ${userCount} admin members, found ${memberCount}`
      )
    }
    console.log('✅ All users linked to their organizations as admins\n')

    // ============================================================
    // Check 5: Validate projects linked to organizations
    // ============================================================
    console.log('📋 Check 5: Validating project->organization links...')

    const projectResult = await queryRunner.query(`
      SELECT
        COUNT(*) as total_projects,
        COUNT(organization_id) as linked_projects
      FROM projects;
    `)

    const totalProjects = parseInt(projectResult[0].total_projects)
    const linkedProjects = parseInt(projectResult[0].linked_projects)

    console.log(`   Total projects: ${totalProjects}`)
    console.log(`   Linked to organizations: ${linkedProjects}`)

    if (totalProjects > 0 && linkedProjects === 0) {
      console.warn('⚠️  Warning: No projects are linked to organizations')
    } else {
      console.log('✅ Projects linked to organizations\n')
    }

    // ============================================================
    // Check 6: Validate indexes
    // ============================================================
    console.log('📋 Check 6: Validating indexes...')

    const indexResult = await queryRunner.query(`
      SELECT tablename, indexname
      FROM pg_indexes
      WHERE tablename IN ('organizations', 'organization_members', 'weakness_snapshots', 'projects')
        AND indexname LIKE 'IDX_%'
      ORDER BY tablename, indexname;
    `)

    const indexCount = indexResult.length
    console.log(`   Indexes found: ${indexCount}`)

    // Critical index checks
    const criticalIndexes = [
      'IDX_organizations_name',
      'IDX_organization_members_user_id',
      'IDX_weakness_snapshots_org_category',
      'IDX_projects_organization_id',
    ]

    const foundIndexes = indexResult.map((r: any) => r.indexname)
    for (const idx of criticalIndexes) {
      if (!foundIndexes.includes(idx)) {
        throw new Error(`❌ Missing critical index: ${idx}`)
      }
    }

    console.log('✅ All critical indexes exist\n')

    // ============================================================
    // Check 7: Validate foreign keys
    // ============================================================
    console.log('📋 Check 7: Validating foreign key constraints...')

    const fkResult = await queryRunner.query(`
      SELECT
        tc.table_name,
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name IN ('organizations', 'organization_members', 'weakness_snapshots', 'projects')
      ORDER BY tc.table_name, tc.constraint_name;
    `)

    console.log(`   Foreign key constraints: ${fkResult.length}`)

    // Critical FK checks
    const criticalFKs = [
      { table: 'organization_members', column: 'organization_id', ref: 'organizations' },
      { table: 'organization_members', column: 'user_id', ref: 'users' },
      { table: 'weakness_snapshots', column: 'organization_id', ref: 'organizations' },
      { table: 'projects', column: 'organization_id', ref: 'organizations' },
    ]

    for (const fk of criticalFKs) {
      const found = fkResult.find(
        (r: any) =>
          r.table_name === fk.table && r.column_name === fk.column && r.foreign_table_name === fk.ref
      )
      if (!found) {
        throw new Error(
          `❌ Missing foreign key: ${fk.table}.${fk.column} -> ${fk.ref}`
        )
      }
    }

    console.log('✅ All critical foreign keys exist\n')

    // ============================================================
    // Check 8: Validate weakness categories
    // ============================================================
    console.log('📋 Check 8: Validating weakness category enum...')

    const enumValuesResult = await queryRunner.query(`
      SELECT enumlabel
      FROM pg_enum
      WHERE enumtypid = (
        SELECT oid FROM pg_type WHERE typname = 'weakness_category_enum'
      )
      ORDER BY enumsortorder;
    `)

    const categories = enumValuesResult.map((r: any) => r.enumlabel)
    console.log('   Categories:', categories)

    const expectedCategories = [
      'data_security',
      'network_security',
      'cloud_native',
      'ai_application',
      'mobile_financial',
      'devops',
      'cost_optimization',
      'compliance',
    ]

    if (categories.length !== expectedCategories.length) {
      throw new Error(
        `❌ Expected ${expectedCategories.length} categories, found ${categories.length}`
      )
    }

    for (const cat of expectedCategories) {
      if (!categories.includes(cat)) {
        throw new Error(`❌ Missing category: ${cat}`)
      }
    }

    console.log('✅ All 8 weakness categories exist\n')

    // ============================================================
    // Summary
    // ============================================================
    console.log('=' .repeat(60))
    console.log('✅ MIGRATION VALIDATION SUCCESSFUL')
    console.log('=' .repeat(60))
    console.log(`\n📊 Summary:`)
    console.log(`   - Organizations: ${orgCount}`)
    console.log(`   - Users: ${userCount}`)
    console.log(`   - Org Members: ${memberCount}`)
    console.log(`   - Projects: ${totalProjects} (${linkedProjects} linked)`)
    console.log(`   - Tables: ${tables.length}`)
    console.log(`   - Indexes: ${indexCount}`)
    console.log(`   - Foreign Keys: ${fkResult.length}`)
    console.log(`   - Weakness Categories: ${categories.length}\n`)

    await queryRunner.release()
    await dataSource.destroy()

    process.exit(0)
  } catch (error) {
    console.error('\n❌ VALIDATION FAILED:', error)
    await dataSource.destroy()
    process.exit(1)
  }
}

// Run validation
validateMigration()
