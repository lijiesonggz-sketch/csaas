-- 查询项目 f504ab5a-7347-4148-bffe-cc55d97752e6 的最近任务
SELECT 
  id,
  type,
  status,
  error_message,
  created_at,
  completed_at,
  generation_stage
FROM ai_task 
WHERE project_id = 'f504ab5a-7347-4148-bffe-cc55d97752e6'
ORDER BY created_at DESC 
LIMIT 5;

-- 查询最新任务的AI生成事件
SELECT 
  id,
  model,
  error_message,
  created_at,
  execution_time_ms
FROM ai_generation_event 
WHERE task_id = (
  SELECT id 
  FROM ai_task 
  WHERE project_id = 'f504ab5a-7347-4148-bffe-cc55d97752e6'
  ORDER BY created_at DESC 
  LIMIT 1
)
ORDER BY created_at ASC;
