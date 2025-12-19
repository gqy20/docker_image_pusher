# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个企业级Docker镜像同步工具，用于将国外Docker镜像智能转存到阿里云私有仓库。项目支持多种触发方式、智能重名处理、多架构同步，并提供了完整的Web管理界面。

## 常用命令

### GitHub Actions工作流
- `git push origin main` - 触发智能同步检查
- 在GitHub Actions页面手动触发 "Manual Docker Image Sync" 工作流
- 创建带`sync`标签的Issue触发同步

### 本地开发和测试
- `./scripts/unified_sync.py --check-only` - 检查配置文件格式
- `./scripts/unified_sync.py --smart` - 智能同步（仅同步缺失镜像）
- `./scripts/unified_sync.py --force` - 强制同步所有镜像
- `./scripts/sync_single_image.sh 'nginx:latest'` - 同步单个镜像

### 环境设置
- `./scripts/docker-setup.sh` - Docker环境初始化

## 项目架构

### 核心组件

1. **统一同步处理器** (`scripts/unified_sync.py`)
   - 支持JSON和文本两种配置格式
   - 智能检测目标仓库镜像状态
   - 增量同步机制，避免重复传输
   - 统一的同步结果处理和报告

2. **GitHub Actions工作流** (`.github/workflows/`)
   - `docker.yaml` - 主同步工作流（推送、定时、手动触发）
   - `issue-sync.yml` - Issue触发同步，智能解析镜像列表
   - `manual-sync.yml` - 手动同步工作流，支持高级选项
   - `update-latest.yml` - Latest标签镜像自动更新
   - `deploy-pages.yml` - Web界面自动部署

3. **Web管理界面** (`web/`)
   - 响应式设计的可视化管理界面
   - GitHub API集成，支持Issue创建和状态监控
   - 本地存储管理，实时状态显示
   - 无需Token的Issue同步模式

4. **辅助脚本**
   - `scripts/sync_single_image.sh` - 单个镜像同步的底层实现
   - `scripts/issue_to_json.py` - Issue内容解析
   - `scripts/json_image_processor.py` - JSON格式镜像处理器

### 配置文件

1. **JSON格式** (`images.json`)
   ```json
   {
     "images": [
       {
         "id": "unique-id",
         "description": "镜像描述",
         "source": {
           "repository": "nginx",
           "tag": "latest"
         },
         "options": {
           "platform": "linux/arm64",
           "priority": 1
         }
       }
     ]
   }
   ```

2. **文本格式** (`images.txt`)
   ```
   nginx:latest
   --platform=linux/arm64 node:18
   k8s.gcr.io/pause:3.9
   ```

### 核心特性

- **智能同步**：检测目标仓库镜像状态，仅同步缺失镜像
- **多架构支持**：AMD64、ARM64等多种架构同步
- **重名处理**：智能处理同名镜像，添加命名空间前缀
- **多种触发**：Issue触发、文件变更、定时、手动触发
- **详细报告**：完整的同步统计和错误处理

### 环境变量配置

项目需要在GitHub Secrets中配置以下环境变量：
- `ALIYUN_REGISTRY` - 阿里云仓库地址
- `ALIYUN_NAME_SPACE` - 阿里云命名空间
- `ALIYUN_REGISTRY_USER` - 阿里云用户名
- `ALIYUN_REGISTRY_PASSWORD` - 阿里云密码

### 代码规范

1. **Python脚本**
   - 使用dataclass定义数据结构
   - 采用类型注解
   - 统一的错误处理和日志输出
   - 支持命令行参数解析

2. **Shell脚本**
   - 使用set -e启用严格模式
   - 完善的错误检查和用户友好的错误信息
   - 统一的日志格式和进度显示

3. **前端代码**
   - 模块化的类设计
   - 事件驱动的UI管理
   - 本地存储和状态管理
   - 响应式设计支持

## 开发注意事项

1. **测试同步功能时**
   - 建议先使用`--check-only`参数验证配置
   - 测试时优先使用小型镜像（如alpine、busybox）
   - 注意阿里云仓库的配额限制

2. **修改工作流时**
   - 确保环境变量名称一致
   - 保持与现有脚本的兼容性
   - 测试不同触发方式的正常工作

3. **扩展Web界面时**
   - 注意GitHub API的CORS限制
   - 使用本地存储减少API调用
   - 保持与现有设计风格一致

4. **镜像同步逻辑**
   - 同名镜像会自动添加命名空间前缀
   - 多架构镜像会添加平台前缀
   - 智能跳过已存在的镜像以节省时间和带宽