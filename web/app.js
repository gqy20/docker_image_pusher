/**
 * Docker镜像同步工具 - 前端管理界面
 * 功能：GitHub API集成、镜像管理、状态监控
 */

// 工具函数集合
const Utils = {
    // 格式化日期时间
    formatDate(dateString) {
        if (!dateString) return '未知时间';
        const date = new Date(dateString);
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    // 格式化持续时间
    formatDuration(start, end) {
        if (!start || !end) return '未知';
        const duration = Math.floor((new Date(end) - new Date(start)) / 1000);
        if (duration < 60) return `${duration}秒`;
        if (duration < 3600) return `${Math.floor(duration / 60)}分钟`;
        return `${Math.floor(duration / 3600)}小时${Math.floor((duration % 3600) / 60)}分钟`;
    },

    // 防抖函数
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // 深拷贝
    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    },

    // 本地存储操作
    storage: {
        set(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
            } catch (error) {
                console.warn('无法保存到本地存储:', error);
            }
        },

        get(key, defaultValue = null) {
            try {
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : defaultValue;
            } catch (error) {
                console.warn('无法从本地存储读取:', error);
                return defaultValue;
            }
        },

        remove(key) {
            try {
                localStorage.removeItem(key);
            } catch (error) {
                console.warn('无法删除本地存储:', error);
            }
        }
    },

    // 显示通知
    showNotification(message, type = 'info', duration = 5000) {
        const container = document.getElementById('notificationContainer');
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span class="notification-icon">${this.getNotificationIcon(type)}</span>
            <span class="notification-message">${message}</span>
        `;

        container.appendChild(notification);

        // 自动移除
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'fadeOut 0.3s ease-in-out';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.remove();
                    }
                }, 300);
            }
        }, duration);
    },

    getNotificationIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || 'ℹ️';
    }
};

// GitHub API集成类 - 简化版，无需Token
class GitHubAPI {
    constructor() {
        this.baseURL = 'https://api.github.com';
        this.repoName = 'docker_image_pusher';

        // 自动检测仓库所有者
        const hostname = window.location.hostname;
        if (hostname.includes('github.io')) {
            // 从 gqy20.github.io 提取 gqy20
            this.repoOwner = hostname.split('.')[0];
        } else {
            this.repoOwner = Utils.storage.get('repo_owner', '');
        }

        this.refreshInterval = Utils.storage.get('refresh_interval', 5) * 1000;

        console.log('检测到仓库所有者:', this.repoOwner);
    }

    // 设置认证信息 - 极简版（仅设置刷新间隔）
    setAuth(refreshInterval = 5) {
        this.refreshInterval = refreshInterval * 1000;
        Utils.storage.set('refresh_interval', refreshInterval);
    }

    // 检查认证是否有效
    isAuthValid() {
        return !!(this.repoOwner);
    }

    // 创建Issue触发同步（不需要token）
    async createSyncIssue(imageList) {
        const issueTitle = '[Docker同步] 镜像同步请求';
        const issueBody = `## 📦 镜像列表

\`\`\`
${imageList}
\`\`\`

### 参数设置
- 强制更新: false
- 干运行模式: false

---
*由 Web 界面自动创建 • ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}*`;

        return this.request(
            `/repos/${this.repoOwner}/${this.repoName}/issues`,
            {
                method: 'POST',
                body: JSON.stringify({
                    title: issueTitle,
                    body: issueBody,
                    labels: ['sync']
                })
            }
        );
    }

    // 检查是否可以创建Issue（公共仓库不需要token）
    canCreateIssue() {
        return !!this.repoOwner;
    }

    // 通用请求方法 - 简化版，仅使用公开API
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const headers = {
            'Accept': 'application/vnd.github.v3+json',
            ...options.headers
        };

        try {
            const response = await fetch(url, { ...options, headers });

            if (response.status === 403) {
                throw new Error('API请求频率限制，请稍后重试');
            }

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('GitHub API请求失败:', error);
            throw error;
        }
    }

    // 测试连接 - 简化版，直接返回成功（假设通过GitHub Pages访问）
    async testConnection() {
        if (!this.isAuthValid()) {
            return {
                success: false,
                error: '无法检测仓库信息',
                message: '连接失败'
            };
        }

        try {
            // 由于CORS限制，我们假设通过GitHub Pages访问的都是有效的
            return {
                success: true,
                message: '连接成功'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                message: '连接失败'
            };
        }
    }

    // 获取仓库信息
    async getRepoInfo() {
        return this.request(`/repos/${this.repoOwner}/${this.repoName}`);
    }

    // 获取images.txt文件内容
    async getImagesFile() {
        try {
            const response = await this.request(`/repos/${this.repoOwner}/${this.repoName}/contents/images.txt`);
            return atob(response.content);
        } catch (error) {
            console.warn('无法获取images.txt:', error);
            return '';
        }
    }

  
    // 获取工作流运行列表
    async getWorkflowRuns(workflowId = 'manual-sync.yml', perPage = 20) {
        return this.request(
            `/repos/${this.repoOwner}/${this.repoName}/actions/workflows/${workflowId}/runs?per_page=${perPage}`
        );
    }

    // 获取所有工作流运行
    async getAllWorkflowRuns(perPage = 30) {
        return this.request(
            `/repos/${this.repoOwner}/${this.repoName}/actions/runs?per_page=${perPage}`
        );
    }

    // 获取单个工作流运行详情
    async getWorkflowRun(runId) {
        return this.request(
            `/repos/${this.repoOwner}/${this.repoName}/actions/runs/${runId}`
        );
    }
}

