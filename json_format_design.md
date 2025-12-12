# JSON格式镜像同步配置设计

## 当前格式问题：
```bash
# images.txt - 当前行分隔格式
nginx
#支持私库
k8s.gcr.io/kube-state-metrics/kube-state-metrics:v2.0.0
xhofe/alist:latest
#支持指定架构
--platform=linux/arm64 xiaoyaliu/alist
```

## 推荐JSON格式：

### 方案1: 简单数组格式
```json
{
  "images": [
    {
      "name": "nginx",
      "tag": "latest"
    },
    {
      "name": "k8s.gcr.io/kube-state-metrics/kube-state-metrics",
      "tag": "v2.0.0"
    },
    {
      "name": "xhofe/alist",
      "tag": "latest"
    },
    {
      "name": "xiaoyaliu/alist",
      "tag": "latest",
      "platform": "linux/arm64"
    }
  ]
}
```

### 方案2: 增强对象格式
```json
{
  "version": "1.0",
  "metadata": {
    "description": "Docker镜像同步配置",
    "created": "2025-12-12T10:00:00Z",
    "author": "gqy20"
  },
  "sync_config": {
    "default_registry": "aliyun",
    "parallel_limit": 2,
    "retry_count": 3
  },
  "images": [
    {
      "id": "nginx-latest",
      "source": {
        "repository": "nginx",
        "tag": "latest"
      },
      "target": {
        "namespace": "library",
        "custom_name": null
      },
      "options": {
        "platform": null,
        "private_registry": false,
        "skip_existing": true
      },
      "metadata": {
        "description": "官方Nginx镜像",
        "size_estimate": "140MB",
        "priority": 1
      }
    },
    {
      "id": "kube-state-metrics-v2",
      "source": {
        "repository": "k8s.gcr.io/kube-state-metrics/kube-state-metrics",
        "tag": "v2.0.0"
      },
      "target": {
        "namespace": "k8s",
        "custom_name": "kube-state-metrics"
      },
      "options": {
        "platform": null,
        "private_registry": true,
        "skip_existing": true
      }
    }
  ]
}
```

### 方案3: YAML兼容格式（保持可读性）
```yaml
version: 1.0
sync_config:
  parallel_limit: 2
  retry_count: 3
images:
  - name: nginx
    tag: latest
    description: 官方Nginx镜像
    
  - name: k8s.gcr.io/kube-state-metrics/kube-state-metrics
    tag: v2.0.0
    description: Kubernetes状态指标收集器
    private_registry: true
    
  - name: xiaoyaliu/alist
    tag: latest
    description: Alist文件列表服务
    
  - name: xiaoyaliu/alist
    tag: latest
    platform: linux/arm64
    description: Alist ARM64架构版本
```
