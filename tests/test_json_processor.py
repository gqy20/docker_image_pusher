#!/usr/bin/env python3
"""
JSON镜像处理器的单元测试
TDD模式：先写测试，再实现功能
"""

import unittest
import json
import tempfile
import os
import sys
from unittest.mock import patch, MagicMock

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

try:
    from json_image_processor import JSONImageProcessor, ImageConfig
except ImportError:
    print("Error: json_image_processor module not found")
    sys.exit(1)

class TestJSONImageProcessor(unittest.TestCase):
    """JSON处理器测试类"""
    
    def setUp(self):
        """测试前准备"""
        self.processor = JSONImageProcessor()
        
    def test_load_valid_simple_config(self):
        """测试加载有效的简单JSON配置"""
        # 创建临时测试配置文件
        test_config = {
            "images": [
                {
                    "name": "nginx",
                    "tag": "latest"
                },
                {
                    "name": "alpine",
                    "tag": "3.18"
                }
            ]
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(test_config, f)
            temp_file = f.name
        
        try:
            # 测试加载配置
            result = self.processor.load_config(temp_file)
            self.assertTrue(result)
            self.assertEqual(len(self.processor.images), 2)
            self.assertEqual(self.processor.images[0].source_repo, "nginx")
            self.assertEqual(self.processor.images[0].source_tag, "latest")
            self.assertEqual(self.processor.images[1].source_repo, "alpine")
            self.assertEqual(self.processor.images[1].source_tag, "3.18")
        finally:
            os.unlink(temp_file)
    
    def test_load_valid_enhanced_config(self):
        """测试加载增强版JSON配置"""
        test_config = {
            "version": "1.0",
            "metadata": {
                "description": "测试配置"
            },
            "images": [
                {
                    "id": "test-1",
                    "description": "测试镜像1",
                    "source": {
                        "repository": "nginx",
                        "tag": "1.21"
                    },
                    "options": {
                        "platform": "linux/amd64",
                        "private_registry": False,
                        "priority": 1
                    }
                }
            ]
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(test_config, f)
            temp_file = f.name
        
        try:
            result = self.processor.load_config(temp_file)
            self.assertTrue(result)
            self.assertEqual(len(self.processor.images), 1)
            
            config = self.processor.images[0]
            self.assertEqual(config.id, "test-1")
            self.assertEqual(config.description, "测试镜像1")
            self.assertEqual(config.source_repo, "nginx")
            self.assertEqual(config.source_tag, "1.21")
            self.assertEqual(config.platform, "linux/amd64")
            self.assertFalse(config.private_registry)
            self.assertEqual(config.priority, 1)
        finally:
            os.unlink(temp_file)
    
    def test_load_nonexistent_file(self):
        """测试加载不存在的文件"""
        processor = JSONImageProcessor("nonexistent.json")
        result = processor.load_config()
        self.assertFalse(result)
    
    def test_load_invalid_json(self):
        """测试加载无效JSON文件"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            f.write('invalid json content')
            temp_file = f.name
        
        try:
            processor = JSONImageProcessor(temp_file)
            result = processor.load_config()
            self.assertFalse(result)
        finally:
            os.unlink(temp_file)
    
    def test_load_json_missing_images_field(self):
        """测试JSON缺少images字段"""
        test_config = {
            "version": "1.0",
            "metadata": {"description": "测试"}
            # 缺少images字段
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(test_config, f)
            temp_file = f.name
        
        try:
            processor = JSONImageProcessor(temp_file)
            result = processor.load_config()
            self.assertFalse(result)
        finally:
            os.unlink(temp_file)
    
    def test_parse_image_config_simple_format(self):
        """测试解析简单格式的镜像配置"""
        img_data = {
            "name": "nginx",
            "tag": "latest"
        }
        
        config = self.processor._parse_image_config(img_data, 0)
        self.assertIsNotNone(config)
        self.assertEqual(config.source_repo, "nginx")
        self.assertEqual(config.source_tag, "latest")
        self.assertIsNone(config.platform)
        self.assertEqual(config.priority, 1)
    
    def test_parse_image_config_enhanced_format(self):
        """测试解析增强格式的镜像配置"""
        img_data = {
            "id": "test-image",
            "description": "测试描述",
            "source": {
                "repository": "test/app",
                "tag": "v1.0.0"
            },
            "options": {
                "platform": "linux/arm64",
                "private_registry": True,
                "priority": 5
            }
        }
        
        config = self.processor._parse_image_config(img_data, 0)
        self.assertIsNotNone(config)
        self.assertEqual(config.id, "test-image")
        self.assertEqual(config.description, "测试描述")
        self.assertEqual(config.source_repo, "test/app")
        self.assertEqual(config.source_tag, "v1.0.0")
        self.assertEqual(config.platform, "linux/arm64")
        self.assertTrue(config.private_registry)
        self.assertEqual(config.priority, 5)
    
    def test_parse_image_config_invalid_format(self):
        """测试解析无效格式的镜像配置"""
        # 缺少必要字段
        img_data = {
            "description": "只有描述，缺少name和tag"
        }
        
        config = self.processor._parse_image_config(img_data, 0)
        self.assertIsNone(config)
    
    def test_full_image_name_generation(self):
        """测试完整镜像名称生成"""
        configs = [
            ImageConfig("test-1", "nginx", "latest", None, False, None, None, 1),
            ImageConfig("test-2", "app/service", "v1.0", "linux/amd64", False, None, None, 2),
            ImageConfig("test-3", "registry.com/app", "latest", "linux/arm64", True, "custom_name", "描述", 3)
        ]
        
        expected_names = [
            "nginx:latest",
            "--platform=linux/amd64 app/service:v1.0",
            "--platform=linux/arm64 registry.com/app:latest"
        ]
        
        for config, expected in zip(configs, expected_names):
            full_name = config.source_repo
            if config.source_tag and config.source_tag != "latest":
                full_name += f":{config.source_tag}"
            elif config.source_tag == "latest":
                full_name += ":latest"
            if config.platform:
                full_name = f"--platform={config.platform} {full_name}"

            self.assertEqual(full_name, expected)
    
    @patch('os.system')
    def test_sync_needed_images_success(self, mock_system):
        """测试成功同步需要的镜像"""
        # 创建测试配置
        test_config = {
            "images": [
                {
                    "name": "nginx",
                    "tag": "latest"
                }
            ]
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(test_config, f)
            temp_file = f.name
        
        try:
            # 创建新的处理器实例用于测试
            test_processor = JSONImageProcessor()

            # 加载配置
            test_processor.load_config(temp_file)

            # Mock系统调用返回成功
            mock_system.return_value = 0
            
            # 执行同步
            results = test_processor.sync_needed_images("test_result.env")

            # 验证结果
            self.assertEqual(results['total_count'], 1)
            self.assertEqual(results['success_count'], 1)
            self.assertEqual(results['failed_count'], 0)
            
            # 验证结果文件
            self.assertTrue(os.path.exists("test_result.env"))
            
            with open("test_result.env", 'r') as f:
                content = f.read()
                self.assertIn("TOTAL_COUNT=1", content)
                self.assertIn("SUCCESS_COUNT=1", content)
                self.assertIn("FAILED_COUNT=0", content)
                
        finally:
            os.unlink(temp_file)
            if os.path.exists("test_result.env"):
                os.unlink("test_result.env")
    
    @patch('os.system')
    def test_sync_needed_images_with_failure(self, mock_system):
        """测试同步中包含失败的镜像"""
        test_config = {
            "images": [
                {
                    "name": "nginx",
                    "tag": "latest"
                },
                {
                    "name": "nonexistent",
                    "tag": "latest"
                }
            ]
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(test_config, f)
            temp_file = f.name
        
        try:
            # 创建新的处理器实例用于测试
            test_processor = JSONImageProcessor()

            # 加载配置
            test_processor.load_config(temp_file)

            # Mock系统调用：第一个成功，第二个失败
            mock_system.side_effect = [0, 1]
            
            # 执行同步
            results = test_processor.sync_needed_images("test_result.env")
            
            # 验证结果
            self.assertEqual(results['total_count'], 2)
            self.assertEqual(results['success_count'], 1)
            self.assertEqual(results['failed_count'], 1)
            
            # 验证失败记录
            self.assertEqual(len(results['failed_images']), 1)
            self.assertEqual(results['failed_images'][0]['name'], 'nonexistent:latest')
            
        finally:
            os.unlink(temp_file)
            if os.path.exists("test_result.env"):
                os.unlink("test_result.env")

if __name__ == '__main__':
    unittest.main()
