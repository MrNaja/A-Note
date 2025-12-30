// 手机版笔记应用逻辑
class MobileNoteApp {
    constructor() {
        this.notes = [];
        this.currentNote = null;
        this.syncSettings = {};
        this.isSyncing = false;
        
        // 初始化应用
        this.init();
    }

    init() {
        // 加载配置
        this.loadSyncSettings();
        // 加载本地笔记
        this.loadLocalNotes();
        // 绑定事件
        this.bindEvents();
        // 渲染初始状态
        this.render();
    }

    // 加载同步设置
    loadSyncSettings() {
        const savedSettings = localStorage.getItem('giteeSyncSettings');
        if (savedSettings) {
            try {
                this.syncSettings = JSON.parse(savedSettings);
                // 填充token输入框
                document.getElementById('giteeToken').value = this.syncSettings.accessToken || '';
            } catch (error) {
                console.error('加载配置失败:', error);
                this.syncSettings = {};
            }
        }
    }

    // 加载本地笔记
    loadLocalNotes() {
        const savedNotes = localStorage.getItem('localNotes');
        if (savedNotes) {
            try {
                this.notes = JSON.parse(savedNotes);
            } catch (error) {
                console.error('加载本地笔记失败:', error);
                this.notes = [];
            }
        } else {
            this.notes = [];
        }
    }

    // 保存笔记到本地存储
    saveLocalNotes() {
        localStorage.setItem('localNotes', JSON.stringify(this.notes));
    }

    // 保存同步设置
    saveSyncSettings() {
        localStorage.setItem('giteeSyncSettings', JSON.stringify(this.syncSettings));
    }

    // 页面切换管理
    currentPage = 'notes';
    historyStack = ['notes'];

