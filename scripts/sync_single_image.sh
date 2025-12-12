#!/bin/bash
# 单个镜像同步脚本
# 为JSON格式镜像处理器提供单个镜像同步功能

set -e

# 接收镜像名称作为参数
IMAGE_SPEC="$1"

if [ -z "$IMAGE_SPEC" ]; then
    echo "❌ 错误：缺少镜像名称参数"
    echo "用法: $0 '<镜像名称>'"
    echo "示例: $0 'nginx:latest'"
    echo "示例: $0 '--platform=linux/arm64 nginx:latest'"
    exit 1
fi

echo "🔄 开始同步镜像: $IMAGE_SPEC"

# 检查环境变量
if [ -z "$ALIYUN_REGISTRY" ] || [ -z "$ALIYUN_NAME_SPACE" ]; then
    echo "❌ 错误：缺少阿里云镜像仓库环境变量"
    echo "需要设置: ALIYUN_REGISTRY, ALIYUN_NAME_SPACE"
    exit 1
fi

# 检查是否包含平台参数
platform_param=""
image_name="$IMAGE_SPEC"
if echo "$IMAGE_SPEC" | grep -q -- '--platform'; then
    platform_param=$(echo "$IMAGE_SPEC" | awk -F'--platform[ =]' '{if (NF>1) print $2}' | awk '{print $1}')
    image_name=$(echo "$IMAGE_SPEC" | awk '{print $NF}')
fi

echo "🐛 调试信息:"
echo "  原始规格: $IMAGE_SPEC"
echo "  镜像名称: $image_name"
echo "  平台参数: ${platform_param:-无}"
echo "  目标仓库: $ALIYUN_REGISTRY/$ALIYUN_NAME_SPACE"

# 拉取镜像
echo "🔄 docker pull $IMAGE_SPEC"
if ! docker pull $IMAGE_SPEC; then
    echo "❌ 拉取失败: $IMAGE_SPEC"
    exit 1
fi

echo "✅ 拉取成功"

# 生成目标镜像名
platform_prefix=""
if [ -n "$platform_param" ]; then
    platform_prefix="${platform_param//\//_}_"
fi

# 获取镜像基本信息
image_name_tag=$(echo "$image_name" | awk -F'/' '{print $NF}')
new_image="$ALIYUN_REGISTRY/$ALIYUN_NAME_SPACE/${platform_prefix}$image_name_tag"

echo "🏷️  docker tag $image_name $new_image"
if ! docker tag $image_name $new_image; then
    echo "❌ 标记失败: $image_name -> $new_image"
    exit 1
fi

echo "📤 docker push $new_image"
if ! docker push $new_image; then
    echo "❌ 推送失败: $new_image"
    exit 1
fi

echo "✅ 推送成功: $new_image"

# 清理本地镜像以节省空间
echo "🧹 清理本地镜像..."
docker rmi $image_name $new_image 2>/dev/null || true

echo "🎉 镜像同步完成: $IMAGE_SPEC -> $new_image"
exit 0