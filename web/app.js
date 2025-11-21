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

// GitHub API集成类
class GitHubAPI {
    constructor() {
        this.baseURL = 'https://api.github.com';
        this.repoOwner = Utils.storage.get('repo_owner', '');
        this.repoName = 'docker_image_pusher';
        this.token = Utils.storage.get('github_token', '');
        this.refreshInterval = Utils.storage.get('refresh_interval', 5) * 1000;
    }

    // 设置认证信息
    setAuth(owner, token, refreshInterval = 5) {
        this.repoOwner = owner;
        this.token = token;
        this.refreshInterval = refreshInterval * 1000;

        Utils.storage.set('repo_owner', owner);
        Utils.storage.set('github_token', token);
        Utils.storage.set('refresh_interval', refreshInterval);
    }

    // 检查认证是否有效
    isAuthValid() {
        return !!(this.repoOwner && this.token);
    }

    // 通用请求方法
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const headers = {
            'Accept': 'application/vnd.github.v3+json',
            'Authorization': `token ${this.token}`,
            ...options.headers
        };

        try {
            const response = await fetch(url, { ...options, headers });

            if (response.status === 401) {
                throw new Error('GitHub Token无效或已过期');
            }

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

    // 测试连接
    async testConnection() {
        if (!this.isAuthValid()) {
            throw new Error('请先配置仓库所有者和GitHub Token');
        }

        try {
            const repoInfo = await this.request(`/repos/${this.repoOwner}/${this.repoName}`);
            return {
                success: true,
                repo: repoInfo,
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

    // 触发手动同步工作流
    async triggerManualSync(imageList, forceUpdate = false, dryRun = false) {
        const inputs = {
            image_list: imageList,
            force_update: forceUpdate.toString(),
            dry_run: dryRun.toString()
        };

        return this.request(
            `/repos/${this.repoOwner}/${this.repoName}/actions/workflows/manual-sync.yml/dispatches`,
            {
                method: 'POST',
                body: JSON.stringify({
                    ref: 'main',
                    inputs: inputs
                })
            }
        );
    }

    // 触发主工作流
    async triggerMainWorkflow(forceSync = false) {
        const inputs = {
            force_sync: forceSync.toString()
        };

        return this.request(
            `/repos/${this.repoOwner}/${this.repoName}/actions/workflows/docker.yaml/dispatches`,
            {
                method: 'POST',
                body: JSON.stringify({
                    ref: 'main',
                    inputs: inputs
                })
            }
        );
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

    // 获取工作流运行日志
    async getWorkflowLogs(runId) {
        try {
            const response = await fetch(
                `${this.baseURL}/repos/${this.repoOwner}/${this.repoName}/actions/runs/${runId}/logs`,
                {
                    headers: {
                        'Accept': 'application/vnd.github.v3+json',
                        'Authorization': `token ${this.token}`
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`无法获取日志: ${response.status}`);
            }

            return await response.text();
        } catch (error) {
            console.error('获取日志失败:', error);
            throw error;
        }
    }
}

// 镜像管理类
class ImageManager {
    constructor() {
        this.images = [];
        this.validationResults = [];
    }

    // 解析镜像列表
    parseImageList(imageText) {
        const lines = imageText.split('\n').filter(line => line.trim());
        const images = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // 跳过注释和空行
            if (line.startsWith('#') || !line) continue;

            const image = this.parseSingleImage(line);
            if (image) {
                image.index = i;
                images.push(image);
            }
        }

        this.images = images;
        return images;
    }

    // 解析单个镜像
    parseSingleImage(imageLine) {
        let platform = '';
        let imageName = imageLine;

        // 检测platform参数
        if (imageLine.includes('--platform')) {
            const platformMatch = imageLine.match(/--platform[ =](\S+)/);
            if (platformMatch) {
                platform = platformMatch[1];
                imageName = imageLine.replace(/--platform[ =]\S+/, '').trim();
            }
        }

        // 验证镜像名称格式
        const isValid = this.isValidImageName(imageName);

        return {
            original: imageLine,
            name: imageName,
            platform: platform,
            tag: this.extractTag(imageName),
            registry: this.extractRegistry(imageName),
            isValid: isValid,
            warnings: this.getWarnings(imageName, platform)
        };
    }

    // 验证镜像名称格式
    isValidImageName(imageName) {
        // 基本Docker镜像名称模式
        const patterns = [
            /^[a-z0-9]+(\.[a-z0-9]+)*\/[a-z0-9-._\/]+:[a-zA-Z0-9._-]+$/, // 完整格式
            /^[a-z0-9-._\/]+:[a-zA-Z0-9._-]+$/, // 简单格式
            /^[a-z0-9-._\/]+$/, // 无标签格式
        ];

        // 检查是否符合基本模式
        const isValid = patterns.some(pattern => pattern.test(imageName));

        // 或者包含已知的注册表
        const hasKnownRegistry = imageName.includes('gcr.io/') ||
                               imageName.includes('ghcr.io/') ||
                               imageName.includes('k8s.gcr.io/') ||
                               imageName.includes('quay.io/') ||
                               imageName.includes('docker.io/');

        return isValid || hasKnownRegistry;
    }

    // 获取警告信息
    getWarnings(imageName, platform) {
        const warnings = [];

        if (!imageName.includes(':')) {
            warnings.push('未指定标签，将使用latest');
        }

        if (imageName.toLowerCase() === 'latest') {
            warnings.push('使用latest标签可能导致意外更新');
        }

        if (platform && !platform.startsWith('linux/')) {
            warnings.push(`不常见的架构: ${platform}`);
        }

        return warnings;
    }

    // 提取标签
    extractTag(imageName) {
        const parts = imageName.split(':');
        return parts.length > 1 ? parts[parts.length - 1] : 'latest';
    }

    // 提取注册表
    extractRegistry(imageName) {
        if (imageName.includes('/')) {
            const parts = imageName.split('/');
            if (parts[0].includes('.') || parts[0].includes(':')) {
                return parts[0];
            }
        }
        return 'docker.io';
    }

    // 验证镜像列表
    async validateImages(images) {
        const results = [];

        for (const image of images) {
            try {
                // 简化的验证逻辑（实际项目中可以添加Docker Hub API验证）
                const result = {
                    ...image,
                    status: image.isValid ? 'valid' : 'invalid',
                    message: image.isValid ? '格式正确' : '格式可能有问题',
                    exists: true // 假设存在，实际需要API检查
                };

                results.push(result);
            } catch (error) {
                results.push({
                    ...image,
                    status: 'error',
                    message: `验证失败: ${error.message}`,
                    exists: false
                });
            }
        }

        this.validationResults = results;
        return results;
    }

    // 格式化镜像显示
    formatImageDisplay(image) {
        let display = image.name;

        if (image.platform) {
            display = `<span class="platform-tag">${image.platform}</span> ${display}`;
        }

        return display;
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
            forceUpdate: document.getElementById('forceUpdate'),
            dryRun: document.getElementById('dryRun'),

            // 按钮相关
            syncBtn: document.getElementById('syncBtn'),
            validateBtn: document.getElementById('validateBtn'),
            settingsBtn: document.getElementById('settingsBtn'),

            // 状态显示相关
            repoStatus: document.getElementById('repoStatus'),
            syncStatus: document.getElementById('syncStatus'),
            syncHistory: document.getElementById('syncHistory'),

            // 模态框相关
            settingsModal: document.getElementById('settingsModal'),
            validationModal: document.getElementById('validationModal'),
            workflowModal: document.getElementById('workflowModal'),

            // 设置表单
            repoOwner: document.getElementById('repoOwner'),
            githubToken: document.getElementById('githubToken'),
            refreshInterval: document.getElementById('refreshInterval'),

            // 按钮
            testConnectionBtn: document.getElementById('testConnectionBtn'),
            saveSettingsBtn: document.getElementById('saveSettingsBtn'),
            closeValidationBtn: document.getElementById('closeValidationBtn'),
            viewLogsBtn: document.getElementById('viewLogsBtn'),
            closeWorkflowBtn: document.getElementById('closeWorkflowBtn'),

            // 内容显示
            validationResults: document.getElementById('validationResults'),
            workflowDetails: document.getElementById('workflowDetails')
        };
    }

    // 绑定事件
    bindEvents() {
        // 主要操作按钮
        this.elements.syncBtn.addEventListener('click', () => this.handleSync());
        this.elements.validateBtn.addEventListener('click', () => this.handleValidation());
        this.elements.settingsBtn.addEventListener('click', () => this.showSettings());

        // 设置模态框
        this.elements.testConnectionBtn.addEventListener('click', () => this.testConnection());
        this.elements.saveSettingsBtn.addEventListener('click', () => this.saveSettings());

        // 验证模态框
        this.elements.closeValidationBtn.addEventListener('click', () => this.hideModal('validationModal'));

        // 工作流模态框
        this.elements.viewLogsBtn.addEventListener('click', () => this.viewWorkflowLogs());
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

    // 加载初始数据
    async loadInitialData() {
        // 恢复设置
        this.loadSettings();

        // 更新UI状态
        this.updateUIState();

        // 如果已认证，加载历史记录
        if (githubAPI.isAuthValid()) {
            await this.loadHistory();
            await this.loadCurrentImages();
        }
    }

    // 加载设置
    loadSettings() {
        this.elements.repoOwner.value = githubAPI.repoOwner;
        this.elements.githubToken.value = githubAPI.token ? '•'.repeat(10) : '';
        this.elements.refreshInterval.value = githubAPI.refreshInterval / 1000;
    }

    // 更新UI状态
    updateUIState() {
        const isAuthValid = githubAPI.isAuthValid();

        // 更新按钮状态
        this.elements.syncBtn.disabled = !isAuthValid;
        this.elements.validateBtn.disabled = !isAuthValid;

        // 更新状态显示
        this.updateRepoStatus(isAuthValid);
    }

    // 更新仓库状态显示
    updateRepoStatus(isAuthValid) {
        if (isAuthValid) {
            this.elements.repoStatus.innerHTML = `
                <div class="status-indicator status-loading">
                    <span class="status-icon">🔄</span>
                    <span class="status-text">连接中...</span>
                </div>
            `;

            // 测试连接
            this.testConnectionSilent();
        } else {
            this.elements.repoStatus.innerHTML = `
                <div class="status-indicator status-unknown">
                    <span class="status-icon">❓</span>
                    <span class="status-text">未配置</span>
                </div>
                <div class="status-hint">
                    请点击右上角"设置"按钮配置GitHub认证信息
                </div>
            `;
        }
    }

    // 静默测试连接
    async testConnectionSilent() {
        try {
            const result = await githubAPI.testConnection();
            if (result.success) {
                this.elements.repoStatus.innerHTML = `
                    <div class="status-indicator status-valid">
                        <span class="status-icon">✅</span>
                        <span class="status-text">${githubAPI.repoOwner}/${githubAPI.repoName}</span>
                    </div>
                `;
            } else {
                this.elements.repoStatus.innerHTML = `
                    <div class="status-indicator status-invalid">
                        <span class="status-icon">❌</span>
                        <span class="status-text">连接失败</span>
                    </div>
                `;
            }
        } catch (error) {
            this.elements.repoStatus.innerHTML = `
                <div class="status-indicator status-invalid">
                    <span class="status-icon">❌</span>
                    <span class="status-text">认证失败</span>
                </div>
            `;
        }
    }

    // 更新按钮状态
    updateButtonStates() {
        const hasImages = this.elements.imageInput.value.trim().length > 0;
        const isAuthValid = githubAPI.isAuthValid();

        this.elements.syncBtn.disabled = !isAuthValid || !hasImages;
        this.elements.validateBtn.disabled = !isAuthValid || !hasImages;
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

    // 测试连接
    async testConnection() {
        const owner = this.elements.repoOwner.value.trim();
        const token = this.elements.githubToken.value.trim();

        if (!owner || !token) {
            Utils.showNotification('请填写仓库所有者和GitHub Token', 'error');
            return;
        }

        // 临时设置认证信息进行测试
        const originalAuth = { owner: githubAPI.repoOwner, token: githubAPI.token };
        githubAPI.setAuth(owner, token);

        this.elements.testConnectionBtn.disabled = true;
        this.elements.testConnectionBtn.textContent = '🔄 测试中...';

        try {
            const result = await githubAPI.testConnection();
            if (result.success) {
                Utils.showNotification('连接测试成功！', 'success');
            } else {
                Utils.showNotification(`连接测试失败: ${result.error}`, 'error');
            }
        } catch (error) {
            Utils.showNotification(`连接测试失败: ${error.message}`, 'error');
        } finally {
            // 恢复原始认证信息
            if (originalAuth.owner && originalAuth.token) {
                githubAPI.setAuth(originalAuth.owner, originalAuth.token);
            }

            this.elements.testConnectionBtn.disabled = false;
            this.elements.testConnectionBtn.textContent = '🔗 测试连接';
        }
    }

    // 保存设置
    async saveSettings() {
        const owner = this.elements.repoOwner.value.trim();
        let token = this.elements.githubToken.value.trim();
        const refreshInterval = parseInt(this.elements.refreshInterval.value) || 5;

        if (!owner) {
            Utils.showNotification('请填写仓库所有者', 'error');
            return;
        }

        if (!token || token === '•'.repeat(10)) {
            // 保持原有token
            token = githubAPI.token;
        } else {
            // 新token
        }

        if (!token) {
            Utils.showNotification('请填写GitHub Token', 'error');
            return;
        }

        try {
            githubAPI.setAuth(owner, token, refreshInterval);

            // 测试连接
            const result = await githubAPI.testConnection();
            if (result.success) {
                Utils.showNotification('设置保存成功！', 'success');
                this.hideModal('settingsModal');
                this.updateUIState();
                await this.loadHistory();
                await this.loadCurrentImages();
            } else {
                Utils.showNotification(`连接失败: ${result.error}`, 'error');
            }
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

        const forceUpdate = this.elements.forceUpdate.checked;
        const dryRun = this.elements.dryRun.checked;
        const imageList = images.map(img => img.original).join(',');

        this.elements.syncBtn.disabled = true;
        this.elements.syncBtn.innerHTML = '🔄 启动中...';

        try {
            await githubAPI.triggerManualSync(imageList, forceUpdate, dryRun);

            Utils.showNotification(
                dryRun ? '检测任务已启动' : '同步任务已启动',
                'success'
            );

            this.updateSyncStatus('运行中', 'running');

            // 开始轮询状态
            this.startStatusPolling();

            // 清空输入框
            if (!dryRun) {
                this.elements.imageInput.value = '';
                this.updateButtonStates();
            }

        } catch (error) {
            Utils.showNotification(`同步启动失败: ${error.message}`, 'error');
            this.elements.syncBtn.disabled = false;
            this.elements.syncBtn.innerHTML = '🚀 开始同步';
        }
    }

    // 处理验证操作
    async handleValidation() {
        const imageText = this.elements.imageInput.value;
        if (!imageText.trim()) {
            Utils.showNotification('请输入要验证的镜像列表', 'error');
            return;
        }

        this.elements.validateBtn.disabled = true;
        this.elements.validateBtn.innerHTML = '🔄 验证中...';

        try {
            const images = imageManager.parseImageList(imageText);
            const results = await imageManager.validateImages(images);

            this.showValidationResults(results);
            this.showModal('validationModal');

        } catch (error) {
            Utils.showNotification(`验证失败: ${error.message}`, 'error');
        } finally {
            this.elements.validateBtn.disabled = false;
            this.elements.validateBtn.innerHTML = '🔍 验证镜像';
        }
    }

    // 显示验证结果
    showValidationResults(results) {
        const validCount = results.filter(r => r.status === 'valid').length;
        const invalidCount = results.filter(r => r.status === 'invalid').length;
        const errorCount = results.filter(r => r.status === 'error').length;

        let html = `
            <div class="validation-summary">
                <p>验证完成:
                    <span class="valid-count">${validCount} 个有效</span>,
                    <span class="invalid-count">${invalidCount} 个格式问题</span>,
                    <span class="error-count">${errorCount} 个错误</span>
                </p>
            </div>
            <div class="validation-results">
        `;

        results.forEach(image => {
            const statusClass = image.status === 'valid' ? 'valid' :
                              image.status === 'invalid' ? 'invalid' : 'error';

            html += `
                <div class="image-item">
                    <span class="image-status ${statusClass}">
                        ${image.status === 'valid' ? '✅' :
                          image.status === 'invalid' ? '⚠️' : '❌'}
                    </span>
                    <div class="image-info">
                        <div class="image-name">${image.original}</div>
                        ${image.warnings.length > 0 ?
                            `<div class="image-warnings">
                                ${image.warnings.map(w => `⚠️ ${w}`).join('<br>')}
                            </div>` : ''
                        }
                        <div class="image-message">${image.message}</div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        this.elements.validationResults.innerHTML = html;
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

    // 加载历史记录
    async loadHistory() {
        try {
            const runs = await githubAPI.getAllWorkflowRuns(10);
            this.displayHistory(runs.workflow_runs || []);
        } catch (error) {
            console.warn('加载历史记录失败:', error);
        }
    }

    // 显示历史记录
    displayHistory(runs) {
        if (!runs || runs.length === 0) {
            this.elements.syncHistory.innerHTML = `
                <div class="placeholder">
                    <div class="placeholder-icon">📋</div>
                    <div class="placeholder-text">暂无历史记录</div>
                    <div class="placeholder-hint">完成同步后将显示历史记录</div>
                </div>
            `;
            return;
        }

        let html = '';

        runs.forEach(run => {
            const statusClass = run.status === 'completed' ?
                (run.conclusion === 'success' ? 'success' : 'failed') : 'running';
            const statusText = run.status === 'completed' ?
                (run.conclusion === 'success' ? '成功' : '失败') : '运行中';

            html += `
                <div class="workflow-item ${statusClass}" data-run-id="${run.id}">
                    <div class="workflow-header">
                        <div class="workflow-title">${run.name}</div>
                        <div class="workflow-status ${statusClass}">${statusText}</div>
                    </div>
                    <div class="workflow-details">
                        <div>触发时间: ${Utils.formatDate(run.created_at)}</div>
                        <div>持续时间: ${Utils.formatDuration(run.created_at, run.updated_at)}</div>
                        <div>分支: ${run.head_branch}</div>
                    </div>
                </div>
            `;
        });

        this.elements.syncHistory.innerHTML = html;

        // 绑定点击事件
        this.elements.syncHistory.querySelectorAll('.workflow-item').forEach(item => {
            item.addEventListener('click', () => {
                const runId = item.getAttribute('data-run-id');
                this.showWorkflowDetails(runId);
            });
        });
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

    // 查看工作流日志
    async viewWorkflowLogs() {
        if (!this.currentWorkflowId) {
            Utils.showNotification('没有可查看的日志', 'warning');
            return;
        }

        try {
            const logs = await githubAPI.getWorkflowLogs(this.currentWorkflowId);

            // 在新窗口中显示日志
            const logWindow = window.open('', '_blank');
            logWindow.document.write(`
                <html>
                    <head>
                        <title>工作流日志</title>
                        <style>
                            body { font-family: monospace; white-space: pre-wrap; padding: 20px; }
                            .log-line { margin: 2px 0; }
                            .error { color: red; }
                            .warning { color: orange; }
                            .info { color: blue; }
                        </style>
                    </head>
                    <body>
                        <pre>${logs}</pre>
                    </body>
                </html>
            `);
            logWindow.document.close();

        } catch (error) {
            Utils.showNotification(`获取日志失败: ${error.message}`, 'error');
        }
    }

    // 加载当前镜像配置
    async loadCurrentImages() {
        try {
            const imagesContent = await githubAPI.getImagesFile();
            if (imagesContent) {
                this.elements.imageInput.value = imagesContent;
                this.updateButtonStates();
            }
        } catch (error) {
            console.warn('加载当前镜像配置失败:', error);
        }
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