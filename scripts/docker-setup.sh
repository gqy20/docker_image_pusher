#!/bin/bash

set -e

echo "🔧 Docker环境初始化开始..."

# 重启Docker服务
echo "🔄 重启Docker服务..."
sudo service docker restart

# 设置Docker Buildx
echo "🏗️  设置Docker Buildx..."
docker buildx version

echo "✅ Docker环境初始化完成"