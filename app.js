class MobileNoteApp {
    constructor() {
        this.notes = [];
        this.filteredNotes = [];
        this.currentNote = null;
        this.currentView = 'main';
        this.sortBy = 'updated';
        this.giteeToken = null;
        this.giteeRepo = null;
        
        this.initializeApp();
    }

    initializeApp() {
        this.bindEvents();
        this.loadSettings();
        this.loadNotes();
        this.showView('main');
    }

    bindEvents() {
        // 视图切换
        document.getElementById('settingsBtn').addEventListener('click', () => this.showView('settings'));
        document.getElementById('backBtn').addEventListener('click', () => this.showView('main'));
        document.getElementById('backFromDetailBtn').addEventListener('click', () => this.showView('main'));
        
        // 搜索功能
        const searchInput = document.getElementById('searchInput');
        searchInput.addEventListener('input', (e) => this.filterNotes(e.target.value));
        document.querySelector('.clear-search').addEventListener('click', () => {
            searchInput.value = '';
            this.filterNotes('');
        });

        // 排序功能
        document.getElementById('sortSelect').addEventListener('change', (e) => {
            this.sortBy = e.target.value;
            this.sortNotes();
            this.renderNotes();
        });

        // 设置保存
        document.getElementById('saveSettingsBtn').addEventListener('click', () => this.saveSettings());
        
        // 同步功能
        document.getElementById('syncBtn').addEventListener('click', () => this.syncWithGitee());
        
        // 刷新功能
        document.getElementById('refreshBtn').addEventListener('click', () => this.refreshNotes());
        
        // 自动检测仓库
        document.getElementById('detectRepoBtn').addEventListener('click', () => this.detectRepository());
        document.getElementById('giteeToken').addEventListener('input', (e) => {
            if (e.target.value && e.target.value.length > 10) {
                // 延迟自动检测
                setTimeout(() => this.detectRepository(), 1000);
            }
        });
    }

    showView(viewName) {
        // 隐藏所有视图
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });
        
        // 显示目标视图
        document.getElementById(viewName + 'View').classList.add('active');
        this.currentView = viewName;
        
        // 特殊处理
        if (viewName === 'main') {
            this.renderNotes();
        } else if (viewName === 'detail' && this.currentNote) {
            this.renderNoteDetail();
        }
    }

    async loadNotes() {
        try {
            // 首先尝试从本地存储加载
            const savedNotes = localStorage.getItem('a-note-notes');
            if (savedNotes) {
                this.notes = JSON.parse(savedNotes);
                this.filteredNotes = [...this.notes];
                this.sortNotes();
                this.renderNotes();
            }
            
            // 如果有Gitee配置，尝试同步
            if (this.giteeToken && this.giteeRepo) {
                await this.syncWithGitee();
            }
        } catch (error) {
            console.error('加载笔记失败:', error);
            this.showMessage('加载笔记失败: ' + error.message, 'error');
        }
    }

    async detectRepository() {
        const token = document.getElementById('giteeToken').value;
        if (!token) {
            this.showMessage('请输入Gitee Token', 'warning');
            return;
        }

        try {
            this.showMessage('正在检测A-Note仓库...', 'info');
            
            // 获取用户的所有仓库
            const repos = await this.fetchUserRepositories(token);
            
            // 查找包含A-Note备份的仓库
            const noteRepo = this.findNoteRepository(repos);
            
            if (noteRepo) {
                this.giteeRepo = noteRepo.full_name;
                document.getElementById('giteeRepo').value = this.giteeRepo;
                this.showMessage(`已检测到仓库: ${this.giteeRepo}`, 'success');
            } else {
                this.showMessage('未找到A-Note备份仓库，请手动创建', 'warning');
            }
        } catch (error) {
            console.error('检测仓库失败:', error);
            this.showMessage('检测失败: ' + error.message, 'error');
        }
    }

    async fetchUserRepositories(token) {
        const response = await fetch('https://gitee.com/api/v5/user/repos', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
    }

    findNoteRepository(repos) {
        // 优先查找包含A-Note相关关键词的仓库
        const keywords = ['a-note', 'anote', 'note-backup', 'notes-backup', '笔记备份'];
        
        for (const repo of repos) {
            const name = repo.name.toLowerCase();
            const fullName = repo.full_name.toLowerCase();
            
            // 检查仓库名称是否包含关键词
            for (const keyword of keywords) {
                if (name.includes(keyword) || fullName.includes(keyword)) {
                    return repo;
                }
            }
            
            // 检查仓库是否包含notes文件夹
            if (this.checkRepositoryHasNotesFolder(repo, repos)) {
                return repo;
            }
        }
        
        // 如果没有找到特定仓库，返回第一个可用的仓库
        return repos.length > 0 ? repos[0] : null;
    }

    async checkRepositoryHasNotesFolder(repo, token) {
        try {
            const contents = await this.fetchGiteeFiles(repo.full_name, token);
            return contents.some(item => item.type === 'dir' && item.name.toLowerCase().includes('note'));
        } catch (error) {
            return false;
        }
    }

    async syncWithGitee() {
        if (!this.giteeToken) {
            this.showMessage('请先配置Gitee Token', 'warning');
            this.showView('settings');
            return;
        }

        // 如果没有仓库信息，先尝试自动检测
        if (!this.giteeRepo) {
            await this.detectRepository();
            if (!this.giteeRepo) {
                this.showMessage('请先配置Gitee仓库', 'warning');
                return;
            }
        }

        try {
            this.showMessage('正在同步...', 'info');
            
            // 获取仓库文件列表
            const files = await this.fetchGiteeFiles();
            
            // 下载并解析笔记
            const newNotes = [];
            for (const file of files) {
                if (file.name.endsWith('.md')) {
                    const content = await this.fetchGiteeFileContent(file.path);
                    const note = this.parseNoteFromContent(content, file);
                    if (note) {
                        newNotes.push(note);
                    }
                }
            }
            
            // 更新笔记列表
            this.notes = newNotes;
            this.filteredNotes = [...this.notes];
            this.sortNotes();
            this.saveNotesToLocal();
            this.renderNotes();
            
            this.showMessage(`同步成功，共${newNotes.length}条笔记`, 'success');
        } catch (error) {
            console.error('Gitee同步失败:', error);
            this.showMessage('同步失败: ' + error.message, 'error');
        }
    }

    async fetchGiteeFiles(repoPath = this.giteeRepo, token = this.giteeToken) {
        if (!repoPath || !token) {
            throw new Error('缺少仓库路径或Token');
        }
        
        const url = `https://gitee.com/api/v5/repos/${repoPath}/contents`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
    }

    async fetchGiteeFileContent(filePath) {
        const url = `https://gitee.com/api/v5/repos/${this.giteeRepo}/contents/${encodeURIComponent(filePath)}`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${this.giteeToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        return atob(data.content); // Base64解码
    }

    parseNoteFromContent(content, file) {
        try {
            // 解析Markdown内容，提取标题和元数据
            const lines = content.split('\n');
            let title = file.name.replace('.md', '');
            let description = '';
            let tags = [];
            
            // 尝试从内容中提取标题和描述
            for (let i = 0; i < Math.min(lines.length, 5); i++) {
                const line = lines[i].trim();
                if (line.startsWith('# ')) {
                    title = line.substring(2).trim();
                } else if (line && !description) {
                    description = line.length > 100 ? line.substring(0, 100) + '...' : line;
                }
            }
            
            return {
                id: file.sha || file.path,
                title: title,
                description: description || '无描述',
                content: content,
                tags: tags,
                createdAt: file.created_at || new Date().toISOString(),
                updatedAt: file.updated_at || new Date().toISOString(),
                source: 'gitee',
                filePath: file.path
            };
        } catch (error) {
            console.error('解析笔记失败:', error);
            return null;
        }
    }

    filterNotes(searchTerm) {
        if (!searchTerm.trim()) {
            this.filteredNotes = [...this.notes];
        } else {
            const term = searchTerm.toLowerCase();
            this.filteredNotes = this.notes.filter(note => 
                note.title.toLowerCase().includes(term) ||
                note.description.toLowerCase().includes(term) ||
                note.content.toLowerCase().includes(term) ||
                note.tags.some(tag => tag.toLowerCase().includes(term))
            );
        }
        this.sortNotes();
        this.renderNotes();
    }

    sortNotes() {
        this.filteredNotes.sort((a, b) => {
            switch (this.sortBy) {
                case 'created':
                    return new Date(b.createdAt) - new Date(a.createdAt);
                case 'title':
                    return a.title.localeCompare(b.title, 'zh-CN');
                case 'updated':
                default:
                    return new Date(b.updatedAt) - new Date(a.updatedAt);
            }
        });
    }

    renderNotes() {
        const container = document.getElementById('notesContainer');
        const emptyState = document.getElementById('emptyState');
        
        if (this.filteredNotes.length === 0) {
            container.style.display = 'none';
            emptyState.style.display = 'block';
            
            const searchInput = document.getElementById('searchInput');
            if (searchInput.value.trim()) {
                emptyState.innerHTML = `
                    <div class="empty-icon">🔍</div>
                    <h3>未找到匹配的笔记</h3>
                    <p>尝试调整搜索关键词</p>
                `;
            } else {
                emptyState.innerHTML = `
                    <div class="empty-icon">📝</div>
                    <h3>暂无笔记</h3>
                    <p>点击同步按钮从Gitee获取笔记</p>
                    <button class="sync-btn" onclick="app.syncWithGitee()">立即同步</button>
                `;
            }
            return;
        }
        
        container.style.display = 'grid';
        emptyState.style.display = 'none';
        
        container.innerHTML = this.filteredNotes.map(note => `
            <div class="note-item" data-note-id="${note.id}">
                <div class="note-header">
                    <h3 class="note-title">${this.escapeHtml(note.title)}</h3>
                    <span class="note-date">${this.formatDate(note.updatedAt)}</span>
                </div>
                <p class="note-description">${this.escapeHtml(note.description)}</p>
                <div class="note-footer">
                    ${note.tags.length > 0 ? `
                        <div class="note-tags">
                            ${note.tags.map(tag => `<span class="tag">${this.escapeHtml(tag)}</span>`).join('')}
                        </div>
                    ` : ''}
                    <span class="note-source">${note.source === 'gitee' ? 'Gitee' : '本地'}</span>
                </div>
            </div>
        `).join('');
        
        // 绑定点击事件
        container.querySelectorAll('.note-item').forEach(item => {
            item.addEventListener('click', () => {
                const noteId = item.dataset.noteId;
                this.showNoteDetail(noteId);
            });
        });
    }

    showNoteDetail(noteId) {
        this.currentNote = this.notes.find(note => note.id === noteId);
        if (this.currentNote) {
            this.showView('detail');
        }
    }

    renderNoteDetail() {
        if (!this.currentNote) return;
        
        const container = document.getElementById('noteDetailContent');
        container.innerHTML = `
            <div class="note-detail-header">
                <h1>${this.escapeHtml(this.currentNote.title)}</h1>
                <div class="note-meta">
                    <span class="update-time">更新于: ${this.formatDate(this.currentNote.updatedAt)}</span>
                    <span class="create-time">创建于: ${this.formatDate(this.currentNote.createdAt)}</span>
                </div>
            </div>
            <div class="note-content">
                ${this.markdownToHtml(this.currentNote.content)}
            </div>
        `;
    }

    markdownToHtml(markdown) {
        // 简单的Markdown到HTML转换
        return markdown
            .replace(/^# (.*$)/gm, '<h1>$1</h1>')
            .replace(/^## (.*$)/gm, '<h2>$1</h2>')
            .replace(/^### (.*$)/gm, '<h3>$1</h3>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>')
            .replace(/^<p>/, '')
            .replace(/<p>$/, '');
    }

    loadSettings() {
        this.giteeToken = localStorage.getItem('a-note-gitee-token');
        this.giteeRepo = localStorage.getItem('a-note-gitee-repo');
        
        // 更新设置界面
        if (this.giteeToken) {
            document.getElementById('giteeToken').value = '••••••••';
        }
        if (this.giteeRepo) {
            document.getElementById('giteeRepo').value = this.giteeRepo;
        }
    }

    saveSettings() {
        const token = document.getElementById('giteeToken').value;
        const repo = document.getElementById('giteeRepo').value;
        
        // 如果token是掩码，保持原值
        if (token !== '••••••••') {
            this.giteeToken = token;
            localStorage.setItem('a-note-gitee-token', token);
        }
        
        this.giteeRepo = repo;
        localStorage.setItem('a-note-gitee-repo', repo);
        
        this.showMessage('设置已保存', 'success');
        setTimeout(() => this.showView('main'), 1000);
    }

    saveNotesToLocal() {
        localStorage.setItem('a-note-notes', JSON.stringify(this.notes));
    }

    refreshNotes() {
        this.loadNotes();
        this.showMessage('笔记已刷新', 'success');
    }

    showMessage(message, type = 'info') {
        // 创建消息提示元素
        const messageEl = document.createElement('div');
        messageEl.className = `message message-${type}`;
        messageEl.textContent = message;
        
        // 添加到页面
        document.body.appendChild(messageEl);
        
        // 显示动画
        setTimeout(() => messageEl.classList.add('show'), 10);
        
        // 自动隐藏
        setTimeout(() => {
            messageEl.classList.remove('show');
            setTimeout(() => {
                if (messageEl.parentNode) {
                    messageEl.parentNode.removeChild(messageEl);
                }
            }, 300);
        }, 3000);
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return '刚刚';
        if (diffMins < 60) return `${diffMins}分钟前`;
        if (diffHours < 24) return `${diffHours}小时前`;
        if (diffDays < 7) return `${diffDays}天前`;
        
        return date.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    window.app = new MobileNoteApp();
});

// 添加消息样式
const messageStyles = `
.message {
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%) translateY(-100px);
    background: #4f46e5;
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    z-index: 1000;
    transition: transform 0.3s ease;
    max-width: 300px;
    text-align: center;
}

.message.show {
    transform: translateX(-50%) translateY(0);
}

.message-success {
    background: #10b981;
}

.message-warning {
    background: #f59e0b;
}

.message-error {
    background: #ef4444;
}
`;

// 注入消息样式
const styleSheet = document.createElement('style');
styleSheet.textContent = messageStyles;
document.head.appendChild(styleSheet);