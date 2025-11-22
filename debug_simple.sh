#!/bin/bash

set -e

echo "🧪 简单测试..."

cat > test.txt << EOF
nginx:latest
redis:latest
EOF

echo "📂 测试文件："
cat test.txt

echo ""
echo "🔍 测试第一个while循环："
count=0
while IFS= read -r line; do
    count=$((count + 1))
    echo "第 $count 行: $line"
    [[ -z "$line" ]] && continue
    if echo "$line" | grep -q '^\s*#'; then
        continue
    fi
    echo "✅ 处理完成: $line"
done < test.txt

echo "✅ 第一个循环完成，计数: $count"

echo ""
echo "🔍 测试第二个while循环："
count=0
while IFS= read -r line || [ -n "$line" ]; do
    count=$((count + 1))
    echo "第 $count 行: $line"
    [[ -z "$line" ]] && continue
    if echo "$line" | grep -q '^\s*#'; then
        continue
    fi
    echo "✅ 处理完成: $line"
done < test.txt

echo "✅ 所有测试完成"
rm -f test.txt