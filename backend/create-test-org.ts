import { config } from 'dotenv'
import { createConnection } from 'typeorm'
import {
  Organization,
  OrganizationMember,
  Project,
  WeaknessSnapshot,
  WatchedTopic,
  WatchedPeer,
} from './src/database/entities'

// Load environment variables
config({ path: '.env.development' })

async function createTestOrganization() {
  const connection = await createConnection({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'csaas',
    entities: [
      Organization,
      OrganizationMember,
      Project,
      WeaknessSnapshot,
      WatchedTopic,
      WatchedPeer,
    ],
    synchronize: false,
    logging: false,
  })

  try {
    const orgRepo = connection.getRepository(Organization)

    // Check if organization already exists
    const existing = await orgRepo.findOne({ where: { name: 'CSAAS公司' } })
    if (existing) {
      console.log('✅ 组织已存在:', {
        id: existing.id,
        name: existing.name,
        radarActivated: existing.radarActivated,
      })
      await connection.close()
      return existing.id
    }

    // Create new organization
    const org = orgRepo.create({ name: 'CSAAS公司' })
    const saved = await orgRepo.save(org)

    console.log('✅ 成功创建测试组织:', {
      id: saved.id,
      name: saved.name,
      radarActivated: saved.radarActivated,
    })

    await connection.close()
    return saved.id
  } catch (error) {
    console.error('❌ 创建组织失败:', error)
    await connection.close()
    process.exit(1)
  }
}

createTestOrganization()
  .then((id) => {
    console.log('\n📝 使用以下 URL 访问 Radar 页面:')
    console.log(`http://localhost:3001/radar?orgId=${id}`)
    process.exit(0)
  })
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })
