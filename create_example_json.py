#!/usr/bin/env python3
"""
创建示例JSON配置文件和迁移工具
"""

import json
import os
from datetime import datetime

def create_example_json():
    """创建示例JSON配置文件"""
    
    # 基于当前images.txt内容创建JSON配置
    images = [
        {
            "id": "nginx-latest",
            "description": "官方Nginx Web服务器",
            "source": {
                "repository": "nginx",
                "tag": "latest"
            },
            "options": {
                "platform": None,
                "private_registry": False,
                "skip_existing": True,
                "priority": 1
            }
        },
        {
            "id": "kube-state-metrics-v2",
            "description": "Kubernetes状态指标收集器",
            "source": {
                "repository": "k8s.gcr.io/kube-state-metrics/kube-state-metrics",
                "tag": "v2.0.0"
            },
            "options": {
                "platform": None,
                "private_registry": True,
                "skip_existing": True,
                "priority": 2
            }
        },
        {
            "id": "alist-latest",
            "description": "Alist文件列表服务",
            "source": {
                "repository": "xhofe/alist",
                "tag": "latest"
            },
            "options": {
                "platform": None,
                "private_registry": False,
                "skip_existing": True,
                "priority": 3
            }
        },
        {
            "id": "alist-arm64",
            "description": "Alist ARM64架构版本",
            "source": {
                "repository": "xiaoyaliu/alist",
                "tag": "latest"
            },
            "options": {
                "platform": "linux/arm64",
                "private_registry": False,
                "skip_existing": True,
                "priority": 3
            }
        },
        {
            "id": "deepvariant-gpu-1.10.0",
            "description": "Google DeepVariant GPU版本",
            "source": {
                "repository": "google/deepvariant",
                "tag": "1.10.0-beta-gpu"
            },
            "options": {
                "platform": None,
                "private_registry": False,
                "skip_existing": True,
                "priority": 5
            }
        },
        {
            "id": "deepvariant-gpu-1.9.0",
            "description": "Google DeepVariant GPU版本",
            "source": {
                "repository": "google/deepvariant",
                "tag": "1.9.0-gpu"
            },
            "options": {
                "platform": None,
                "private_registry": False,
                "skip_existing": True,
                "priority": 5
            }
        }
    ]
    
    config = {
        "version": "1.0",
        "metadata": {
            "description": "Docker镜像同步配置",
            "created": datetime.now().isoformat(),
            "format": "json"
        },
        "sync_config": {
            "parallel_limit": 2,
            "retry_count": 3,
            "timeout_minutes": 30
        },
        "images": images
    }
    
    # 写入JSON文件
    with open('images.json', 'w', encoding='utf-8') as f:
        json.dump(config, f, indent=2, ensure_ascii=False)
    
    print("✅ 创建示例JSON配置文件: images.json")
    
    # 同时创建简单格式版本
    simple_config = {"images": []}
    for img in images:
        simple_img = {
            "name": img["source"]["repository"],
            "tag": img["source"]["tag"]
        }
        if img["options"]["platform"]:
            simple_img["platform"] = img["options"]["platform"]
        simple_config["images"].append(simple_img)
    
    with open('images_simple.json', 'w', encoding='utf-8') as f:
        json.dump(simple_config, f, indent=2)
    
    print("✅ 创建简单JSON配置文件: images_simple.json")

def migrate_from_txt():
    """从现有的images.txt迁移到JSON格式"""
    if not os.path.exists('images.txt'):
        print("❌ images.txt文件不存在")
        return
    
    images = []
    
    with open('images.txt', 'r', encoding='utf-8') as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            
            # 跳过空行和注释
            if not line or line.startswith('#'):
                continue
            
            # 解析镜像信息
            if line.startswith('--platform'):
                # 有平台参数的镜像
                parts = line.split()
                platform = parts[1]  # --platform=linux/arm64
                image_name = ' '.join(parts[2:])  # xiaoyaliu/alist
            else:
                # 普通镜像
                platform = None
                image_name = line
            
            # 解析repository和tag
            if ':' in image_name:
                repo, tag = image_name.rsplit(':', 1)
            else:
                repo, tag = image_name, 'latest'
            
            images.append({
                "id": f"migrated-{line_num:03d}",
                "description": f"从images.txt第{line_num}行迁移",
                "source": {
                    "repository": repo,
                    "tag": tag
                },
                "options": {
                    "platform": platform,
                    "private_registry": 'k8s.gcr.io' in repo or 'gcr.io' in repo,
                    "skip_existing": True,
                    "priority": line_num
                }
            })
    
    config = {
        "version": "1.0",
        "metadata": {
            "description": "从images.txt迁移的JSON配置",
            "created": datetime.now().isoformat(),
            "migrated_from": "images.txt"
        },
        "images": images
    }
    
    with open('images_migrated.json', 'w', encoding='utf-8') as f:
        json.dump(config, f, indent=2, ensure_ascii=False)
    
    print(f"✅ 从images.txt迁移了 {len(images)} 个镜像到 images_migrated.json")

if __name__ == '__main__':
    create_example_json()
    if os.path.exists('images.txt'):
        migrate_from_txt()
