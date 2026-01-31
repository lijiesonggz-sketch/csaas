import { Client } from 'pg';

async function fixAnalyzedContentTable() {
  const client = new Client({
    host: '127.0.0.1',
    port: 5432,
    database: 'csaas',
    user: 'postgres',
    password: 'postgres',
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // 开始事务
    await client.query('BEGIN');

    // 1. 创建 enum 类型（如果不存在）
    try {
      await client.query(`
        CREATE TYPE analyzed_content_status_enum AS ENUM ('pending', 'success', 'failed');
      `);
      console.log('✅ Created enum type: analyzed_content_status_enum');
    } catch (error: any) {
      if (error.code === '42710') { // 类型已存在
        console.log('ℹ️  Enum type already exists: analyzed_content_status_enum');
      } else {
        throw error;
      }
    }

    // 2. 添加 categories 列
    try {
      await client.query(`
        ALTER TABLE analyzed_contents
        ADD COLUMN IF NOT EXISTS categories jsonb NOT NULL DEFAULT '[]';
      `);
      console.log('✅ Added column: categories');
    } catch (error: any) {
      console.error('❌ Error adding categories column:', error.message);
      throw error;
    }

    // 3. 添加 relevanceScore 列
    try {
      await client.query(`
        ALTER TABLE analyzed_contents
        ADD COLUMN IF NOT EXISTS "relevanceScore" float;
      `);
      console.log('✅ Added column: relevanceScore');
    } catch (error: any) {
      console.error('❌ Error adding relevanceScore column:', error.message);
      throw error;
    }

    // 4. 添加 status 列
    try {
      await client.query(`
        ALTER TABLE analyzed_contents
        ADD COLUMN IF NOT EXISTS "status" analyzed_content_status_enum NOT NULL DEFAULT 'pending';
      `);
      console.log('✅ Added column: status');
    } catch (error: any) {
      console.error('❌ Error adding status column:', error.message);
      throw error;
    }

    // 5. 添加 errorMessage 列
    try {
      await client.query(`
        ALTER TABLE analyzed_contents
        ADD COLUMN IF NOT EXISTS "errorMessage" text;
      `);
      console.log('✅ Added column: errorMessage');
    } catch (error: any) {
      console.error('❌ Error adding errorMessage column:', error.message);
      throw error;
    }

    // 提交事务
    await client.query('COMMIT');
    console.log('\n✅ All columns added successfully!');

    // 验证修改
    const result = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'analyzed_contents'
      ORDER BY ordinal_position;
    `);

    console.log('\n📋 Updated table structure:');
    console.log('='.repeat(60));
    result.rows.forEach(row => {
      console.log(`${row.column_name.padEnd(25)} ${row.data_type}`);
    });
    console.log('='.repeat(60));

  } catch (error) {
    // 回滚事务
    await client.query('ROLLBACK');
    console.error('\n❌ Error! Transaction rolled back:', error);
    throw error;
  } finally {
    await client.end();
  }
}

fixAnalyzedContentTable()
  .then(() => {
    console.log('\n✅ Fix completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fix failed:', error.message);
    process.exit(1);
  });
