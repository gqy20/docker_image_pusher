#!/bin/bash

# Git Hooks 安装脚本
# 用于安装项目级别的Git Hooks

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOOKS_DIR="$PROJECT_ROOT/.git-hooks"
GIT_HOOKS_DIR="$PROJECT_ROOT/.git/hooks"

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# 检查是否在Git仓库中
check_git_repo() {
    if [ ! -d "$PROJECT_ROOT/.git" ]; then
        print_error "当前目录不是Git仓库"
        exit 1
    fi
    print_success "检测到Git仓库"
}

# 创建Git hooks目录
create_hooks_dir() {
    if [ ! -d "$GIT_HOOKS_DIR" ]; then
        mkdir -p "$GIT_HOOKS_DIR"
        print_success "创建Git hooks目录"
    else
        print_info "Git hooks目录已存在"
    fi
}

# 安装pre-commit hook
install_pre_commit() {
    local source_file="$HOOKS_DIR/yaml-pre-commit"
    local target_file="$GIT_HOOKS_DIR/pre-commit"

    if [ ! -f "$source_file" ]; then
        print_error "找不到源文件: $source_file"
        exit 1
    fi

    # 备份现有的pre-commit hook
    if [ -f "$target_file" ]; then
        local backup_file="${target_file}.backup.$(date +%Y%m%d_%H%M%S)"
        cp "$target_file" "$backup_file"
        print_warning "已备份现有pre-commit hook到: $backup_file"
    fi

    # 删除现有文件（如果是符号链接也删除）
    rm -f "$target_file"

    # 创建符号链接（推荐方式）
    if ln -s "../../.git-hooks/yaml-pre-commit" "$target_file" 2>/dev/null; then
        print_success "使用符号链接安装pre-commit hook"
    else
        # 如果符号链接失败，复制文件
        cp "$source_file" "$target_file"
        chmod +x "$target_file"
        print_success "复制并安装pre-commit hook"
    fi
}

# 验证安装
verify_installation() {
    local target_file="$GIT_HOOKS_DIR/pre-commit"

    if [ -f "$target_file" ]; then
        if [ -x "$target_file" ]; then
            print_success "pre-commit hook已成功安装并可执行"
        else
            chmod +x "$target_file"
            print_success "pre-commit hook已安装并设置为可执行"
        fi

        # 测试hook语法
        if bash -n "$target_file" 2>/dev/null; then
            print_success "pre-commit hook语法检查通过"
        else
            print_warning "pre-commit hook语法检查失败，但可能仍可工作"
        fi
    else
        print_error "pre-commit hook安装失败"
        exit 1
    fi
}

# 显示使用说明
show_usage_info() {
    print_info "Git Hooks安装完成！"
    echo
    print_info "使用说明:"
    echo "1. 现在每次提交前会自动检查YAML文件格式"
    echo "2. 如果发现格式错误，提交将被阻止"
    echo "3. Hook会显示详细的错误信息和修复建议"
    echo
    print_info "紧急跳过检查（不推荐）:"
    echo "  git commit --no-verify -m \"message\""
    echo
    print_info "更新Hook逻辑:"
    echo "  修改 .git-hooks/yaml-pre-commit 文件"
    echo
    print_info "更多信息请查看:"
    echo "  .git-hooks/README.md"
}

# 主函数
main() {
    echo -e "${BLUE}🚀 Git Hooks 安装程序${NC}"
    echo "======================================"
    echo

    check_git_repo
    create_hooks_dir
    install_pre_commit
    verify_installation
    show_usage_info

    echo
    print_success "安装完成！🎉"
}

# 运行主函数
main "$@"