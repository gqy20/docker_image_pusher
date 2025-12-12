#!/usr/bin/env python3
"""
将Issue中的镜像列表转换为JSON配置文件
"""

import json
import sys
import os

def convert_issue_to_json(input_file='issue_images.txt', output_file='issue_images.json'):
    """将Issue镜像列表转换为JSON配置"""

    # 读取镜像列表
    try:
        with open(input_file, 'r') as f:
            images = [line.strip() for line in f if line.strip()]
    except FileNotFoundError:
        print(f"❌ 找不到输入文件: {input_file}")
        return False

    # 创建JSON配置
    config = {
        "version": "1.0",
        "metadata": {
            "description": "从GitHub Issue创建的临时配置",
            "created": os.popen("date -u +%Y-%m-%dT%H:%M:%S.%NZ").read().strip(),
            "source": "GitHub Issue"
        },
        "images": []
    }

    # 添加镜像配置
    for i, img in enumerate(images, 1):
        # 解析镜像名称和标签
        if ':' in img:
            repo, tag = img.rsplit(':', 1)
        else:
            repo, tag = img, 'latest'

        config["images"].append({
            "id": f"issue-{i:03d}",
            "description": f"从Issue第{i}行提取",
            "source": {
                "repository": repo,
                "tag": tag
            },
            "options": {
                "platform": None,
                "private_registry": False,
                "skip_existing": True,
                "priority": i
            }
        })

    # 保存为JSON文件
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2, ensure_ascii=False)

        print(f"✅ 成功创建临时JSON配置，包含 {len(config['images'])} 个镜像")
        return True
    except Exception as e:
        print(f"❌ 保存JSON配置失败: {e}")
        return False

if __name__ == '__main__':
    if len(sys.argv) > 1:
        input_file = sys.argv[1]
    if len(sys.argv) > 2:
        output_file = sys.argv[2]

    success = convert_issue_to_json()
    sys.exit(0 if success else 1)