-- 验证Story 4.1合规雷达数据库迁移
-- 文件: backend/verify-compliance-schema.sql

-- 1. 检查raw_contents.complianceData字段
SELECT
    'raw_contents.complianceData' as check_name,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'raw_contents'
        AND column_name = 'complianceData'
    ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as status;

-- 2. 检查analyzed_contents.complianceAnalysis字段
SELECT
    'analyzed_contents.complianceAnalysis' as check_name,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'analyzed_contents'
        AND column_name = 'complianceAnalysis'
    ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as status;

-- 3. 检查crawler_logs新字段
SELECT
    column_name as check_name,
    '✅ EXISTS' as status
FROM information_schema.columns
WHERE table_name = 'crawler_logs'
AND column_name IN ('contentId', 'crawlDuration', 'crawledAt')
ORDER BY column_name;

-- 4. 检查radar_sources唯一索引
SELECT
    indexname as check_name,
    CASE WHEN is_unique = true THEN '✅ UNIQUE' ELSE '⚠️ NOT UNIQUE' END as status
FROM pg_indexes
WHERE indexname = 'IDX_radar_sources_source_category_unique';

-- 5. 检查合规雷达种子数据
SELECT
    source,
    url,
    category,
    "isActive",
    "crawlSchedule"
FROM radar_sources
WHERE category = 'compliance'
ORDER BY source;
