#!/bin/bash

set -e

echo "🧪 测试while循环部分..."

# 模拟环境变量
export ALIYUN_REGISTRY="registry.cn-hangzhou.aliyuncs.com"
export ALIYUN_NAME_SPACE="test_namespace"

# 创建测试文件
cat > test_images.txt << EOF
nginx:latest
redis:latest
alpine:latest
EOF

echo "📂 测试文件内容："
cat test_images.txt

echo ""
echo "🔍 开始测试重名分析..."

declare -A duplicate_images
declare -A temp_map

echo "🐛 开始读取测试文件"

line_count=0
while IFS= read -r line || [ -n "$line" ]; do
    line_count=$((line_count + 1))
    echo "🐛 处理第 $line_count 行: '$line'"

    # 使用统一的过滤逻辑
    [[ -z "$line" ]] && echo "跳过空行" && continue
    if echo "$line" | grep -q '^\s*#'; then
        echo "跳过注释行: $line"
        continue
    fi

    echo "✅ 通过过滤检查: $line"

    # 提取镜像信息
    platform=""
    image="$line"
    if echo "$line" | grep -q -- '--platform'; then
        platform=$(echo "$line" | awk -F'--platform[ =]' '{if (NF>1) print $2}' | awk '{print $1}')
        image=$(echo "$line" | awk '{print $NF}')
    fi

    echo "🔍 解析结果: platform='$platform', image='$image'"

    # 将@sha256:等字符删除
    image="${image%%@*}"
    echo "🔍 清理后image: '$image'"

    # 获取镜像名:版本号
    image_name_tag=$(echo "$image" | awk -F'/' '{print $NF}')
    image_name=$(echo "$image_name_tag" | awk -F':' '{print $1}')

    echo "🔍 镜像分析: image_name_tag='$image_name_tag', image_name='$image_name'"

    # 获取命名空间
    name_space=$(echo "$image" | awk -F'/' '{if (NF==3) print $2; else if (NF==2) print $1; else print ""}')
    echo "🔍 命名空间: '$name_space'"

    # 检测重名镜像
    if [[ -n "${temp_map[$image_name]}" ]]; then
         if [[ "${temp_map[$image_name]}" != "$name_space" ]]; then
            echo "🔄 发现重名镜像: $image_name"
            duplicate_images[$image_name]="true"
         fi
    else
        temp_map[$image_name]="$name_space"
    fi

    echo "✅ 完成处理第 $line_count 行"

done < test_images.txt

echo "🎉 重名分析完成！"
echo "处理的行数: $line_count"

echo ""
echo "📊 开始检测现有镜像阶段..."

total_images=0
needed_images=0
EXISTING_IMAGES=""

temp_sync_file="needed_images.txt"
> "$temp_sync_file"

while IFS= read -r line || [ -n "$line" ]; do
    echo "🐛 检测循环处理: $line"

    # 使用统一的过滤逻辑
    [[ -z "$line" ]] && continue
    if echo "$line" | grep -q '^\s*#'; then
        continue
    fi

    ((total_images++))
    echo "🔍 总计数器: $total_images"

    # 模拟镜像检查（不使用docker）
    echo "🔍 模拟检查镜像: $line"
    echo "✅ 模拟检查完成"

    echo "🐛 完成处理镜像 $total_images"

done < test_images.txt

echo "🎉 所有测试完成！"

# 清理
rm -f test_images.txt "$temp_sync_file"