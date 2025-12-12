#!/bin/bash

# 模拟NEEDED_IMAGES变量
NEEDED_IMAGES="google/deepvariant:1.10.0-beta-gpu"$'\n'"google/deepvariant:1.9.0-gpu"

# 创建temp_images.txt（使用echo -n避免末尾空行）
echo -n "$NEEDED_IMAGES" > temp_images.txt

echo "=== temp_images.txt内容 ==="
cat -A temp_images.txt
echo ""
echo "=== 文件行数 ==="
wc -l temp_images.txt
echo ""

echo "=== 模拟smart_sync_images中的while循环 ==="
total_images=0
while IFS= read -r line || [ -n "$line" ]; do
    echo "处理第$((total_images + 1))行: '$line'"
    [[ -z "$line" ]] && echo "跳过空行" && continue
    if echo "$line" | grep -q '^\s*#'; then
        echo "跳过注释行"
        continue
    fi
    ((total_images++))
    echo "total_images递增到: $total_images"
done < temp_images.txt

echo "最终total_images: $total_images"
