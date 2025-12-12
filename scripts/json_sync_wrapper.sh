#!/bin/bash
# JSON镜像同步包装脚本
# 将JSON格式转换为现有的text格式工作流

set -e

# 参数处理
FORCE_SYNC=false
SMART_SYNC=false
OUTPUT_FILE="sync-result.env"

# 解析参数
while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--force-sync)
            FORCE_SYNC=true
            shift
            ;;
        -s|--smart-sync)
            SMART_SYNC=true
            shift
            ;;
        -o|--output)
            OUTPUT_FILE="$2"
            shift 2
            ;;
        --check-only)
            echo "📊 检查JSON配置..."
            python3 json_image_processor.py --check-only
            exit $?
            ;;
        *)
            echo "未知参数: $1"
            exit 1
            ;;
    esac
done

echo "🔄 使用JSON格式进行镜像同步..."

# 检查images.json是否存在
if [ ! -f "images.json" ]; then
    echo "❌ images.json配置文件不存在"
    exit 1
fi

# 运行JSON处理器
echo "📊 加载JSON配置..."
python3 json_image_processor.py --check-only

# 如果是智能同步模式，先检查是否需要同步
if [ "$SMART_SYNC" = true ]; then
    echo "🔍 智能同步模式：检查需要同步的镜像..."

    # 使用Python脚本检查需要同步的镜像
    NEEDED_IMAGES=$(python3 -c "
import json
import sys
try:
    with open('images.json', 'r') as f:
        config = json.load(f)

    needed = []
    for img in config.get('images', []):
        # 简单的启发式检查：如果描述包含'最新'或版本号，可能需要同步
        desc = img.get('description', '').lower()
        tag = img.get('source', {}).get('tag', img.get('tag', 'latest'))

        if any(keyword in desc for keyword in ['最新', 'latest', '更新']) or tag != 'latest':
            if 'name' in img:
                repo = img['name']
            else:
                repo = img.get('source', {}).get('repository', '')

            if repo:
                full_name = repo
                if tag and tag != 'latest':
                    full_name += f':{tag}'

                platform = img.get('platform') or img.get('options', {}).get('platform')
                if platform:
                    full_name = f'--platform={platform} {full_name}'

                needed.append(full_name)

    print('\\n'.join(needed) if needed else '')
except Exception as e:
    print(f'', file=sys.stderr)
    sys.exit(1)
")

    NEEDED_COUNT=$(echo "$NEEDED_IMAGES" | grep -c . || echo 0)

    if [[ $NEEDED_COUNT -eq 0 ]]; then
        echo "🎉 所有镜像已是最新，无需同步"
        # 创建空的结果文件
        if [ -n "$OUTPUT_FILE" ]; then
            cat > "$OUTPUT_FILE" << EOF
TOTAL_COUNT=0
SUCCESS_COUNT=0
FAILED_COUNT=0
SYNC_COUNT=0
EOF
        fi
        exit 0
    fi

    echo "🚀 发现 $NEEDED_COUNT 个镜像需要同步"

    # 创建结果文件
    TOTAL_COUNT=$NEEDED_COUNT
    SUCCESS_COUNT=0
    FAILED_COUNT=0

    # 逐个同步检测到的镜像
    echo "$NEEDED_IMAGES" | while IFS= read -r image_line; do
        if [ -n "$image_line" ]; then
            echo "📦 同步镜像: $image_line"
            if ./scripts/sync_single_image.sh "$image_line"; then
                ((SUCCESS_COUNT++))
                echo "✅ 同步成功: $image_line"
            else
                ((FAILED_COUNT++))
                echo "❌ 同步失败: $image_line"
            fi
        fi
    done

    # 创建结果文件
    cat > "${OUTPUT_FILE:-sync-result.env}" << EOF
TOTAL_COUNT=$TOTAL_COUNT
SUCCESS_COUNT=$SUCCESS_COUNT
FAILED_COUNT=$FAILED_COUNT
SYNC_COUNT=$TOTAL_COUNT
SUCCESS_IMAGES<<EOF
✅ 智能同步完成: 成功 $SUCCESS_COUNT 个镜像
EOF
FAILED_IMAGES<<EOF
❌ 失败镜像: $FAILED_COUNT 个镜像
EOF
EOF

else
    # 强制同步所有镜像
    echo "🚀 强制同步所有镜像..."
    python3 json_image_processor.py --output "${OUTPUT_FILE:-sync-result.env}"
fi

echo "✅ JSON格式镜像同步完成"