#!/bin/bash

echo "【前端主要目录】"
cd frontend

# app目录下的子目录
echo "  app/"
find app -maxdepth 1 -type d ! -name "app" | while read dir; do
  lines=$(find "$dir" -type f \( -name "*.tsx" -o -name "*.ts" \) -exec cat {} \; 2>/dev/null | wc -l | tr -d ' ')
  files=$(find "$dir" -type f \( -name "*.tsx" -o -name "*.ts" \) 2>/dev/null | wc -l | tr -d ' ')
  if [ "$lines" != "0" ]; then
    printf "    %-30s %6s 行 (%3s 文件)\n" "$(basename "$dir"):" "$lines" "$files"
  fi
done | sort -t: -k2 -nr

echo ""
echo "  components/"
find components -maxdepth 1 -type d ! -name "components" | while read dir; do
  lines=$(find "$dir" -type f \( -name "*.tsx" -o -name "*.ts" \) -exec cat {} \; 2>/dev/null | wc -l | tr -d ' ')
  files=$(find "$dir" -type f \( -name "*.tsx" -o -name "*.ts" \) 2>/dev/null | wc -l | tr -d ' ')
  if [ "$lines" != "0" ]; then
    printf "    %-30s %6s 行 (%3s 文件)\n" "$(basename "$dir"):" "$lines" "$files"
  fi
done | sort -t: -k2 -nr
