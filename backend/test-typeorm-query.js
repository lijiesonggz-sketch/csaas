const { getRepository } = require('typeorm');
const { ProjectMember } = require('./dist/database/entities');

async function testTypeORMQuery() {
  try {
    console.log('\n=== TypeORM查询测试 ===\n');

    const projectMemberRepo = getRepository(ProjectMember);

    const projectId = 'd2fe6e12-3f43-462f-b2ac-973e4adfe2e2';
    const userId = '65fefcd7-3b4b-49d7-a56f-8db474314c62';

    console.log('查询参数:');
    console.log('  projectId:', projectId);
    console.log('  userId:', userId);

    const member = await projectMemberRepo.findOne({
      where: { projectId, userId },
    });

    console.log('\n查询结果:');
    if (member) {
      console.log('  ✅ 找到成员');
      console.log('  ID:', member.id);
      console.log('  Role:', member.role);
      console.log('  User ID:', member.userId);
      console.log('  Project ID:', member.projectId);
    } else {
      console.log('  ❌ 未找到成员');
    }

    // 测试查询所有
    console.log('\n所有project_members:');
    const all = await projectMemberRepo.find();
    console.log('  总数:', all.length);
    all.forEach(m => {
      console.log(`  - ${m.projectId.substring(0,8)}... | ${m.userId.substring(0,8)}... | ${m.role}`);
    });

  } catch (error) {
    console.error('\n错误:', error.message);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

testTypeORMQuery();
