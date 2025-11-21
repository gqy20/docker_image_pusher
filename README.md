# Docker Images Pusher

[![GitHub stars](https://img.shields.io/github/stars/gqy20/docker_image_pusher?style=social)](https://github.com/gqy20/docker_image_pusher/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/gqy20/docker_image_pusher?style=social)](https://github.com/gqy20/docker_image_pusher/network)
[![GitHub license](https://img.shields.io/github/license/gqy20/docker_image_pusher)](https://github.com/gqy20/docker_image_pusher/blob/main/LICENSE)

> 使用 GitHub Action 将国外的 Docker 镜像转存到阿里云私有仓库，供国内服务器使用，免费易用

**原作作者：[技术爬爬虾](https://github.com/tech-shrimp/me)** | Fork 自原作并进行优化改进

## ✨ 特性

- 🚀 **多仓库支持** - 支持 DockerHub、gcr.io、k8s.io、ghcr.io 等任意仓库
- 📦 **大镜像支持** - 支持最大 40GB 的大型镜像
- ⚡ **高速传输** - 使用阿里云官方线路，速度快
- 🏗️ **多架构支持** - 支持 AMD64、ARM64 等多种架构
- 🔄 **自动化同步** - 支持定时自动同步更新
- 📝 **智能重名处理** - 自动处理镜像重名情况
- 🎯 **零成本使用** - 完全免费，无需服务器

## 📺 视频教程

[B站视频教程](https://www.bilibili.com/video/BV1Zn4y19743/)

## 📖 目录

- [快速开始](#-快速开始)
- [详细配置](#-详细配置)
- [使用说明](#-使用说明)
- [高级功能](#-高级功能)
- [常见问题](#-常见问题)
- [贡献指南](#-贡献指南)

## 🚀 快速开始

### 1. 配置阿里云

登录 [阿里云容器镜像服务](https://cr.console.aliyun.com/)，启用个人实例并创建命名空间。

**获取凭证信息：**
- 命名空间：`ALIYUN_NAME_SPACE`
- 用户名：`ALIYUN_REGISTRY_USER`
- 密码：`ALIYUN_REGISTRY_PASSWORD`
- 仓库地址：`ALIYUN_REGISTRY`

### 2. Fork 并配置项目

1. Fork 本项目到你的 GitHub 账户
2. 进入项目的 Settings → Secrets and variables → Actions
3. 添加以下 Repository secrets：

| 名称 | 描述 |
|------|------|
| `ALIYUN_NAME_SPACE` | 阿里云命名空间 |
| `ALIYUN_REGISTRY_USER` | 阿里云用户名 |
| `ALIYUN_REGISTRY_PASSWORD` | 阿里云密码 |
| `ALIYUN_REGISTRY` | 阿里云仓库地址 |

### 3. 添加镜像

编辑 `images.txt` 文件，添加需要同步的镜像：

```bash
# 基本格式
nginx
nginx:1.21
# 指定架构
nginx --platform=linux/arm64
# 不同仓库
k8s.gcr.io/kube-state-metrics/kube-state-metrics:v1.9.0
ghcr.io/user/repo:tag
```

<img src="doc/images.png" alt="images.txt配置示例" width="600"/>

### 4. 启动同步

提交 `images.txt` 文件，GitHub Action 将自动开始同步。

## ⚙️ 详细配置

### 阿里云容器镜像服务配置

1. **创建命名空间**

   <img src="doc/命名空间.png" alt="创建命名空间" width="600"/>

2. **获取访问凭证**

   <img src="doc/用户名密码.png" alt="获取访问凭证" width="600"/>

### GitHub Action 配置

1. **启用 Action 功能**

   进入项目页面，点击 Action 标签，启用 GitHub Action 功能

2. **配置环境变量**

   <img src="doc/配置环境变量.png" alt="配置环境变量" width="600"/>

## 📝 使用说明

### images.txt 文件格式

```bash
# 注释行以 # 开头
nginx                                    # 默认使用 latest 标签
nginx:1.21-alpine                        # 指定标签
nginx --platform=linux/arm64             # 指定架构
k8s.gcr.io/kube-state-metrics/kube-state-metrics:v2.0.0  # k8s 镜像
ghcr.io/actions/runner:latest             # GitHub Container Registry
```

### 拉取镜像

同步完成后，在国内服务器上拉取镜像：

```bash
docker pull registry.cn-hangzhou.aliyuncs.com/你的命名空间/镜像名:标签
```

示例：
```bash
docker pull registry.cn-hangzhou.aliyuncs.com/my-namespace/nginx:latest
```

### 多架构支持

在 `images.txt` 中使用 `--platform` 参数指定镜像架构：

```bash
# 单架构示例
--platform=linux/arm64 nginx

# 多架构示例（同一镜像的不同架构）
--platform=linux/amd64 ubuntu
--platform=linux/arm64 ubuntu

# 其他常用架构
--platform=linux/arm64/v8 node
--platform=linux/386 alpine
```

指定架构后，架构名称会以前缀形式添加到镜像名前面：

```
registry.cn-hangzhou.aliyuncs.com/namespace/linux_arm64_nginx:latest
```

<img src="doc/多架构.png" alt="多架构支持示例" width="600"/>

### 镜像重名处理

程序会自动检测重名镜像并智能处理：

```bash
# 如果有重名镜像，会自动添加命名空间前缀
xhofe/alist           # 同步为 xhofe_alist
xiaoyaliu/alist       # 同步为 xiaoyaliu_alist
```

<img src="doc/镜像重名.png" alt="镜像重名处理示例" width="600"/>

### 定时同步

#### 1. 镜像自动更新

系统会自动检查并更新 `images.txt` 中未指定版本的镜像：

- **触发时间**: 每周一北京时间上午6点（UTC时间22:00）
- **更新规则**:
  - 无版本标签的镜像（如 `nginx`）→ 自动添加 `:latest`
  - 已是 `:latest` 的镜像 → 保持不变
  - 指定版本的镜像（如 `postgres:15-alpine`）→ 保持不变
  - 多架构镜像同样支持自动更新

- **📍 重要说明：更新机制**
  - **不是新增**：不会在阿里云上创建新的镜像副本
  - **而是更新**：会重新拉取最新的源镜像并推送到阿里云同名仓库
  - **覆盖更新**：阿里云上的同名镜像会被新版本完全覆盖
  - **标签保持**：镜像仓库中的标签名保持不变（如 `nginx:latest`）

  **举例说明**：
  - 如果阿里云上已有 `nginx:latest`（版本1.20）
  - Docker Hub 的 `nginx:latest` 更新到版本1.21
  - 自动更新后，阿里云的 `nginx:latest` 将变为版本1.21
  - 不会创建 `nginx:1.21` 的新标签，只是覆盖更新 `:latest`

#### 2. 智能同步机制

系统采用**增量同步**策略，只有当 `images.txt` 文件发生变化时才会触发同步：

- **智能触发**: 仅在 `images.txt` 发生变化时执行
- **增量处理**: 只处理新增或修改的镜像行
- **跳过未变化**: 已存在的镜像不会重复拉取
- **详细日志**: 清晰显示处理的镜像列表和统计结果

**首次提交**会处理所有镜像，后续提交只处理变更部分。

#### 3. 自定义定时同步

修改 `.github/workflows/docker.yaml` 文件，添加 `schedule` 触发器：

```yaml
on:
  push:
    branches: [ main ]
    paths:
      - 'images.txt'  # 只有images.txt变化时才触发
  schedule:
    # 每天北京时间上午9点执行（UTC时区）
    - cron: '0 1 * * *'
  workflow_dispatch:
```

<img src="doc/定时执行.png" alt="定时执行配置" width="600"/>

### 镜像状态查看

回到阿里云镜像仓库，可以查看镜像同步状态。可以将镜像设为公开，实现免登录拉取。

<img src="doc/开始使用.png" alt="镜像状态查看" width="600"/>

## ❓ 常见问题

### Q: 同步失败了怎么办？
A: 检查以下几点：
1. 确认阿里云配置信息正确（特别是 `ALIYUN_NAME_SPACE` 不能为空）
2. 检查源镜像是否存在
3. 确认镜像大小不超过40GB限制
4. 查看 GitHub Action 日志获取详细错误信息

常见错误：
- `invalid reference format`: 通常是 `ALIYUN_NAME_SPACE` 配置为空导致的
- `denied: requested access to the resource is denied`: 用户名或密码错误
- `Error processing tar file`: 镜像损坏或网络问题

### Q: 如何同步私有镜像？
A: 目前不支持私有镜像同步，仅支持公共镜像仓库。

### Q: 同步速度很慢怎么办？
A: 同步速度取决于多个因素：
- 源镜像服务器位置
- 镜像大小
- 网络状况

建议在网络较好的时间段同步。

### Q: 可以同时同步多个镜像吗？
A: 可以，在 `images.txt` 中每行一个镜像即可，会并行处理。

### Q: 如何删除已同步的镜像？
A: 登录阿里云容器镜像服务，手动删除不需要的镜像。

### Q: 定时更新会不会影响我指定的版本？
A: 不会。自动更新功能只会处理：
- 没有版本标签的镜像（如 `nginx`）
- 已经是 `:latest` 的镜像

所有指定具体版本的镜像（如 `postgres:15-alpine`、`mysql:8.0`）都会保持不变。

### Q: 如何手动触发镜像更新？
A: 可以在 GitHub Actions 页面手动触发 "Update Latest Images" 工作流，或者编辑 `images.txt` 文件来触发更新。

### Q: 定时更新后阿里云上会有多个镜像版本吗？
A: 不会。定时更新是**覆盖更新**模式：
- 不会创建新的标签（如不会同时存在 `nginx:1.20` 和 `nginx:1.21`）
- 只会更新现有标签（如 `nginx:latest` 从1.20更新到1.21）
- 如果需要保留特定版本，请手动指定版本号（如 `nginx:1.20-alpine`）

### Q: 更新后正在使用的服务会受影响吗？
A: 如果您的服务使用 `:latest` 标签：
- 重新拉取镜像时会获取新版本
- 建议在生产环境中指定具体版本号以避免意外更新
- 如需回滚，可以重新指定之前的版本标签

### Q: 每次修改images.txt都会同步所有镜像吗？
A: 不会！系统采用**智能增量同步**：
- 只有 `images.txt` 发生变化时才触发同步
- 只处理新增或修改的镜像行
- 已存在的镜像不会重复拉取，节省时间和带宽
- 如果只是注释变化，不会触发镜像同步

### Q: 如何强制同步所有镜像？
A: 有几种方式：
1. 手动触发 GitHub Actions 中的工作流
2. 删除并重新创建 `images.txt` 文件
3. 修改工作流去除增量检测逻辑（不推荐）

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

### 提交 Issue
- 使用清晰描述标题
- 提供详细的错误信息和复现步骤
- 附上相关日志信息

### 提交 Pull Request
- Fork 本项目
- 创建特性分支 (`git checkout -b feature/AmazingFeature`)
- 提交更改 (`git commit -m 'Add some AmazingFeature'`)
- 推送到分支 (`git push origin feature/AmazingFeature`)
- 创建 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

**原作作者：[技术爬爬虾](https://github.com/tech-shrimp/me)**

B站、抖音、YouTube 全网同名，转载请注明原作者

- 📺 [B站视频教程](https://www.bilibili.com/video/BV1Zn4y19743/)
- 🐛 [原作者 GitHub](https://github.com/tech-shrimp/me)
- 🌟 [给原作者项目点 Star](https://github.com/tech-shrimp/docker-image-pusher)

### 支持作者

如果这个项目对你有帮助，请给个 ⭐ Star 支持一下！

## 📞 联系方式

- GitHub Issues: [提交问题](https://github.com/gqy20/docker_image_pusher/issues)
- 原作者 B站: [@技术爬爬虾](https://www.bilibili.com/video/BV1Zn4y19743/)

---

**⚠️ 重要声明**：本项目基于 [技术爬爬虾](https://github.com/tech-shrimp/me) 的原作进行 Fork 和优化，版权归原作者所有。
