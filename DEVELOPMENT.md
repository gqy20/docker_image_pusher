# 开发指南

## Git Hooks 自动化检查

本项目配置了自动化Git Hooks，确保代码质量和格式一致性。

### 🎯 功能特性

- **YAML格式检查**: 自动验证所有提交的YAML文件格式
- **即时反馈**: 提交前发现并报告格式错误
- **详细错误提示**: 提供具体的修复建议
- **团队一致性**: 确保所有开发者使用相同的检查标准

### 📦 安装和设置

#### 首次安装
```bash
# 克隆项目后，运行安装脚本
./scripts/install-hooks.sh
```

#### 手动安装
```bash
# 如果安装脚本不可用，可以手动安装
cp .git-hooks/yaml-pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

### 🚀 使用方法

#### 正常提交流程
```bash
# 添加文件到暂存区
git add .

# 提交时会自动运行YAML检查
git commit -m "提交信息"

# 如果YAML格式正确，提交成功
# 如果有错误，会显示详细信息并阻止提交
```

#### 紧急跳过检查（不推荐）
```bash
git commit --no-verify -m "紧急提交，跳过YAML检查"
```

### 📋 检查范围

Hook会检查以下文件：
- `*.yml`
- `*.yaml`

包括但不限于：
- GitHub Actions工作流文件
- Docker Compose配置文件
- Kubernetes配置文件
- CI/CD配置文件

### 🛠️ 支持的验证工具

Hook会按以下优先级尝试验证工具：

1. **Ruby YAML解析器** (主要)
   - 系统通常自带
   - 快速准确
   - 支持完整YAML规范

2. **Node.js js-yaml** (备选)
   - 如果Node.js可用
   - 详细错误报告
   - 支持现代YAML特性

3. **基本格式检查** (最后备选)
   - 即使没有外部工具也可工作
   - 检查基本语法规则
   - 提供基础错误检测

### 📊 输出示例

#### ✅ 成功检查
```
🔍 Git Pre-commit Hook: YAML格式检查
=====================================
[1] 检查: .github/workflows/issue-sync.yml
✅ 通过: .github/workflows/issue-sync.yml

=====================================
检查结果统计:
- 检查文件总数: 1
- 通过检查: 1
- 格式错误: 0

✅ 所有YAML文件格式检查通过! 🎉
```

#### ❌ 格式错误
```
🔍 Git Pre-commit Hook: YAML格式检查
=====================================
[1] 检查: .github/workflows/invalid.yml
❌ 失败: .github/workflows/invalid.yml

=====================================
检查结果统计:
- 检查文件总数: 1
- 通过检查: 0
- 格式错误: 1

❌ 发现 1 个YAML文件格式错误，提交被阻止

⚠️  修复建议:
1. 检查YAML缩进是否使用空格而非制表符
2. 确保键值对使用冒号分隔
3. 检查列表项使用短横线(-)开头
4. 确保字符串正确引号
5. 使用在线工具验证: https://yamllint.com/
```

### 🔧 维护和更新

#### 更新Hook逻辑
如果需要修改检查逻辑：
1. 编辑 `.git-hooks/yaml-pre-commit` 文件
2. 由于使用符号链接，更改会自动生效
3. 测试修改：`./.git/hooks/pre-commit`

#### 添加新的检查
可以扩展hook来检查其他文件类型：
1. 在现有的YAML检查后添加新的检查函数
2. 更新统计逻辑
3. 测试新的检查功能

### 🐛 故障排除

#### Hook不工作
```bash
# 检查hook是否存在
ls -la .git/hooks/pre-commit

# 检查权限
chmod +x .git/hooks/pre-commit

# 测试hook语法
bash -n .git/hooks/pre-commit
```

#### Ruby不可用
如果系统中没有Ruby：
```bash
# 安装Ruby（Ubuntu/Debian）
sudo apt install ruby

# 或者安装Node.js（用于js-yaml）
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### 符号链接问题
如果符号链接不工作：
```bash
# 删除现有链接
rm .git/hooks/pre-commit

# 重新创建
ln -s ../../.git-hooks/yaml-pre-commit .git/hooks/pre-commit

# 或者直接复制
cp .git-hooks/yaml-pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

### 📚 参考资源

- [YAML官方规范](https://yaml.org/)
- [GitHub Actions文档](https://docs.github.com/en/actions)
- [Git Hooks文档](https://git-scm.com/book/en/v2/Customizing-Git-Git-Hooks)
- [在线YAML验证器](https://yamllint.com/)

### 🤝 团队协作

#### 新团队成员
1. 克隆项目
2. 运行 `./scripts/install-hooks.sh`
3. 确保本地环境有Ruby或Node.js
4. 开始开发

#### 代码审查
- 所有YAML文件修改都会被自动检查
- 减少代码审查中的格式讨论
- 专注于功能逻辑审查

#### CI/CD集成
Git Hooks是本地检查的第一道防线，建议在CI/CD中也添加相同的检查：
```yaml
# 在GitHub Actions中添加YAML检查
- name: Check YAML format
  run: |
    find . -name "*.yml" -o -name "*.yaml" | xargs -I {} ruby -ryaml -e "YAML.load_file('{}')"
```

## 贡献指南

欢迎贡献代码改进！在提交前请确保：

1. ✅ 运行 `./scripts/install-hooks.sh` 确保hooks正常
2. ✅ 所有YAML文件格式正确
3. ✅ 通过所有自动化检查
4. ✅ 遵循项目的代码规范

感谢你的贡献！🎉