# Git Hooks 配置

本目录包含项目级别的Git Hooks，确保团队成员使用一致的代码质量检查。

## 可用的Hooks

### 1. yaml-pre-commit
- **用途**: 在提交前检查YAML文件格式
- **检查范围**: `.yml`, `.yaml` 文件
- **验证工具**: Ruby YAML解析器、Node.js js-yaml
- **行为**: 如果发现格式错误，阻止提交

## 安装方法

### 方法一：自动安装脚本
```bash
# 运行安装脚本
./scripts/install-hooks.sh
```

### 方法二：手动安装
```bash
# 复制hooks到本地Git目录
cp .git-hooks/yaml-pre-commit .git/hooks/pre-commit

# 设置为可执行
chmod +x .git/hooks/pre-commit
```

### 方法三：使用符号链接（推荐，便于更新）
```bash
# 删除现有的pre-commit hook（如果存在）
rm -f .git/hooks/pre-commit

# 创建符号链接
ln -s ../../.git-hooks/yaml-pre-commit .git/hooks/pre-commit
```

## Hook功能

### YAML格式检查
- ✅ 检查YAML语法正确性
- ✅ 验证缩进一致性
- ✅ 检查键值对格式
- ✅ 验证数组和对象语法
- ✅ 支持多文件批量检查
- ✅ 彩色输出，易于阅读
- ✅ 详细的错误提示和修复建议

## 检查的文件类型
- `*.yml`
- `*.yaml`

## 跳过检查（紧急情况）
如果需要紧急跳过检查，可以使用：
```bash
git commit --no-verify -m "紧急提交，跳过YAML检查"
```
**注意**: 仅在紧急情况下使用，确保手动验证YAML格式。

## 验证工具优先级
1. **Ruby YAML解析器** (主要，系统通常自带)
2. **Node.js js-yaml** (备选，如果Node.js可用)
3. **基本格式检查** (最后备选，仅检查基本规则)

## 输出示例

### 成功情况
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

### 失败情况
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

## 维护和更新

如需更新Hook逻辑：
1. 修改 `.git-hooks/yaml-pre-commit` 文件
2. 如果使用符号链接，更改会自动生效
3. 如果使用复制，需要重新复制到 `.git/hooks/` 目录

## 故障排除

### Ruby不可用
如果系统中没有Ruby，hook会自动尝试其他验证方法：
- Node.js js-yaml
- 基本格式检查

### Node.js不可用
如果没有安装Node.js，hook仍可使用Ruby或基本检查。

### 基本检查功能
即使没有任何外部工具，hook也能提供基本的YAML格式检查：
- 空文件检测
- 基本缩进检查
- 简单语法规则验证

## 相关链接
- [YAML官方规范](https://yaml.org/)
- [在线YAML验证器](https://yamllint.com/)
- [Ruby YAML文档](https://ruby-doc.org/stdlib-3.0.0/libdoc/yaml/rdoc/YAML.html)
- [js-yaml项目](https://github.com/nodeca/js-yaml)