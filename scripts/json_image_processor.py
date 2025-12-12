#!/usr/bin/env python3
"""
JSON格式镜像同步处理器

替换原有的text-based images.txt格式，使用JSON提供更好的结构化和错误处理。
"""

import json
import sys
import os
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime

@dataclass
class ImageConfig:
    """镜像配置数据类"""
    id: str
    source_repo: str
    source_tag: str
    platform: Optional[str] = None
    private_registry: bool = False
    custom_name: Optional[str] = None
    description: Optional[str] = None
    priority: int = 1

class JSONImageProcessor:
    """JSON格式镜像处理器"""
    
    def __init__(self, config_file: str = "images.json"):
        self.config_file = config_file
        self.images: List[ImageConfig] = []
        
    def load_config(self, config_file: Optional[str] = None) -> bool:
        """加载JSON配置文件"""
        if config_file:
            self.config_file = config_file

        try:
            if not os.path.exists(self.config_file):
                print(f"❌ 配置文件不存在: {self.config_file}")
                return False

            with open(self.config_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
            # 验证配置格式
            if 'images' not in data:
                print("❌ JSON配置中缺少'images'字段")
                return False
                
            # 解析镜像配置
            self.images = []
            for idx, img_data in enumerate(data['images']):
                config = self._parse_image_config(img_data, idx)
                if config:
                    self.images.append(config)
                    
            print(f"✅ 成功加载 {len(self.images)} 个镜像配置")
            return True
            
        except json.JSONDecodeError as e:
            print(f"❌ JSON解析错误: {e}")
            return False
        except Exception as e:
            print(f"❌ 加载配置失败: {e}")
            return False
    
    def _parse_image_config(self, img_data: Dict[str, Any], index: int) -> Optional[ImageConfig]:
        """解析单个镜像配置"""
        try:
            # 支持多种格式
            
            # 格式1: 简单格式 { "name": "nginx", "tag": "latest" }
            if 'name' in img_data and 'tag' in img_data:
                source_repo = img_data['name']
                source_tag = img_data['tag']

                # 验证必要字段
                if not source_repo or not source_repo.strip():
                    print(f"❌ 镜像配置缺少name字段，索引: {index}")
                    return None
                
            # 格式2: 增强格式 { "source": { "repository": "...", "tag": "..." } }
            elif 'source' in img_data:
                source_repo = img_data['source'].get('repository', '')
                source_tag = img_data['source'].get('tag', 'latest')
            else:
                print(f"❌ 镜像配置格式错误，索引: {index}")
                return None

            # 验证必要字段
            if not source_repo or not source_repo.strip():
                print(f"❌ 镜像配置缺少repository字段，索引: {index}")
                return None
                
            # 提取其他属性
            # 支持从根级别或options级别提取属性
            options = img_data.get('options', {})

            platform = img_data.get('platform') or options.get('platform')
            private_registry = img_data.get('private_registry', options.get('private_registry', False))
            custom_name = img_data.get('custom_name') or options.get('custom_name') or img_data.get('target', {}).get('custom_name')
            description = img_data.get('description') or options.get('description')
            priority = img_data.get('priority', options.get('priority', 1))
            
            # 生成ID（如果未指定）
            image_id = img_data.get('id', f"img-{index:03d}")
            
            return ImageConfig(
                id=image_id,
                source_repo=source_repo,
                source_tag=source_tag,
                platform=platform,
                private_registry=private_registry,
                custom_name=custom_name,
                description=description,
                priority=priority
            )
            
        except Exception as e:
            print(f"❌ 解析镜像配置失败，索引: {index}, 错误: {e}")
            return None
    
    def sync_needed_images(self, output_file: str = "sync_result.env") -> Dict[str, Any]:
        """同步需要的镜像"""
        results = {
            'total_count': len(self.images),
            'success_count': 0,
            'failed_count': 0,
            'skipped_count': 0,
            'success_images': [],
            'failed_images': []
        }
        
        print(f"🚀 开始同步 {results['total_count']} 个镜像...")
        
        # 按优先级排序
        sorted_images = sorted(self.images, key=lambda x: x.priority)
        
        for config in sorted_images:
            print(f"📦 处理镜像: {config.source_repo}:{config.source_tag}")
            
            # 构建完整的镜像名称
            full_image = f"{config.source_repo}:{config.source_tag}"
            if config.platform:
                full_image = f"--platform={config.platform} {full_image}"
            
            # 调用原有的同步脚本（兼容现有流程）
            exit_code = os.system(f"./scripts/sync_single_image.sh '{full_image}'")
            
            if exit_code == 0:
                results['success_count'] += 1
                results['success_images'].append({
                    'id': config.id,
                    'name': full_image,
                    'description': config.description
                })
                print(f"✅ 同步成功: {config.id}")
            else:
                results['failed_count'] += 1
                results['failed_images'].append({
                    'id': config.id,
                    'name': full_image,
                    'error': f"Exit code: {exit_code}"
                })
                print(f"❌ 同步失败: {config.id}")
        
        # 保存结果到文件（兼容现有流程）
        self._save_results(results, output_file)
        
        print("📊 同步完成:")
        print(f"  📋 总数: {results['total_count']}")
        print(f"  ✅ 成功: {results['success_count']}")
        print(f"  ❌ 失败: {results['failed_count']}")
        
        return results
    
    def _save_results(self, results: Dict[str, Any], output_file: str):
        """保存结果到环境变量文件"""
        try:
            with open(output_file, 'w', encoding='utf-8') as f:
                # 兼容多种变量命名约定
                f.write(f"TOTAL_COUNT={results['total_count']}\n")
                f.write(f"SUCCESS_COUNT={results['success_count']}\n")
                f.write(f"FAILED_COUNT={results['failed_count']}\n")
                f.write(f"SYNC_COUNT={results['total_count']}\n")  # 别名
                
                # 成功镜像列表
                f.write("SUCCESS_IMAGES<<EOF\n")
                for img in results['success_images']:
                    f.write(f"✅ {img['id']}: {img['name']}\n")
                f.write("EOF\n")
                
                # 失败镜像列表
                f.write("FAILED_IMAGES<<EOF\n")
                for img in results['failed_images']:
                    f.write(f"❌ {img['id']}: {img['name']} ({img['error']})\n")
                f.write("EOF\n")
                
        except Exception as e:
            print(f"❌ 保存结果失败: {e}")

def main():
    """主函数"""
    import argparse

    parser = argparse.ArgumentParser(description='JSON格式镜像同步处理器')
    parser.add_argument('-c', '--config', default='images.json', help='JSON配置文件路径')
    parser.add_argument('-o', '--output', default='sync-result.env', help='输出结果文件')
    parser.add_argument('--validate', action='store_true', help='仅验证配置文件格式')
    parser.add_argument('--check-only', action='store_true', help='仅检查和加载配置，不执行同步')

    args = parser.parse_args()

    processor = JSONImageProcessor(args.config)

    if not processor.load_config():
        sys.exit(1)

    if args.validate:
        print("✅ 配置文件验证通过")
        return

    if args.check_only:
        print(f"✅ 成功加载 {len(processor.images)} 个镜像配置")
        return

    results = processor.sync_needed_images(args.output)

    # 返回适当的退出码
    if results['failed_count'] > 0:
        sys.exit(1)

if __name__ == '__main__':
    main()
