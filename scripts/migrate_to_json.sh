#!/bin/bash
# 迁移脚本：从images.txt格式迁移到JSON格式

set -e

echo "🔄 开始迁移到JSON格式..."

# 检查当前格式
if [ -f "images.json" ]; then
    echo "⚠️  images.json已存在，是否要覆盖？(y/N)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        echo "❌ 迁移已取消"
        exit 0
    fi
fi

# 备份现有文件
if [ -f "images.txt" ]; then
    cp images.txt images.txt.backup
    echo "💾 已备份: images.txt.backup"
fi

# 执行迁移
if [ -f "create_example_json.py" ]; then
    python3 create_example_json.py
    echo "✅ 迁移完成"
    
    echo ""
    echo "📋 生成的文件:"
    ls -la *.json
    
    echo ""
    echo "📝 下一步:"
    echo "1. 检查 images.json 配置是否符合预期"
    echo "2. 可以删除 images.txt（可选）"
    echo "3. 提交新的JSON配置到仓库"
    echo "4. 手动触发JSON格式的工作流进行测试"
    
    echo ""
    echo "🚀 JSON格式的优势:"
    echo "  ✅ 结构化数据，更易维护"
    echo "  ✅ 支持丰富的元数据"
    echo "  ✅ 更好的错误处理"
    echo "  ✅ 支持优先级和并行控制"
    echo "  ✅ 易于验证和调试"
    
else
    echo "❌ 迁移工具不存在"
    exit 1
fi