    // 绑定事件
    bindEvents() {
        // 同步按钮点击事件
        document.getElementById('syncBtn').addEventListener('click', () => {
            this.syncNotes();
        });

        // 清除配置按钮点击事件
        document.getElementById('clearBtn').addEventListener('click', () => {
            this.clearConfig();
        });

        // Token输入框变化事件
        document.getElementById('giteeToken').addEventListener('input', (e) => {
            this.syncSettings.accessToken = e.target.value;
            this.saveSyncSettings();
        });

        // 搜索输入事件
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                this.renderNotesList();
            });
        }

        // 排序选择事件
        const sortSelect = document.getElementById('sortSelect');
        if (sortSelect) {
            sortSelect.addEventListener('change', () => {
                this.renderNotesList();
            });
        }

        // 返回按钮点击事件
        document.getElementById('backBtn').addEventListener('click', () => {
            this.goBack();
        });

        // 设置按钮点击事件
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                this.navigateTo('settings');
            });
        }
    }

    // 导航到指定页面
    navigateTo(pageName, fromDetail = false) {
        // 获取当前页面和目标页面
        const currentPageElement = document.getElementById(`${this.currentPage}Page`);
        const targetPageElement = document.getElementById(`${pageName}Page`);
        
        if (!targetPageElement) return;
        
        // 更新历史栈
        if (!fromDetail) {
            this.historyStack = [pageName];
        } else {
            this.historyStack.push(pageName);
        }
        
        // 隐藏/显示返回按钮
        this.updateBackButton(pageName);
        
        // 更新页面标题
        this.updatePageTitle(pageName);
        
        // 添加切换动画类
        if (currentPageElement) {
            currentPageElement.classList.remove('page-active');
        }
        targetPageElement.classList.add('page-active');
        
        // 更新当前页面
        this.currentPage = pageName;
    }

    // 返回上一页
    goBack() {
        if (this.historyStack.length <= 1) {
            return;
        }
        
        // 移除当前页面
        this.historyStack.pop();
        // 获取上一页
        const previousPage = this.historyStack[this.historyStack.length - 1];
        
        // 导航到上一页
        const currentPageElement = document.getElementById(`${this.currentPage}Page`);
        const previousPageElement = document.getElementById(`${previousPage}Page`);
        
        if (previousPageElement) {
            // 隐藏/显示返回按钮
            this.updateBackButton(previousPage);
            
            // 更新页面标题
            this.updatePageTitle(previousPage);
            
            // 添加切换动画类
            if (currentPageElement) {
                currentPageElement.classList.remove('page-active');
            }
            previousPageElement.classList.add('page-active');
            
            // 更新当前页面
            this.currentPage = previousPage;
        }
    }

    // 更新返回按钮显示
    updateBackButton(pageName) {
        const backBtn = document.getElementById('backBtn');
        if (!backBtn) return;
        
        // 只有在笔记详情页显示返回按钮
        if (pageName === 'noteDetail') {
            backBtn.style.display = 'flex';
        } else {
            backBtn.style.display = 'none';
        }
    }

    // 更新页面标题
    updatePageTitle(pageName) {
        const pageTitle = document.getElementById('pageTitle');
        const pageSubtitle = document.getElementById('pageSubtitle');
        
        if (!pageTitle || !pageSubtitle) return;
        
        switch (pageName) {
            case 'notes':
                pageTitle.textContent = 'A Note 手机版';
                pageSubtitle.textContent = '通过Gitee Token同步笔记';
                break;
            case 'noteDetail':
                pageTitle.textContent = '笔记详情';
                pageSubtitle.textContent = '';
                break;
            case 'settings':
                pageTitle.textContent = '设置';
                pageSubtitle.textContent = '';
                break;
        }
    }

    // 渲染应用
    render() {
        this.updateStatus();
        // 只有在笔记主页面才渲染笔记列表
        if (this.currentPage === 'notes' || document.getElementById('notesPage').classList.contains('page-active')) {
            this.renderNotesList();
        }
        // 笔记详情页面的渲染由selectNote方法单独处理
    }

    // 更新状态显示
    updateStatus(message = null, type = 'info') {
        const statusElement = document.getElementById('syncStatus');
        if (message) {
            statusElement.textContent = message;
        } else if (this.syncSettings.lastSync) {
            statusElement.textContent = `最后同步: ${this.formatDate(this.syncSettings.lastSync)}`;
        } else {
            statusElement.textContent = '未同步';
        }
        
        // 更新状态样式
        statusElement.className = `status ${type}`;
    }

    // 获取笔记预览
    getNotePreview(content) {
        if (!content || typeof content !== 'string') {
            return '';
        }
        // 移除Markdown格式
        let preview = content
            .replace(/[#*`]/g, '') // 移除Markdown特殊字符
            .replace(/\n+/g, ' ') // 将多行合并为单行
            .trim();
        
        if (preview.length > 100) {
            preview = preview.substring(0, 100) + '...';
        }
        return preview;
    }

    // 渲染笔记列表
    renderNotesList() {
        const notesListElement = document.getElementById('notesList');
        
        if (this.notes.length === 0) {
            notesListElement.innerHTML = `
                <div class="empty-state">
                    暂无笔记
                    <br>
                    请先配置Gitee Token并同步
                </div>
            `;
            return;
        }
        
        // 获取搜索关键词
        const searchQuery = document.getElementById('searchInput')?.value || '';
        // 获取排序方式
        const sortValue = document.getElementById('sortSelect')?.value || 'updatedAt-desc';
        
        // 过滤和排序笔记
        let filteredNotes = [...this.notes];
        
        // 搜索过滤
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filteredNotes = filteredNotes.filter(note => 
                note.title.toLowerCase().includes(query) || 
                note.content.toLowerCase().includes(query)
            );
        }
        
        // 排序
        const [sortField, sortOrder] = sortValue.split('-');
        filteredNotes.sort((a, b) => {
            const aValue = new Date(a[sortField]);
            const bValue = new Date(b[sortField]);
            if (sortOrder === 'asc') {
                return aValue - bValue;
            } else {
                return bValue - aValue;
            }
        });
        
        if (filteredNotes.length === 0) {
            notesListElement.innerHTML = `
                <div class="empty-state">
                    没有找到匹配的笔记
                    <br>
                    请尝试调整搜索关键词
                </div>
            `;
            return;
        }
        
        notesListElement.innerHTML = filteredNotes.map(note => {
            const isActive = this.currentNote && this.currentNote.id === note.id;
            return `
                <div class="note-item ${isActive ? 'active' : ''}" data-note-id="${note.id}">
                    <div class="note-item-title">${this.escapeHtml(note.title)}</div>
                </div>
            `;
        }).join('');
        
        // 绑定笔记项点击事件
        this.bindNoteItemEvents();
    }

    // 绑定笔记项点击事件
    bindNoteItemEvents() {
        const noteItems = document.querySelectorAll('.note-item');
        noteItems.forEach(item => {
            item.addEventListener('click', () => {
                const noteId = item.getAttribute('data-note-id');
                this.selectNote(noteId);
            });
        });
    }

    // 选择笔记 - 跳转到详情页面
    selectNote(noteId) {
        this.currentNote = this.notes.find(note => note.id === noteId);
        if (this.currentNote) {
            // 渲染笔记详情
            this.renderNoteDetail();
            // 跳转到详情页面
            this.navigateTo('noteDetail', true);
        }
    }

    // 渲染笔记详情
    renderNoteDetail() {
        const noteDetailElement = document.getElementById('noteDetail');
        
        if (!this.currentNote) {
            noteDetailElement.innerHTML = `
                <h3 class="note-detail-title">笔记不存在</h3>
                <div class="note-detail-content">
                    该笔记可能已被删除或不存在
                </div>
            `;
            return;
        }
        
        noteDetailElement.innerHTML = `
            <h3 class="note-detail-title">${this.escapeHtml(this.currentNote.title)}</h3>
            <div class="note-detail-content">${this.escapeHtml(this.currentNote.content)}</div>
            <div class="note-detail-meta">
                <span>创建时间: ${this.formatDate(this.currentNote.createdAt)}</span>
                <span>更新时间: ${this.formatDate(this.currentNote.updatedAt)}</span>
            </div>
        `;
    }

    // 同步笔记
    async syncNotes() {
        if (this.isSyncing) {
            this.showNotification('正在同步中，请稍候...', 'warning');
            return;
        }
        
        // 验证配置
        try {
            this.validateConfig();
        } catch (error) {
            this.showNotification(error.message, 'error');
            this.updateStatus('配置错误', 'error');
            return;
        }
        
        // 显示加载状态
        this.isSyncing = true;
        const syncBtn = document.getElementById('syncBtn');
        const syncBtnText = document.getElementById('syncBtnText');
        const syncLoading = document.getElementById('syncLoading');
        
        if (syncBtn && syncBtnText && syncLoading) {
            syncBtn.disabled = true;
            syncBtnText.textContent = '同步中...';
            syncLoading.style.display = 'inline-block';
        }
        
        this.updateStatus('正在同步...', 'info');
        this.showNotification('正在同步笔记...', 'info');
        
        try {
            // 自动配置（获取用户信息和仓库）
            await this.autoSetup();
            // 下载笔记
            await this.downloadNotes();
            // 更新状态
            this.syncSettings.lastSync = new Date().toISOString();
            this.saveSyncSettings();
            this.updateStatus('同步成功', 'success');
            this.showNotification('笔记同步成功', 'success');
            
            // 同步完成后，渲染笔记列表
            this.renderNotesList();
            
            // 如果当前是设置页面，更新底部导航栏并切换到笔记页面
            if (this.currentPage === 'settings') {
                // 更新底部导航栏
                const navItems = document.querySelectorAll('.bottom-nav-item');
                navItems.forEach(navItem => navItem.classList.remove('active'));
                const notesNavItem = document.querySelector('[data-page="notes"]');
                if (notesNavItem) {
                    notesNavItem.classList.add('active');
                }
                
                // 切换到笔记页面
                this.navigateTo('notes');
            }
        } catch (error) {
            console.error('同步失败:', error);
            this.updateStatus(`同步失败: ${error.message}`, 'error');
            this.showNotification(`同步失败: ${error.message}`, 'error');
        } finally {
            this.isSyncing = false;
            // 隐藏加载状态
            if (syncBtn && syncBtnText && syncLoading) {
                syncBtn.disabled = false;
                syncBtnText.textContent = '同步笔记';
                syncLoading.style.display = 'none';
            }
        }
    }

    // 验证配置
    validateConfig() {
        const { accessToken } = this.syncSettings;
        if (!accessToken) {
            throw new Error('请填写Gitee Access Token');
        }
        if (accessToken.length < 10) {
            throw new Error('Token格式不正确');
        }
        return true;
    }

    // 获取认证头部
    getAuthHeaders() {
        return {
            'Content-Type': 'application/json;charset=UTF-8',
            'Authorization': `token ${this.syncSettings.accessToken}`
        };
    }

    // 自动配置（获取用户信息和创建仓库）
    async autoSetup() {
        try {
            // 1. 获取用户信息
            const userResponse = await fetch('https://gitee.com/api/v5/user', {
                method: 'GET',
                headers: this.getAuthHeaders()
            });

            if (!userResponse.ok) {
                throw new Error('Token无效，请检查Token是否正确');
            }

            const userInfo = await userResponse.json();
            const owner = userInfo.login;
            
            // 2. 检查仓库是否存在，不存在则创建
            const repoName = 'a-note-backup';
            const repoCheckResponse = await fetch(
                `https://gitee.com/api/v5/repos/${owner}/${repoName}`,
                {
                    method: 'GET',
                    headers: this.getAuthHeaders()
                }
            );

            if (!repoCheckResponse.ok) {
                // 仓库不存在，创建新仓库
                const createRepoResponse = await fetch('https://gitee.com/api/v5/user/repos', {
                    method: 'POST',
                    headers: this.getAuthHeaders(),
                    body: JSON.stringify({
                        name: repoName,
                        description: 'A Note 浏览器插件自动备份仓库',
                        private: true,
                        has_issues: false,
                        has_wiki: false,
                        can_comment: false
                    })
                });

                if (!createRepoResponse.ok) {
                    throw new Error('自动创建备份仓库失败，请手动创建仓库: ' + repoName);
                }
            }

            // 3. 保存完整配置
            this.syncSettings = {
                ...this.syncSettings,
                owner: owner,
                repo: repoName,
                filePath: 'notes/data.json',
                branch: 'master',
                autoSetup: true
            };
            this.saveSyncSettings();

            return {
                success: true,
                owner: owner,
                repo: repoName
            };
        } catch (error) {
            console.error('自动配置失败:', error);
            throw error;
        }
    }

    // 从Gitee下载笔记
    async downloadNotes() {
        const response = await fetch(
            `https://gitee.com/api/v5/repos/${this.syncSettings.owner}/${this.syncSettings.repo}/contents/${this.syncSettings.filePath}?ref=${this.syncSettings.branch}`,
            {
                method: 'GET',
                headers: this.getAuthHeaders()
            }
        );

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('备份文件不存在，请先在Chrome插件中上传笔记');
            } else {
                throw new Error(`下载失败: ${response.status}`);
            }
        }

        const fileInfo = await response.json();
        
        // Base64解码文件内容
        let content;
        try {
            content = this.base64ToUtf8(fileInfo.content);
        } catch (error) {
            console.error('Base64解码失败:', error);
            throw new Error('文件解码失败');
        }

        let importedData;
        try {
            importedData = JSON.parse(content);
        } catch (parseError) {
            console.error('JSON解析失败:', parseError);
            throw new Error('下载的文件JSON格式不正确');
        }

        // 验证数据格式
        if (!this.validateImportedData(importedData)) {
            throw new Error('下载的文件格式不正确，可能不是有效的笔记备份文件');
        }

        // 更新笔记列表
        this.notes = importedData.notes;
        // 选择第一条笔记
        if (this.notes.length > 0) {
            this.currentNote = this.notes[0];
        } else {
            this.currentNote = null;
        }
        
        // 保存笔记到本地存储
        this.saveLocalNotes();

        return this.notes;
    }

    // 验证导入数据
    validateImportedData(data) {
        if (!data || typeof data !== 'object') {
            return false;
        }
        
        // 检查是否有notes数组
        if (!data.notes || !Array.isArray(data.notes)) {
            return false;
        }
        
        // 验证每个笔记的基本结构
        for (const note of data.notes) {
            if (!note || typeof note !== 'object') {
                return false;
            }
            // 必须有内容字段
            if (typeof note.content !== 'string') {
                return false;
            }
        }
        
        return true;
    }

    // 清除配置
    clearConfig() {
        if (confirm('确定要清除配置吗？这将删除所有同步设置。')) {
            this.syncSettings = {};
            this.notes = [];
            this.currentNote = null;
            // 清空token输入框
            document.getElementById('giteeToken').value = '';
            // 清除本地存储
            localStorage.removeItem('giteeSyncSettings');
            // 重新渲染
            this.render();
            this.showNotification('配置已清除', 'info');
        }
    }

    // 显示通知
    showNotification(message, type = 'info') {
        const notificationElement = document.getElementById('notification');
        notificationElement.textContent = message;
        notificationElement.className = `notification ${type} show`;
        
        // 3秒后隐藏通知
        setTimeout(() => {
            notificationElement.classList.remove('show');
        }, 3000);
    }

    // 格式化日期
    formatDate(dateString) {
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
                return '未知时间';
            }
            return `${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        } catch (error) {
            return '未知时间';
        }
    }

    // HTML转义
    escapeHtml(unsafe) {
        if (typeof unsafe !== 'string') return '';
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Base64 转换为 UTF-8 字符串
    base64ToUtf8(base64) {
        try {
            // 方法1: 使用现代浏览器API
            if (typeof TextDecoder !== 'undefined') {
                const binaryString = atob(base64);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                const decoder = new TextDecoder('utf-8');
                return decoder.decode(bytes);
            }
            
            // 方法2: 兼容旧浏览器
            return decodeURIComponent(escape(atob(base64)));
        } catch (error) {
            console.error('Base64转UTF-8失败:', error);
            // 方法3: 简单回退
            try {
                return atob(base64);
            } catch (e) {
                throw new Error('Base64解码失败: ' + e.message);
            }
        }
    }
}

// 应用初始化
document.addEventListener('DOMContentLoaded', () => {
    // 创建应用实例
    window.mobileNoteApp = new MobileNoteApp();
});
