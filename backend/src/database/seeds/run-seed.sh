#!/bin/bash
# 执行雷达推送演示数据 seed 脚本
# 用法: bash run-seed.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SQL_FILE="$SCRIPT_DIR/demo-radar-data.sql"

echo "=== 执行雷达推送演示数据 Seed ==="

# 通过 docker exec 执行 SQL
docker exec -i csaas-postgres psql -U postgres -d csaas < "$SQL_FILE"

if [ $? -eq 0 ]; then
  echo ""
  echo "=== Seed 执行成功 ==="
  echo ""
  echo "数据验证:"
  echo ""
  echo "1. 技术雷达（7条唯一内容）:"
  docker exec csaas-postgres psql -U postgres -d csaas -c "SELECT DISTINCT rc.title, rc.source FROM raw_contents rc JOIN analyzed_contents ac ON rc.id = ac.\"contentId\" JOIN radar_pushes rp ON ac.id = rp.\"contentId\" WHERE rp.\"radarType\" = 'tech' AND rc.title <> 'Test Content' ORDER BY rc.title;"
  echo ""
  echo "2. 行业雷达（6条唯一内容）:"
  docker exec csaas-postgres psql -U postgres -d csaas -c "SELECT DISTINCT rc.title, rc.\"peerName\" FROM raw_contents rc JOIN analyzed_contents ac ON rc.id = ac.\"contentId\" JOIN radar_pushes rp ON ac.id = rp.\"contentId\" WHERE rp.\"radarType\" = 'industry' AND rc.title <> 'Test Content' ORDER BY rc.\"peerName\";"
  echo ""
  echo "3. 合规雷达（3条唯一内容）:"
  docker exec csaas-postgres psql -U postgres -d csaas -c "SELECT DISTINCT rc.title, rc.source FROM raw_contents rc JOIN analyzed_contents ac ON rc.id = ac.\"contentId\" JOIN radar_pushes rp ON ac.id = rp.\"contentId\" WHERE rp.\"radarType\" = 'compliance' AND rc.title <> 'Test Content' ORDER BY rc.title;"
  echo ""
  echo "4. 关联数据:"
  docker exec csaas-postgres psql -U postgres -d csaas -c "SELECT 'Tags' as item, COUNT(*) as count FROM tags UNION ALL SELECT 'Content Tags', COUNT(*) FROM content_tags UNION ALL SELECT 'Compliance Playbooks', COUNT(*) FROM compliance_playbooks;"
else
  echo "=== Seed 执行失败 ==="
  exit 1
fi
