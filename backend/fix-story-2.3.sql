-- Story 2.3 Code Review 修复SQL
-- 在Docker容器内直接执行

-- 1. 创建 push_logs 表
CREATE TABLE IF NOT EXISTS push_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "pushId" uuid NOT NULL,
  status VARCHAR(10) NOT NULL CHECK (status IN ('success', 'failed')),
  "errorMessage" TEXT,
  "retryCount" INT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "FK_push_logs_pushId" FOREIGN KEY ("pushId")
    REFERENCES radar_pushes(id) ON DELETE CASCADE
);

-- 2. 创建 push_logs 索引
CREATE INDEX IF NOT EXISTS "idx_push_logs_pushId" ON push_logs ("pushId");
CREATE INDEX IF NOT EXISTS "idx_push_logs_status" ON push_logs (status);
CREATE INDEX IF NOT EXISTS "idx_push_logs_createdAt" ON push_logs ("createdAt");

-- 3. 添加 AC 3 推送调度查询索引
CREATE INDEX IF NOT EXISTS "idx_radar_pushes_radar_status_scheduled"
  ON radar_pushes ("radarType", status, "scheduledAt");

-- 4. 添加 AC 6 去重查询索引
CREATE INDEX IF NOT EXISTS "idx_radar_pushes_org_content_scheduled"
  ON radar_pushes ("organizationId", "contentId", "scheduledAt");

-- 验证
SELECT 'push_logs表创建成功' AS result;
SELECT 'radar_pushes索引优化完成' AS result;
