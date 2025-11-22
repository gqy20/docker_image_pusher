#!/bin/bash

set -e

# 默认参数
SOURCE_FILE=""
ISSUE_BODY=""
OUTPUT_ENV_FILE=""
REPORT_MODE="sync"

# 帮助信息
show_help() {
    cat << EOF
用法: $0 [选项]

镜像处理脚本 - 支持从文件提取或同步镜像

选项:
    -f, --file FILE          从文件读取镜像列表进行同步
    -i, --issue-body TEXT    从GitHub Issue body提取镜像
    -o, --output FILE        输出环境变量到文件 (用于GitHub Actions)
    -r, --report MODE        报告模式: sync (默认) | extract
    -h, --help               显示帮助信息

示例:
    # 从文件同步镜像
    $0 -f images.txt -o sync-result.env

    # 从Issue body提取镜像
    $0 -i "\`\`\`\nnginx:latest\nalpine:latest\n\`\`\`" -o extract-result.env -r extract

EOF
}

# 解析命令行参数
while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--file)
            SOURCE_FILE="$2"
            shift 2
            ;;
        -i|--issue-body)
            ISSUE_BODY="$2"
            shift 2
            ;;
        -o|--output)
            OUTPUT_ENV_FILE="$2"
            shift 2
            ;;
        -r|--report)
            REPORT_MODE="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo "❌ 未知参数: $1"
            show_help
            exit 1
            ;;
    esac
done

# 统一的镜像过滤函数
filter_images() {
    local input="$1"
    echo "$input" | while IFS= read -r line; do
        # 忽略空行与注释 - 统一过滤逻辑
        [[ -z "$line" ]] && continue
        if echo "$line" | grep -q '^\s*#'; then
            continue
        fi
        # 去除首尾空格
        echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'
    done
}

# 从GitHub Issue body提取镜像
extract_from_issue() {
    local body="$1"
    local temp_file="issue_body_temp.txt"

    echo "🔍 从Issue中提取镜像..." >&2

    # 将issue body写入临时文件
    cat > "$temp_file" << BODY_EOF
$body
BODY_EOF

    local extracted_images=""

    # 提取镜像内容 - 支持代码块和Issue模板格式
    if echo "$body" | grep -q '```'; then
        # 如果有代码块，提取代码块中的内容
        echo "📝 检测到代码块格式..." >&2
        extracted_images=$(sed -n '/```/,/```/p' "$temp_file" | sed '1d;$d')
    else
        # 如果没有代码块，尝试提取Issue模板中的镜像列表
        echo "📝 检测到Issue模板格式..." >&2
        extracted_images=$(sed -n '/### 📦 镜像列表/,/^### /p' "$temp_file" | sed '1d;$d')
    fi

    # 过滤并输出到临时文件
    filter_images "$extracted_images" > "extracted_images.txt"

    # 显示提取结果
    echo "📋 提取的镜像列表:" >&2
    cat "extracted_images.txt" >&2

    local valid_count=$(cat "extracted_images.txt" | grep -v '^$' | wc -l)
    echo "📊 有效镜像数量: $valid_count" >&2

    # 清理临时文件
    rm -f "$temp_file"

    echo "$valid_count"
}

