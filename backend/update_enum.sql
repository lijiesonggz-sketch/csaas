-- 更新 ai_tasks 表的 type 枚举约束
ALTER TABLE ai_tasks 
  DROP CONSTRAINT IF EXISTS ai_tasks_type_enum_check;

ALTER TABLE ai_tasks 
  ADD CONSTRAINT ai_tasks_type_enum_check 
  CHECK (type IN ('summary', 'clustering', 'matrix', 'questionnaire', 'action_plan', 'standard_interpretation', 'standard_related_search', 'standard_version_compare', 'binary_questionnaire', 'binary_gap_analysis', 'quick_gap_analysis'));
