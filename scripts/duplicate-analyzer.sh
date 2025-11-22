#!/bin/bash

set -e

# 默认参数
SOURCE_FILE=""
OUTPUT_FILE=""
REPORT_FORMAT="text"
ISSUE_NUMBER=""

# 帮助信息
show_help() {
    cat << EOF
用法: $0 [选项]

重复镜像分析脚本 - 分析镜像列表中的重复项并生成报告

选项:
    -f, --file FILE          输入的镜像列表文件
    -o, --output FILE        输出分析结果到文件
    -r, --report FORMAT      报告格式: text (默认) | github | json
    -i, --issue NUMBER       GitHub Issue编号 (用于GitHub评论)
    -h, --help               显示帮助信息

示例:
    # 分析images.txt文件中的重复镜像
    $0 -f images.txt -o duplicate-report.txt

    # 生成GitHub格式的报告
    $0 -f images.txt -o report.md -r github -i 123

EOF
}

# 解析命令行参数
while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--file)
            SOURCE_FILE="$2"
            shift 2
            ;;
        -o|--output)
            OUTPUT_FILE="$2"
            shift 2
            ;;
        -r|--report)
            REPORT_FORMAT="$2"
            shift 2
            ;;
        -i|--issue)
            ISSUE_NUMBER="$2"
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

# 分析重复镜像的核心函数
analyze_duplicates() {
    local input_file="$1"

    if [ ! -f "$input_file" ]; then
        echo "❌ 输入文件不存在: $input_file"
        return 1
    fi

    echo "🔍 分析镜像重复情况..."

    # 创建临时工作文件
    temp_dir=$(mktemp -d)
    cleaned_images="$temp_dir/cleaned_images.txt"
    grouped_images="$temp_dir/grouped_images.txt"
    duplicates_report="$temp_dir/duplicates.txt"

    # 清理输入数据：移除空行和注释，去除首尾空格
    echo "🧹 清理和预处理镜像数据..."
    while IFS= read -r line; do
        # 跳过空行和注释
        [[ -z "$line" ]] && continue
        if echo "$line" | grep -q '^\s*#'; then
            continue
        fi

        # 去除首尾空格
        cleaned_line=$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

        # 跳过清理后的空行
        [[ -z "$cleaned_line" ]] && continue

        echo "$cleaned_line"
    done < "$input_file" > "$cleaned_images"

    local total_images=$(wc -l < "$cleaned_images")
    echo "📊 总计 $total_images 个有效镜像"

    if [ "$total_images" -eq 0 ]; then
        echo "⚠️ 没有找到有效的镜像"
        rm -rf "$temp_dir"
        return 0
    fi

    # 使用awk进行复杂的重复分析 - 智能镜像名识别
    echo "🔍 进行重复分析..."
    awk '
    BEGIN {
        total = 0
        duplicates = 0
    }
    {
        # 分割镜像名获取基本名称部分 (最后的部分)
        split($0, parts, "/")
        base_name = parts[length(parts)]

        # 分割标签名和镜像名
        if (match(base_name, /^(.+):(.+)$/)) {
            image_name = substr(base_name, RSTART, RLENGTH)
            clean_name = substr(base_name, RSTART, RLENGTH - length(substr(base_name, RSTART + index(substr(base_name, RSTART), ":") + 1)))
        } else {
            image_name = base_name
            clean_name = base_name
        }

        # 记录到清洁名称数组
        clean_images[clean_name, $0] = $0
        image_groups[clean_name]++
        total++

        # 存储原始行
        original_lines[clean_name, image_groups[clean_name]] = $0
    }
    END {
        print "🔍 重复分析结果:"
        print "镜像重复检测统计:"
        print ""

        for (group in image_groups) {
            if (image_groups[group] > 1) {
                print "🔄 重复镜像组: " group
                print "   出现次数: " image_groups[group] " 次"
                print "   详细信息:"

                for (i = 1; i <= image_groups[group]; i++) {
                    if (original_lines[group, i] != "") {
                        print "     " i ". " original_lines[group, i]
                    }
                }
                print ""
                duplicates += image_groups[group] - 1
            }
        }

        print "📊 分析统计:"
        print "  📋 总镜像数: " total
        print "  🔄 重复镜像数: " duplicates
        print "  ✅ 去重后数量: " total - duplicates

        if (duplicates > 0) {
            print "  📈 重复率: " int(duplicates * 100 / total) "%"
        }
        print ""
    }
    ' "$cleaned_images" > "$duplicates_report"

    # 显示分析结果
    cat "$duplicates_report"

    # 如果需要输出到文件
    if [ -n "$OUTPUT_FILE" ]; then
        generate_report "$temp_dir" "$total_images" "$OUTPUT_FILE"
    fi

    # 清理临时文件
    rm -rf "$temp_dir"
}

# 生成报告
generate_report() {
    local temp_dir="$1"
    local total_count="$2"
    local output_file="$3"

    case "$REPORT_FORMAT" in
        "github")
            generate_github_report "$temp_dir" "$total_count" > "$output_file"
            ;;
        "json")
            generate_json_report "$temp_dir" "$total_count" > "$output_file"
            ;;
        *)
            cat "$temp_dir/duplicates.txt" > "$output_file"
            ;;
    esac
}

# 生成GitHub格式的报告
generate_github_report() {
    local temp_dir="$1"
    local total_count="$2"

    cat << EOF
## 🔍 镜像重复分析报告

\`\`\`
$(cat "$temp_dir/duplicates.txt")
\`\`\`

---
*分析时间: $(date '+%Y-%m-%d %H:%M:%S')*
EOF
}

# 生成JSON格式的报告
generate_json_report() {
    local temp_dir="$1"
    local total_count="$2"

    echo "{"
    echo "  \"analysis_time\": \"$(date -Iseconds)\","
    echo "  \"total_images\": $total_count,"
    echo "  \"duplicates_found\": $(grep -c "重复镜像组" "$temp_dir/duplicates.txt" || echo "0"),"
    echo "  \"raw_analysis\": \"$(cat "$temp_dir/duplicates.txt" | sed 's/"/\\"/g' | tr '\n' ' ')\""
    echo "}"
}

# 如果有GitHub Issue编号，发送评论
send_github_comment() {
    if [ -n "$ISSUE_NUMBER" ] && [ -f "$OUTPUT_FILE" ]; then
        echo "📤 发送GitHub评论..."
        if command -v gh &> /dev/null; then
            gh issue comment "$ISSUE_NUMBER" --body-file "$OUTPUT_FILE"
            echo "✅ 评论已发送到Issue #$ISSUE_NUMBER"
        else
            echo "⚠️ GitHub CLI未安装，跳过评论发送"
        fi
    fi
}

# 主逻辑
main() {
    if [ -z "$SOURCE_FILE" ]; then
        echo "❌ 请指定输入文件 (-f)"
        show_help
        exit 1
    fi

    # 执行分析
    analyze_duplicates "$SOURCE_FILE"

    # 发送GitHub评论（如果需要）
    send_github_comment

    echo "✅ 分析完成"
}

# 执行主逻辑
main "$@"