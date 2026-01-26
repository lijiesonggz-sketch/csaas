#!/bin/bash

echo "=== CSAAS 项目代码统计 ==="
echo ""

# 总体统计
echo "【总计】"
total=$(find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) ! -path "*/node_modules/*" ! -path "*/dist/*" ! -path "*/.next/*" ! -path "*/coverage/*" -exec cat {} \; 2>/dev/null | wc -l)
echo "  总代码行数: $total 行"
echo ""

# 后端
echo "【后端】 Backend"
backend_src=$(find backend/src -name "*.ts" -exec cat {} \; 2>/dev/null | wc -l)
backend_total=$(find backend -type f \( -name "*.ts" -o -name "*.js" \) ! -path "*/node_modules/*" ! -path "*/dist/*" -exec cat {} \; 2>/dev/null | wc -l)
echo "  源代码 (src/): $backend_src 行"
echo "  总计:        $backend_total 行"
echo ""

# 前端
echo "【前端】 Frontend"
frontend_src=$(find frontend/app frontend/components -type f \( -name "*.tsx" -o -name "*.ts" \) -exec cat {} \; 2>/dev/null | wc -l)
frontend_total=$(find frontend -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.jsx" -o -name "*.js" \) ! -path "*/node_modules/*" ! -path "*/dist/*" ! -path "*/.next/*" -exec cat {} \; 2>/dev/null | wc -l)
echo "  源代码 (app/components): $frontend_src 行"
echo "  总计:                   $frontend_total 行"
echo ""

# 后端各模块
echo "【后端主要模块】"
cd backend/src
for dir in */; do
  if [ -d "$dir" ]; then
    lines=$(find "$dir" -name "*.ts" -exec cat {} \; 2>/dev/null | wc -l | tr -d ' ')
    files=$(find "$dir" -name "*.ts" 2>/dev/null | wc -l | tr -d ' ')
    if [ "$lines" != "0" ]; then
      printf "  %-20s %6s 行 (%3s 文件)\n" "$(basename "$dir"):" "$lines" "$files"
    fi
  fi
done | sort -t: -k2 -nr
