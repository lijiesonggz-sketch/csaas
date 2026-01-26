SELECT id, status, error_message FROM ai_tasks WHERE type = 'standard_interpretation' ORDER BY created_at DESC LIMIT 1;
