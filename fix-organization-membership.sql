-- 临时解决方案：将当前用户添加到watched_peers所属的组织中
-- 这样用户就可以删除watched_peers了

-- 1. 查看当前有哪些用户和组织
SELECT 'Users:' as info;
SELECT id, email, name FROM users LIMIT 5;

SELECT 'Organizations:' as info;
SELECT id, name FROM organizations LIMIT 5;

SELECT 'Organization Members:' as info;
SELECT om.id, u.email, o.name as org_name, om.role
FROM organization_members om
JOIN users u ON om.user_id = u.id
JOIN organizations o ON om.organization_id = o.id
LIMIT 10;

-- 2. 查看watched_peers所属的组织
SELECT 'Watched Peers Organizations:' as info;
SELECT DISTINCT wp.organization_id, o.name
FROM watched_peers wp
JOIN organizations o ON wp.organization_id = o.id;

-- 3. 将第一个用户添加到所有watched_peers所属的组织中（如果还不是成员）
-- 注意：这是开发环境的临时解决方案
INSERT INTO organization_members (id, organization_id, user_id, role, created_at)
SELECT
    gen_random_uuid(),
    wp.organization_id,
    (SELECT id FROM users WHERE email = 'test@csaas.com' LIMIT 1),
    'admin',
    NOW()
FROM (SELECT DISTINCT organization_id FROM watched_peers) wp
WHERE NOT EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = wp.organization_id
    AND om.user_id = (SELECT id FROM users WHERE email = 'test@csaas.com' LIMIT 1)
)
ON CONFLICT DO NOTHING;

SELECT 'Added user to organizations' as info;

-- 4. 验证结果
SELECT 'Verification:' as info;
SELECT om.id, u.email, o.name as org_name, om.role
FROM organization_members om
JOIN users u ON om.user_id = u.id
JOIN organizations o ON om.organization_id = o.id
WHERE u.email = 'test@csaas.com';
