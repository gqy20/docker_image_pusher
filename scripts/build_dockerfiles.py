#!/usr/bin/env python3
"""
Dockerfile自动构建处理器
检测dockerfiles文件夹中的变化，自动构建并推送到阿里云仓库
"""

import os
import sys
import argparse
import subprocess
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
import json

@dataclass
class BuildResult:
    """构建结果"""
    total_count: int = 0
    success_count: int = 0
    failed_count: int = 0
    success_images: List[str] = None
    failed_images: List[str] = None

    def __post_init__(self):
        if self.success_images is None:
            self.success_images = []
        if self.failed_images is None:
            self.failed_images = []

class DockerfileBuilder:
    """Dockerfile构建处理器"""

    def __init__(self, namespace: str = None):
        self.namespace = namespace or os.getenv('ALIYUN_NAME_SPACE')
        self.registry = os.getenv('ALIYUN_REGISTRY')

        if not self.namespace:
            raise ValueError("命名空间未设置，请设置ALIYUN_NAME_SPACE环境变量或使用--namespace参数")
        if not self.registry:
            raise ValueError("阿里云仓库地址未设置，请设置ALIYUN_REGISTRY环境变量")

    def get_image_name_from_path(self, dockerfile_path: str) -> tuple[str, str]:
        """
        从Dockerfile路径生成镜像名称和标签

        Args:
            dockerfile_path: Dockerfile文件路径

        Returns:
            (镜像名, 标签)
        """
        # 移除dockerfiles/前缀
        if dockerfile_path.startswith('dockerfiles/'):
            relative_path = dockerfile_path[len('dockerfiles/'):]
        else:
            relative_path = dockerfile_path

        # 移除开头的斜杠
        relative_path = relative_path.lstrip('/')

        # 解析镜像名和标签
        if ':' in relative_path:
            image_name, tag = relative_path.rsplit(':', 1)
        else:
            image_name, tag = relative_path, 'latest'

        # 清理镜像名中的非法字符
        image_name = image_name.replace('/', '-').replace('\\', '-')

        return image_name, tag

    def validate_dockerfile(self, dockerfile_path: str) -> bool:
        """验证Dockerfile是否有效"""
        try:
            with open(dockerfile_path, 'r', encoding='utf-8') as f:
                content = f.read()

            # 基本检查：是否包含FROM指令（忽略注释行）
            lines = [line.strip() for line in content.split('\n') if line.strip() and not line.strip().startswith('#')]
            if not lines or not lines[0].lower().startswith('from'):
                print(f"⚠️ 警告: {dockerfile_path} 可能不是有效的Dockerfile（缺少FROM指令）")
                return False

            # 检查文件大小（避免过大的文件）
            if os.path.getsize(dockerfile_path) > 10 * 1024 * 1024:  # 10MB
                print(f"⚠️ 警告: {dockerfile_path} 文件过大（>10MB），跳过构建")
                return False

            return True

        except Exception as e:
            print(f"❌ 验证Dockerfile失败 {dockerfile_path}: {e}")
            return False

    def build_image(self, dockerfile_path: str, image_name: str, tag: str) -> bool:
        """
        构建并推送单个Docker镜像

        Args:
            dockerfile_path: Dockerfile文件路径
            image_name: 镜像名称
            tag: 镜像标签

        Returns:
            是否成功
        """
        try:
            # 构建完整镜像名
            full_image_name = f"{self.registry}/{self.namespace}/{image_name}:{tag}"

            print(f"🐳 构建镜像: {dockerfile_path} -> {full_image_name}")

            # 获取Dockerfile所在目录作为构建上下文
            dockerfile_dir = os.path.dirname(os.path.abspath(dockerfile_path))
            dockerfile_name = os.path.basename(dockerfile_path)

            # 构建命令
            build_cmd = [
                'docker', 'build',
                '-f', dockerfile_path,  # 指定Dockerfile路径
                '-t', full_image_name,  # 指定镜像标签
                '--no-cache',  # 不使用缓存，确保最新
                dockerfile_dir  # 使用Dockerfile所在目录作为构建上下文
            ]

            print(f"🔧 构建命令: {' '.join(build_cmd)}")

            # 执行构建
            result = subprocess.run(
                build_cmd,
                capture_output=True,
                text=True,
                timeout=1800,  # 30分钟超时
                check=False
            )

            if result.returncode != 0:
                print(f"❌ 构建失败: {dockerfile_path}")
                print(f"错误输出: {result.stderr}")
                return False

            print(f"✅ 构建成功: {full_image_name}")

            # 推送镜像
            print(f"📤 推送镜像: {full_image_name}")
            push_result = subprocess.run(
                ['docker', 'push', full_image_name],
                capture_output=True,
                text=True,
                timeout=600,  # 10分钟超时
                check=False
            )

            if push_result.returncode != 0:
                print(f"❌ 推送失败: {full_image_name}")
                print(f"错误输出: {push_result.stderr}")
                return False

            print(f"✅ 推送成功: {full_image_name}")

            # 清理本地镜像以节省空间
            try:
                subprocess.run(
                    ['docker', 'rmi', full_image_name],
                    capture_output=True,
                    check=False
                )
                print(f"🧹 清理本地镜像: {full_image_name}")
            except:
                pass  # 清理失败不影响构建结果

            return True

        except subprocess.TimeoutExpired:
            print(f"❌ 构建超时: {dockerfile_path}")
            return False
        except Exception as e:
            print(f"❌ 构建异常: {dockerfile_path} - {e}")
            return False

    def load_files_from_list(self, files_list_path: str) -> List[str]:
        """从文件列表加载Dockerfile路径"""
        try:
            with open(files_list_path, 'r', encoding='utf-8') as f:
                files = [line.strip() for line in f if line.strip() and not line.startswith('#')]

            # 验证文件是否存在
            valid_files = []
            for file_path in files:
                if os.path.exists(file_path) and os.path.isfile(file_path):
                    valid_files.append(file_path)
                else:
                    print(f"⚠️ 警告: 文件不存在，跳过: {file_path}")

            return valid_files

        except Exception as e:
            print(f"❌ 读取文件列表失败: {e}")
            return []

    def build_all_dockerfiles(self, files_list: List[str]) -> BuildResult:
        """构建所有Dockerfile"""
        result = BuildResult(total_count=len(files_list))

        if not files_list:
            print("ℹ️ 没有找到需要构建的Dockerfile")
            return result

        print(f"🚀 开始构建 {result.total_count} 个Docker镜像...")
        print("=" * 70)

        for i, dockerfile_path in enumerate(files_list, 1):
            print(f"\n📦 [{i}/{result.total_count}] 处理: {dockerfile_path}")

            # 验证Dockerfile
            if not self.validate_dockerfile(dockerfile_path):
                result.failed_count += 1
                result.failed_images.append(f"❌ {dockerfile_path} (无效的Dockerfile)")
                continue

            # 获取镜像名和标签
            try:
                image_name, tag = self.get_image_name_from_path(dockerfile_path)
                print(f"🏷️  镜像信息: {image_name}:{tag}")
            except Exception as e:
                print(f"❌ 解析镜像名失败: {e}")
                result.failed_count += 1
                result.failed_images.append(f"❌ {dockerfile_path} (解析镜像名失败)")
                continue

            # 构建镜像
            if self.build_image(dockerfile_path, image_name, tag):
                result.success_count += 1
                full_image_name = f"{self.registry}/{self.namespace}/{image_name}:{tag}"
                result.success_images.append(f"✅ {dockerfile_path} -> {full_image_name}")
            else:
                result.failed_count += 1
                result.failed_images.append(f"❌ {dockerfile_path} (构建失败)")

        return result

    def save_results(self, result: BuildResult, output_file: str = "build-result.env"):
        """保存结果到环境变量文件"""
        try:
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(f"TOTAL_COUNT={result.total_count}\n")
                f.write(f"SUCCESS_COUNT={result.success_count}\n")
                f.write(f"FAILED_COUNT={result.failed_count}\n")
                f.write(f"BUILD_COUNT={result.total_count}\n")

                # 使用普通的环境变量格式，兼容bash source
                if result.success_images:
                    success_list = "\\n".join(result.success_images)
                    f.write(f"SUCCESS_IMAGES=\"{success_list}\"\n")
                else:
                    f.write('SUCCESS_IMAGES=""\n')

                if result.failed_images:
                    failed_list = "\\n".join(result.failed_images)
                    f.write(f"FAILED_IMAGES=\"{failed_list}\"\n")
                else:
                    f.write('FAILED_IMAGES=""\n')

        except Exception as e:
            print(f"❌ 保存结果失败: {e}")