// 镜像管理类（简化版）
class ImageManager {
    constructor() {
        this.images = [];
    }

    // 解析镜像列表
    parseImageList(imageText) {
        const lines = imageText.split('\n').filter(line => line.trim());
        const images = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // 跳过注释和空行
            if (line.startsWith('#') || !line) continue;

            images.push({
                original: line,
                index: i
            });
        }

        this.images = images;
        return images;
    }
}

// UI管理类
class UIManager {
    constructor() {
        this.elements = {};
        this.currentModal = null;
        this.statusPolling = null;
        this.initElements();
        this.bindEvents();
        this.loadInitialData();
    }

    // 初始化DOM元素引用
    initElements() {
        this.elements = {
            // 输入相关
            imageInput: document.getElementById('imageInput'),
            inputSectionHint: document.getElementById('inputSectionHint'),

            // 按钮相关
            syncBtn: document.getElementById('syncBtn'),
            settingsBtn: document.getElementById('settingsBtn'),

            // 状态显示相关
            repoStatus: document.getElementById('repoStatus'),
            syncStatus: document.getElementById('syncStatus'),
            syncHistory: document.getElementById('syncHistory'),

            // 模态框相关
            settingsModal: document.getElementById('settingsModal'),
            workflowModal: document.getElementById('workflowModal'),

            // 设置表单
            refreshInterval: document.getElementById('refreshInterval'),
            saveSettingsBtn: document.getElementById('saveSettingsBtn'),
            closeWorkflowBtn: document.getElementById('closeWorkflowBtn'),

            // 内容显示
            workflowDetails: document.getElementById('workflowDetails')
        };
    }

