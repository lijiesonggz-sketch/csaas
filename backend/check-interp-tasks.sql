-- 查看最近的标准解读任务
SELECT
  id,
  status,
  input->>'interpretationMode' as mode,
  input->>'standardDocument->>name' as doc_name,
  created_at,
  updated_at,
  CASE
    WHEN result IS NOT NULL THEN '有结果'
    ELSE '无结果'
  END as has_result
FROM ai_tasks
WHERE type = 'standard_interpretation'
ORDER BY created_at DESC
LIMIT 10;

-- 查看最新任务的详细信息（如果有result）
SELECT
  task_id,
  selected_model,
  confidence_level,
  jsonb_array_length((selected_result->'key_requirements')::jsonb) as clause_count,
  selected_result->>'risk_matrix' as has_risk_matrix,
  selected_result->>'implementation_roadmap' as has_roadmap,
  selected_result->>'checklists' as has_checklists,
  selected_result->>'overview->>key_changes' as has_key_changes
FROM ai_generation_results
WHERE task_id IN (
  SELECT id
  FROM ai_tasks
  WHERE type = 'standard_interpretation'
  ORDER BY created_at DESC
  LIMIT 1
)
ORDER BY created_at DESC;