def main():
    parser = argparse.ArgumentParser(description='Dockerfile自动构建处理器')
    parser.add_argument('--files', help='包含Dockerfile路径列表的文件')
    parser.add_argument('--namespace', help='阿里云命名空间')
    parser.add_argument('--output', default='build-result.env', help='输出结果文件')
    parser.add_argument('--validate-only', action='store_true', help='仅验证Dockerfile，不构建')

    args = parser.parse_args()

    try:
        # 初始化构建器
        builder = DockerfileBuilder(args.namespace)

        # 加载文件列表
        if not args.files:
            print("❌ 错误：请使用--files参数指定文件列表")
            sys.exit(1)

        dockerfiles = builder.load_files_from_list(args.files)

        if args.validate_only:
            print(f"✅ 验证完成，共 {len(dockerfiles)} 个Dockerfile")
            valid_count = sum(1 for f in dockerfiles if builder.validate_dockerfile(f))
            print(f"✅ 有效文件: {valid_count}/{len(dockerfiles)}")
            return

        # 执行构建
        result = builder.build_all_dockerfiles(dockerfiles)
        builder.save_results(result, args.output)

        print("\n" + "=" * 70)
        print("📊 构建完成统计:")
        print(f"  📋 总数: {result.total_count}")
        print(f"  ✅ 成功: {result.success_count}")
        print(f"  ❌ 失败: {result.failed_count}")

        if result.failed_count > 0:
            print(f"\n⚠️ 有 {result.failed_count} 个构建失败，请查看日志")
            sys.exit(1)
        else:
            print(f"\n🎉 所有镜像构建成功！")

    except Exception as e:
        print(f"❌ 构建失败: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()