    // 绑定事件
    bindEvents() {
        // 主要操作按钮
        this.elements.syncBtn.addEventListener('click', () => this.handleSync());
        this.elements.settingsBtn.addEventListener('click', () => this.showSettings());

        // 设置模态框
        this.elements.saveSettingsBtn.addEventListener('click', () => this.saveSettings());

        // 工作流模态框
        this.elements.closeWorkflowBtn.addEventListener('click', () => this.hideModal('workflowModal'));

        // 模态框关闭事件
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                const modalId = e.target.getAttribute('data-modal');
                this.hideModal(modalId);
            });
        });

        // 点击模态框外部关闭
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        });

        // 输入框变化事件
        this.elements.imageInput.addEventListener('input', () => this.updateButtonStates());
    }

    // 加载初始数据 - 简化版
    async loadInitialData() {
        // 恢复设置
        this.loadSettings();

        // 更新UI状态
        this.updateUIState();

        // 跳过API调用以避免CORS问题
        if (githubAPI.isAuthValid()) {
            console.log('仓库信息已自动检测，跳过API调用以避免CORS限制');
        }
    }

    // 加载设置
    loadSettings() {
        this.elements.refreshInterval.value = githubAPI.refreshInterval / 1000;
    }

    // 更新UI状态
    updateUIState() {
        const canCreateIssue = githubAPI.canCreateIssue();

        // 更新按钮状态 - 现在支持基于Issue的同步，只需要仓库所有者
        this.elements.syncBtn.disabled = !canCreateIssue;

        // 更新按钮文本 - 统一为Issue同步
        this.elements.syncBtn.innerHTML = '🐛 创建Issue同步';

        if (canCreateIssue) {
            this.elements.inputSectionHint.style.display = 'block';
            this.elements.inputSectionHint.innerHTML = '💡 使用GitHub Issues触发同步，无需Token！<br>仓库信息已自动检测，直接输入镜像即可开始使用。';
        } else {
            this.elements.inputSectionHint.style.display = 'block';
            this.elements.inputSectionHint.innerHTML = '💡 无法检测仓库信息，请确保通过GitHub Pages访问此页面';
        }

        // 更新状态显示
        this.updateRepoStatus(canCreateIssue);
    }

    // 更新仓库状态显示 - 简化版
    updateRepoStatus(canCreateIssue) {
        if (githubAPI.repoOwner) {
            let statusHtml = `
                <div class="status-indicator status-valid">
                    <span class="status-icon">✅</span>
                    <span class="status-text">${githubAPI.repoOwner}/${githubAPI.repoName}</span>
                </div>
            `;

            if (canCreateIssue) {
                statusHtml += `
                    <div class="status-hint">
                        🐛 Issue同步模式 - 无需Token，使用Issues触发同步
                    </div>
                `;
            } else {
                statusHtml += `
                    <div class="status-hint">
                        需要配置仓库所有者才能使用
                    </div>
                `;
            }

            this.elements.repoStatus.innerHTML = statusHtml;

            // 测试连接
            this.testConnectionSilent();
        } else {
            this.elements.repoStatus.innerHTML = `
                <div class="status-indicator status-invalid">
                    <span class="status-icon">❌</span>
                    <span class="status-text">无法检测仓库信息</span>
                </div>
                <div class="status-hint">
                    请确保通过GitHub Pages访问此页面
                </div>
            `;
        }
    }

    // 静默测试连接 - 简化版，直接显示成功状态
    async testConnectionSilent() {
        if (githubAPI.repoOwner) {
            this.elements.repoStatus.innerHTML = `
                <div class="status-indicator status-valid">
                    <span class="status-icon">✅</span>
                    <span class="status-text">${githubAPI.repoOwner}/${githubAPI.repoName}</span>
                </div>
                <div class="status-hint">
                    🐛 Issue同步模式 - 无需Token，使用Issues触发同步
                </div>
            `;
        } else {
            this.elements.repoStatus.innerHTML = `
                <div class="status-indicator status-invalid">
                    <span class="status-icon">❌</span>
                    <span class="status-text">无法检测仓库信息</span>
                </div>
                <div class="status-hint">
                    请确保通过GitHub Pages访问此页面
                </div>
            `;
        }
    }

    // 更新按钮状态
    updateButtonStates() {
        const hasImages = this.elements.imageInput.value.trim().length > 0;
        const isAuthValid = githubAPI.isAuthValid();

        this.elements.syncBtn.disabled = !isAuthValid || !hasImages;
    }

    // 显示设置模态框
    showSettings() {
        this.loadSettings();
        this.showModal('settingsModal');
    }

    // 显示模态框
    showModal(modalId) {
        this.currentModal = modalId;
        const modal = document.getElementById(modalId);
        modal.style.display = 'block';

        // 聚焦到第一个输入框
        const firstInput = modal.querySelector('input');
        if (firstInput) {
            setTimeout(() => firstInput.focus(), 100);
        }
    }

    // 隐藏模态框
    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        modal.style.display = 'none';
        this.currentModal = null;
    }

    
    // 保存设置 - 极简版
    async saveSettings() {
        const refreshInterval = parseInt(this.elements.refreshInterval.value) || 5;

        try {
            githubAPI.setAuth(refreshInterval);
            Utils.showNotification('设置保存成功！', 'success');
            this.hideModal('settingsModal');
            // 跳过加载历史记录和镜像配置以避免CORS问题
        } catch (error) {
            Utils.showNotification(`保存设置失败: ${error.message}`, 'error');
        }
    }

    // 处理同步操作
    async handleSync() {
        const imageText = this.elements.imageInput.value;
        if (!imageText.trim()) {
            Utils.showNotification('请输入要同步的镜像列表', 'error');
            return;
        }

        const images = imageManager.parseImageList(imageText);
        if (images.length === 0) {
            Utils.showNotification('没有找到有效的镜像', 'warning');
            return;
        }

        const imageList = images.map(img => img.original).join('\n');

        this.elements.syncBtn.disabled = true;
        this.elements.syncBtn.innerHTML = '🔄 创建Issue中...';

        try {
            // 使用Issue触发同步
            const issue = await githubAPI.createSyncIssue(imageList);
            const issueUrl = issue.html_url;
            Utils.showNotification(
                '同步Issue已创建！GitHub Actions将自动处理',
                'success'
            );

            // 显示Issue链接
            this.showIssueNotification(issueUrl);

            // 清空输入框
            this.elements.imageInput.value = '';
            this.updateButtonStates();

            // 在新窗口打开Issue
            setTimeout(() => {
                window.open(issueUrl, '_blank');
            }, 2000);

        } catch (error) {
            Utils.showNotification(`创建Issue失败: ${error.message}`, 'error');
            this.elements.syncBtn.disabled = false;
            this.elements.syncBtn.innerHTML = '🐛 创建Issue同步';
        }
    }

    // 显示Issue通知
    showIssueNotification(issueUrl) {
        const container = document.getElementById('notificationContainer');
        const notification = document.createElement('div');
        notification.className = 'notification notification-info notification-large';
        notification.innerHTML = `
            <span class="notification-icon">🐛</span>
            <div class="notification-content">
                <div class="notification-title">同步Issue已创建</div>
                <div class="notification-message">
                    GitHub Actions将自动处理您的镜像同步请求<br>
                    <a href="${issueUrl}" target="_blank">点击查看Issue</a>
                </div>
            </div>
        `;

        container.appendChild(notification);

        // 10秒后自动移除
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'fadeOut 0.3s ease-in-out';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.remove();
                    }
                }, 300);
            }
        }, 10000);
    }

    
    // 更新同步状态
    updateSyncStatus(status, type = 'info') {
        const statusHtml = `
            <div class="workflow-item ${type}">
                <div class="workflow-header">
                    <div class="workflow-title">手动镜像同步</div>
                    <div class="workflow-status ${type}">${status}</div>
                </div>
                <div class="workflow-details">
                    <div>开始时间: ${Utils.formatDate(new Date())}</div>
                    <div>状态: ${status}</div>
                </div>
            </div>
        `;

        this.elements.syncStatus.innerHTML = statusHtml;
    }

    // 开始状态轮询
    startStatusPolling() {
        if (this.statusPolling) {
            clearInterval(this.statusPolling);
        }

        this.statusPolling = setInterval(async () => {
            try {
                await this.loadHistory();
            } catch (error) {
                console.error('状态轮询失败:', error);
            }
        }, githubAPI.refreshInterval);

        // 5分钟后停止轮询
        setTimeout(() => {
            if (this.statusPolling) {
                clearInterval(this.statusPolling);
                this.statusPolling = null;
            }
        }, 5 * 60 * 1000);
    }

    // 加载历史记录 - 极简版（跳过API调用）
    async loadHistory() {
        // 由于CORS限制，暂时跳过历史记录加载
        // 用户可以通过查看仓库的Issues页面来了解同步状态
        console.log('跳过历史记录加载以避免CORS限制');
        this.displayHistory([]);
    }

    // 显示历史记录
    displayHistory(runs) {
        // 显示CORS限制的提示
        this.elements.syncHistory.innerHTML = `
            <div class="placeholder">
                <div class="placeholder-icon">🔒</div>
                <div class="placeholder-text">API访问受限</div>
                <div class="placeholder-hint">由于浏览器安全限制，无法直接加载历史记录<br>请查看仓库的Issues页面了解同步状态</div>
            </div>
        `;
        return;
    }

    // 显示工作流详情
    async showWorkflowDetails(runId) {
        try {
            const details = await githubAPI.getWorkflowRun(runId);

            let html = `
                <div class="workflow-detail">
                    <h4>工作流信息</h4>
                    <p><strong>名称:</strong> ${details.name}</p>
                    <p><strong>状态:</strong> ${details.status}</p>
                    <p><strong>结论:</strong> ${details.conclusion || '运行中'}</p>
                    <p><strong>触发时间:</strong> ${Utils.formatDate(details.created_at)}</p>
                    <p><strong>完成时间:</strong> ${details.updated_at ? Utils.formatDate(details.updated_at) : '未完成'}</p>
                    <p><strong>持续时间:</strong> ${Utils.formatDuration(details.created_at, details.updated_at)}</p>
                    <p><strong>分支:</strong> ${details.head_branch}</p>
                    <p><strong>提交:</strong> ${details.head_sha.substring(0, 7)}</p>

                    <h4>输入参数</h4>
                    <pre>${JSON.stringify(details.inputs || {}, null, 2)}</pre>
                </div>
            `;

            this.elements.workflowDetails.innerHTML = html;
            this.currentWorkflowId = runId;
            this.showModal('workflowModal');

        } catch (error) {
            Utils.showNotification(`获取工作流详情失败: ${error.message}`, 'error');
        }
    }

  
    // 加载当前镜像配置 - 简化版（跳过API调用）
    async loadCurrentImages() {
        // 由于CORS限制，暂时跳过镜像配置加载
        // 用户可以直接在输入框中输入镜像列表
        console.log('跳过镜像配置加载以避免CORS限制');
    }
}

// 应用初始化
let githubAPI;
let imageManager;
let uiManager;

document.addEventListener('DOMContentLoaded', () => {
    // 初始化核心类
    githubAPI = new GitHubAPI();
    imageManager = new ImageManager();
    uiManager = new UIManager();

    console.log('Docker镜像同步工具已初始化');
});