#!/bin/bash

set -e

echo "🧪 测试smart sync功能..."

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
echo "🚀 开始测试smart sync..."

# 测试脚本
./scripts/image-processor.sh -f test_images.txt -o test-result.env -s

echo ""
echo "✅ 测试完成！检查结果文件："
if [ -f test-result.env ]; then
    echo "📊 结果文件内容："
    cat test-result.env
else
    echo "❌ 结果文件不存在"
fi

# 清理
rm -f test_images.txt test-result.env needed_images.txt success_images.txt failed_images.txt

echo "🧪 测试完成"