# 核心镜像同步函数
sync_images() {
    local input_file="$1"

    if [ ! -f "$input_file" ]; then
        echo "❌ 镜像列表文件不存在: $input_file"
        return 1
    fi

    local total_count=0
    local success_count=0

    # 创建记录成功和失败镜像的文件
    echo "" > success_images.txt
    echo "" > failed_images.txt

    echo "🚀 开始镜像同步..."
    echo "=============================================================================="

    while IFS= read -r line || [ -n "$line" ]; do
        # 使用统一的过滤逻辑
        [[ -z "$line" ]] && continue
        if echo "$line" | grep -q '^\s*#'; then
            continue
        fi

        ((total_count++))
        local original_line="$line"
        echo ""
        echo "📦 处理镜像 [$total_count]: $line"

        # 检查是否包含平台参数
        local platform_param=""
        local image_name="$line"
        if echo "$line" | grep -q -- '--platform'; then
            platform_param=$(echo "$line" | awk -F'--platform[ =]' '{if (NF>1) print $2}' | awk '{print $1}')
            image_name=$(echo "$line" | awk '{print $NF}')
        fi

        echo "🔄 docker pull $line"
        if docker pull $line; then
            echo "✅ 拉取成功"

            # 生成目标镜像名
            local platform_prefix=""
            if [ -n "$platform_param" ]; then
                platform_prefix="${platform_param//\//_}_"
            fi

            # 获取镜像基本信息
            local image_name_tag=$(echo "$image_name" | awk -F'/' '{print $NF}')
            local new_image="$ALIYUN_REGISTRY/$ALIYUN_NAME_SPACE/${platform_prefix}$image_name_tag"

            echo "🏷️  docker tag $image_name $new_image"
            docker tag $image_name $new_image

            echo "📤 docker push $new_image"
            if docker push $new_image; then
                ((success_count++))
                echo "✅ 推送成功: $new_image"
                # 记录成功的镜像
                echo "✅ $original_line → $new_image" >> success_images.txt
            else
                echo "❌ 推送失败: $new_image"
                # 记录失败的镜像
                echo "❌ $original_line (推送失败: $new_image)" >> failed_images.txt
            fi

            # 清理本地镜像
            echo "🧹 清理本地镜像..."
            docker rmi $image_name 2>/dev/null || true
            docker rmi $new_image 2>/dev/null || true

        else
            echo "❌ 拉取失败: $line"
            # 记录拉取失败的镜像
            echo "❌ $original_line (拉取失败)" >> failed_images.txt
        fi

    done < "$input_file"

    echo ""
    echo "=============================================================================="
    echo "📊 同步完成统计:"
    echo "  📋 处理总数: $total_count 个镜像"
    echo "  ✅ 成功同步: $success_count 个镜像"
    echo "  ❌ 失败数量: $((total_count - success_count)) 个镜像"
    echo "=============================================================================="

    # 输出环境变量（如果指定了输出文件）
    if [ -n "$OUTPUT_ENV_FILE" ]; then
        echo "TOTAL_COUNT=$total_count" >> "$OUTPUT_ENV_FILE"
        echo "SUCCESS_COUNT=$success_count" >> "$OUTPUT_ENV_FILE"

        echo "SUCCESS_IMAGES<<EOF" >> "$OUTPUT_ENV_FILE"
        cat success_images.txt >> "$OUTPUT_ENV_FILE"
        echo "EOF" >> "$OUTPUT_ENV_FILE"

        echo "FAILED_IMAGES<<EOF" >> "$OUTPUT_ENV_FILE"
        cat failed_images.txt >> "$OUTPUT_ENV_FILE"
        echo "EOF" >> "$OUTPUT_ENV_FILE"
    fi
}

# 主逻辑
main() {
    # 检查必要的环境变量
    if [ "$REPORT_MODE" = "sync" ]; then
        if [ -z "$ALIYUN_REGISTRY" ] || [ -z "$ALIYUN_NAME_SPACE" ]; then
            echo "❌ 缺少必要的环境变量: ALIYUN_REGISTRY, ALIYUN_NAME_SPACE"
            exit 1
        fi
    fi

    if [ -n "$ISSUE_BODY" ]; then
        # Issue body模式
        local count=$(extract_from_issue "$ISSUE_BODY")
        if [ -n "$OUTPUT_ENV_FILE" ]; then
            echo "image_count=$count" >> "$OUTPUT_ENV_FILE"
        fi
        exit 0
    elif [ -n "$SOURCE_FILE" ]; then
        # 文件模式
        sync_images "$SOURCE_FILE"
    else
        echo "❌ 请指定输入源 (-f 或 -i)"
        show_help
        exit 1
    fi
}

# 执行主逻辑
main "$@"