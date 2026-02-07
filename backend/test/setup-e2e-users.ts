import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from '../src/database/entities/user.entity';
import { Tenant } from '../src/database/entities/tenant.entity';
import { AppDataSource } from '../src/config/typeorm.config';

/**
 * E2E Test Users Setup Script
 *
 * Creates test users required for Playwright E2E tests.
 * Run this script before running E2E tests.
 *
 * Usage: npx ts-node test/setup-e2e-users.ts
 */
async function setupE2ETestUsers() {
  console.log('🚀 Starting E2E test users setup...\n');

  try {
    // Initialize database connection
    await AppDataSource.initialize();
    console.log('✅ Database connection established\n');

    const userRepo = AppDataSource.getRepository(User);
    const tenantRepo = AppDataSource.getRepository(Tenant);

    // Create or get test tenant
    let testTenant = await tenantRepo.findOne({ where: { name: 'E2E Test Tenant' } });
    if (!testTenant) {
      testTenant = await tenantRepo.save({
        name: 'E2E Test Tenant',
      });
      console.log('✅ Created test tenant:', testTenant.name);
    } else {
      console.log('ℹ️  Test tenant already exists:', testTenant.name);
    }

    // Create admin user - admin@test.com
    let admin1 = await userRepo.findOne({ where: { email: 'admin@test.com' } });
    if (!admin1) {
      admin1 = await userRepo.save({
        email: 'admin@test.com',
        name: 'Test Admin',
        passwordHash: await bcrypt.hash('admin123', 10),
        role: UserRole.ADMIN,
        tenantId: testTenant.id,
      });
      console.log('✅ Created admin user: admin@test.com / admin123');
    } else {
      // Update password in case it changed
      admin1.passwordHash = await bcrypt.hash('admin123', 10);
      await userRepo.save(admin1);
      console.log('ℹ️  Admin user already exists: admin@test.com (password updated)');
    }

    // Create admin user - admin@example.com
    let admin2 = await userRepo.findOne({ where: { email: 'admin@example.com' } });
    if (!admin2) {
      admin2 = await userRepo.save({
        email: 'admin@example.com',
        name: 'Example Admin',
        passwordHash: await bcrypt.hash('password', 10),
        role: UserRole.ADMIN,
        tenantId: testTenant.id,
      });
      console.log('✅ Created admin user: admin@example.com / password');
    } else {
      // Update password in case it changed
      admin2.passwordHash = await bcrypt.hash('password', 10);
      await userRepo.save(admin2);
      console.log('ℹ️  Admin user already exists: admin@example.com (password updated)');
    }

    // Create regular user - user@example.com
    let regularUser = await userRepo.findOne({ where: { email: 'user@example.com' } });
    if (!regularUser) {
      regularUser = await userRepo.save({
        email: 'user@example.com',
        name: 'Regular User',
        passwordHash: await bcrypt.hash('password', 10),
        role: UserRole.CLIENT_PM,
        tenantId: testTenant.id,
      });
      console.log('✅ Created regular user: user@example.com / password');
    } else {
      // Update password in case it changed
      regularUser.passwordHash = await bcrypt.hash('password', 10);
      await userRepo.save(regularUser);
      console.log('ℹ️  Regular user already exists: user@example.com (password updated)');
    }

    console.log('\n✅ E2E test users setup completed successfully!\n');
    console.log('📋 Test Users Summary:');
    console.log('   - admin@test.com / admin123 (ADMIN)');
    console.log('   - admin@example.com / password (ADMIN)');
    console.log('   - user@example.com / password (CLIENT_PM)\n');

  } catch (error) {
    console.error('❌ Error setting up E2E test users:', error);
    process.exit(1);
  } finally {
    // Close database connection
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      console.log('✅ Database connection closed');
    }
  }
}

// Run the setup
setupE2ETestUsers()
  .then(() => {
    console.log('\n🎉 Setup complete! You can now run E2E tests.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Setup failed:', error);
    process.exit(1);
  });
