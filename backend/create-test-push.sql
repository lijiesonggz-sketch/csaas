-- ========================================
-- 创建测试推送数据的SQL脚本
-- ========================================
-- 使用方法:
-- 1. Docker: docker exec -i csaas-postgres psql -U csaas_user -d csaas_dev < create-test-push.sql
-- 2. pgAdmin/其他工具: 复制粘贴执行
-- 3. VS Code PostgreSQL插件: 连接后执行
-- ========================================

-- 1. 首先检查并插入测试的 raw_content
INSERT INTO raw_content (id, url, title, summary, source, "publishDate", "createdAt", "updatedAt")
VALUES
  (
    'test-raw-001',
    'https://example.com/test-tech-article',
    '测试技术文章: WebSocket实时推送最佳实践',
    '本文介绍如何在项目中使用WebSocket实现实时推送功能，包括连接管理、错误处理和重连机制。',
    '测试来源',
    NOW(),
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- 2. 插入测试的 analyzed_content
INSERT INTO analyzed_content (
  id,
  "rawContentId",
  "aiSummary",
  categories,
  tags,
  "targetAudience",
  "createdAt",
  "updatedAt"
)
VALUES
  (
    'test-analyzed-001',
    'test-raw-001',
    '这是一篇关于WebSocket最佳实践的技术文章，适合需要实现实时功能的项目参考。',
    ARRAY['技术架构'],
    ARRAY['WebSocket', '实时通信', '前端开发'],
    '技术团队',
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- 3. 插入测试的 radar_push 记录（状态为 scheduled，等待推送）
-- 注意: organizationId 需要替换为你实际的组织ID
INSERT INTO radar_push (
  id,
  "organizationId",
  "analyzedContentId",
  "radarType",
  status,
  "relevanceScore",
  "priorityLevel",
  "scheduledAt",
  "createdAt",
  "updatedAt"
)
VALUES
  (
    'test-push-001',
    'default-org-001',  -- 使用默认组织ID
    'test-analyzed-001',
    'tech',
    'scheduled',  -- 状态为 scheduled，等待推送任务处理
    0.95,
    'high',
    NOW(),        -- scheduledAt 设为当前时间，立即可推送
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- 4. 查询待推送的记录
SELECT
  id,
  "organizationId",
  "radarType",
  status,
  "relevanceScore",
  "priorityLevel",
  "scheduledAt"
FROM radar_push
WHERE status = 'scheduled' AND "radarType" = 'tech'
ORDER BY "scheduledAt" DESC
LIMIT 10;

-- ========================================
-- 执行结果提示
-- ========================================
-- 如果成功，你应该看到:
-- 1. INSERT 0 1 (或类似的插入成功消息)
-- 2. 一条查询结果，显示刚插入的测试推送记录
-- ========================================

-- 💡 提示: 插入数据后，可以通过以下方式触发推送:
-- 1. 等待定时任务自动触发（技术雷达: 每周五17:00）
-- 2. 运行: npx ts-node trigger-push.ts
-- 3. 使用 BullMQ Dashboard 手动触发任务
