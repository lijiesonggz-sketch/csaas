-- 检查最近的AI生成事件，看看通义千问是否被调用
SELECT
  model,
  COUNT(*) as total_calls,
  MIN(created_at) as first_call,
  MAX(created_at) as last_call
FROM ai_generation_events
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY model
ORDER BY first_call DESC;

-- 查看最近的任务，看看哪些任务应该调用通义千问
SELECT
  id,
  type,
  status,
  created_at,
  updated_at
FROM ai_tasks
WHERE type = 'clustering'
  AND created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 10;

-- 查看最近聚类任务的模型使用情况
SELECT
  age.id,
  age.model,
  age.event_type,
  age.created_at
FROM ai_generation_events age
JOIN ai_tasks ait ON age.task_id = ait.id
WHERE ait.type = 'clustering'
  AND age.created_at >= NOW() - INTERVAL '7 days'
ORDER BY age.created_at DESC
LIMIT 20;
