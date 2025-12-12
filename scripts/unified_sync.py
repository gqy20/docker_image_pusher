#!/usr/bin/env python3
"""
统一镜像同步处理器
简化版本：一个脚本处理所有逻辑，避免多层嵌套调用
"""

import json
import sys
import os
import subprocess
import argparse
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

@dataclass
class SyncResult:
    """同步结果"""
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

class UnifiedImageSync:
    """统一镜像同步处理器"""

    def __init__(self, config_file: str = None):
        self.config_file = config_file or self._detect_config_file()

    def _detect_config_file(self) -> str:
        """自动检测配置文件"""
        if os.path.exists("images.json"):
            return "images.json"
        elif os.path.exists("images.txt"):
            return "images.txt"
        else:
            raise FileNotFoundError("未找到配置文件 (images.json 或 images.txt)")

    def _load_json_config(self, config_file: str) -> List[Dict[str, Any]]:
        """加载JSON配置"""
        with open(config_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        images = []
        for img_data in data.get('images', []):
            # 支持两种JSON格式
            if 'source' in img_data:
                repo = img_data['source'].get('repository', '')
                tag = img_data['source'].get('tag', 'latest')
                platform = img_data.get('platform') or img_data.get('options', {}).get('platform')
            else:
                repo = img_data.get('name', '')
                tag = img_data.get('tag', 'latest')
                platform = img_data.get('platform')

            if repo:
                images.append({
                    'repository': repo,
                    'tag': tag,
                    'platform': platform,
                    'description': img_data.get('description', '')
                })

        return images

    def _load_text_config(self, config_file: str) -> List[Dict[str, Any]]:
        """加载文本配置"""
        images = []
        with open(config_file, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line or line.startswith('#'):
                    continue

                # 解析平台参数
                platform = None
                if '--platform=' in line:
                    parts = line.split()
                    for part in parts:
                        if part.startswith('--platform='):
                            platform = part.split('=', 1)[1]
                        elif not part.startswith('--platform') and ':' in part and '/' not in part.split(':')[-1]:
                            # 这是镜像名称部分
                            repo_tag = part
                            break
                    else:
                        # 如果没找到，取最后一个部分
                        repo_tag = parts[-1]
                elif '--platform' in line and '=' in line:
                    # 处理 --platform linux/amd64 nginx:latest 格式
                    parts = line.split()
                    platform_idx = -1
                    for i, part in enumerate(parts):
                        if part == '--platform':
                            platform = parts[i + 1]
                            platform_idx = i
                            break

                    # 取最后一个非参数部分作为镜像名
                    repo_tag = parts[-1] if platform_idx != len(parts) - 2 else parts[-1]
                else:
                    repo_tag = line

                # 解析repository和tag
                if ':' in repo_tag:
                    repo, tag = repo_tag.rsplit(':', 1)
                else:
                    repo, tag = repo_tag, 'latest'

                images.append({
                    'repository': repo,
                    'tag': tag,
                    'platform': platform,
                    'description': f'从{config_file}第{line_num}行加载'
                })

        return images

    def load_config(self) -> List[Dict[str, Any]]:
        """加载配置文件"""
        try:
            if self.config_file.endswith('.json'):
                images = self._load_json_config(self.config_file)
            else:
                images = self._load_text_config(self.config_file)

            print(f"✅ 成功加载 {len(images)} 个镜像配置 ({self.config_file})")
            return images

        except Exception as e:
            print(f"❌ 加载配置失败: {e}")
            return []

    def _build_image_spec(self, image: Dict[str, Any]) -> str:
        """构建镜像规格字符串"""
        repo = image['repository']
        tag = image['tag']
        platform = image.get('platform')

        if tag != 'latest':
            full_name = f"{repo}:{tag}"
        else:
            full_name = repo

        if platform:
            return f"--platform={platform} {full_name}"
        return full_name

    def check_image_exists(self, image_spec: str) -> bool:
        """检查镜像是否在目标仓库存在"""
        # 解析镜像规格
        if '--platform=' in image_spec:
            parts = image_spec.split()
            image_name = parts[-1]
        else:
            image_name = image_spec

        # 构建目标镜像名
        if ':' not in image_name:
            image_name += ':latest'

        # 取镜像名部分（去掉registry前缀）
        name_tag = image_name.split('/')[-1]
        target_image = f"{os.getenv('ALIYUN_REGISTRY')}/{os.getenv('ALIYUN_NAME_SPACE')}/{name_tag}"

        try:
            result = subprocess.run(
                ['docker', 'manifest', 'inspect', target_image],
                capture_output=True, text=True, timeout=30
            )
            return result.returncode == 0
        except (subprocess.TimeoutExpired, subprocess.SubprocessError):
            return False

    def sync_image(self, image_spec: str) -> bool:
        """同步单个镜像"""
        script_path = './scripts/sync_single_image.sh'
        if not os.path.exists(script_path):
            print(f"❌ 同步脚本不存在: {script_path}")
            return False

        try:
            result = subprocess.run(
                [script_path, image_spec],
                capture_output=True, text=True, timeout=600,  # 10分钟超时
                check=False
            )
            return result.returncode == 0
        except subprocess.TimeoutExpired:
            print(f"❌ 同步超时: {image_spec}")
            return False
        except subprocess.SubprocessError as e:
            print(f"❌ 同步错误: {e}")
            return False

    def sync_images(self, smart_sync: bool = False, force_sync: bool = False) -> SyncResult:
        """同步镜像"""
        images = self.load_config()
        if not images:
            return SyncResult()

        result = SyncResult(total_count=len(images))

        print(f"🚀 开始同步 {'(智能模式)' if smart_sync else '(强制模式)'} {result.total_count} 个镜像...")

        for i, image in enumerate(images, 1):
            image_spec = self._build_image_spec(image)
            print(f"📦 [{i}/{result.total_count}] 处理镜像: {image_spec}")

            should_sync = force_sync

            if smart_sync and not should_sync:
                if self.check_image_exists(image_spec):
                    print(f"✅ 镜像已存在，跳过: {image['repository']}:{image['tag']}")
                    result.success_count += 1
                    continue
                else:
                    should_sync = True

            if should_sync:
                print(f"🔄 同步镜像: {image_spec}")
                if self.sync_image(image_spec):
                    result.success_count += 1
                    result.success_images.append(f"✅ {image['repository']}:{image['tag']}")
                    print(f"✅ 同步成功")
                else:
                    result.failed_count += 1
                    result.failed_images.append(f"❌ {image['repository']}:{image['tag']}")
                    print(f"❌ 同步失败")

        return result

    def save_results(self, result: SyncResult, output_file: str = "sync-result.env"):
        """保存结果到环境变量文件"""
        try:
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(f"TOTAL_COUNT={result.total_count}\n")
                f.write(f"SUCCESS_COUNT={result.success_count}\n")
                f.write(f"FAILED_COUNT={result.failed_count}\n")
                f.write(f"SYNC_COUNT={result.total_count}\n")

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
    parser = argparse.ArgumentParser(description='统一镜像同步处理器')
    parser.add_argument('-c', '--config', help='配置文件路径')
    parser.add_argument('-o', '--output', default='sync-result.env', help='输出结果文件')
    parser.add_argument('-f', '--force', action='store_true', help='强制同步所有镜像')
    parser.add_argument('-s', '--smart', action='store_true', help='智能同步（仅同步缺失的镜像）')
    parser.add_argument('--check-only', action='store_true', help='仅检查和加载配置')

    args = parser.parse_args()

    # 参数检查
    if args.force and args.smart:
        print("❌ 错误：--force 和 --smart 不能同时使用")
        sys.exit(1)

    if not args.force and not args.smart:
        args.smart = True  # 默认使用智能同步

    try:
        sync = UnifiedImageSync(args.config)

        if args.check_only:
            images = sync.load_config()
            print(f"✅ 配置检查完成，共 {len(images)} 个镜像")
            return

        result = sync.sync_images(smart_sync=args.smart, force_sync=args.force)
        sync.save_results(result, args.output)

        print("\n📊 同步完成统计:")
        print(f"  📋 总数: {result.total_count}")
        print(f"  ✅ 成功: {result.success_count}")
        print(f"  ❌ 失败: {result.failed_count}")

        if result.failed_count > 0:
            sys.exit(1)

    except Exception as e:
        print(f"❌ 同步失败: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()