class MobileNoteApp {
    constructor() {
        this.notes = [];
        this.filteredNotes = [];
        this.currentNote = null;
        this.currentView = 'main';
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
        document.getElementById('searchBtn').addEventListener('click', () => this.showSearchView());
        document.getElementById('closeSearchBtn').addEventListener('click', () => this.hideSearchView());
        
        const searchInput = document.getElementById('searchInput');
        searchInput.addEventListener('input', (e) => this.filterNotes(e.target.value));
        document.querySelector('.clear-search').addEventListener('click', () => {
            searchInput.value = '';
            this.filterNotes('');
        });

        // 排序功能已简化，只按创建时间排序

        // 设置保存
        document.getElementById('saveSettingsBtn').addEventListener('click', () => this.saveSettings());
        
        // 移除配置
        document.getElementById('removeConfigBtn').addEventListener('click', () => this.removeConfig());
        
        // 同步功能（仅在设置页面）
        
        // Token输入时自动检测仓库（简化版，只在保存时检测）
        document.getElementById('giteeToken').addEventListener('input', (e) => {
            if (e.target.value && e.target.value.length > 10) {
                // 显示提示信息，表示可以保存配置来自动检测仓库
                const repoInput = document.getElementById('giteeRepo');
                if (!repoInput.value) {
                    repoInput.placeholder = '输入Token后点击保存自动检测';
                }
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
        
        // 滚动行为控制：只有进入详情页面时才滚动到顶部
        if (viewName === 'detail') {
            window.scrollTo(0, 0);
        }
        
        this.currentView = viewName;
        
        // 特殊处理
        if (viewName === 'main') {
            this.renderNotes();
        } else if (viewName === 'detail' && this.currentNote) {
            this.renderNoteDetail();
        }
    }

    // 搜索界面相关方法
    showSearchView() {
        document.getElementById('searchView').classList.add('show');
        document.getElementById('searchInput').focus();
    }

    hideSearchView() {
        document.getElementById('searchView').classList.remove('show');
        document.getElementById('searchInput').value = '';
        this.filterNotes('');
    }

    // 排序功能已简化，只按创建时间排序

    // 排序功能已简化，只按创建时间排序

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
            
            // 不再自动同步，只在用户点击同步按钮时同步
            // 如果有Gitee配置，只显示同步提示
            if (this.giteeToken && this.giteeRepo) {
                console.log('Gitee配置已加载，等待用户手动同步');
            }
        } catch (error) {
            console.error('加载笔记失败:', error);
            this.showMessage('加载笔记失败: ' + error.message, 'error');
        }
    }

    async detectRepository() {
        const token = document.getElementById('giteeToken').value;
        if (!token) {
            this.showMessage('请输入Access Token', 'warning');
            return;
        }

        try {
            this.showMessage('正在检测A-Note仓库...', 'info');
            
            // 获取用户的所有仓库
            const repos = await this.fetchUserRepositories(token);
            
            // 查找包含A-Note备份的仓库
            const noteRepo = await this.findNoteRepository(repos, token);
            
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
        try {
            // 确保Token是有效的ASCII字符串
            const cleanToken = this.cleanToken(token);
            console.log('清理后的Token长度:', cleanToken.length);
            
            const response = await fetch('https://gitee.com/api/v5/user/repos', {
                headers: {
                    'Authorization': `Bearer ${cleanToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Gitee API错误:', response.status, errorText);
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            const repos = await response.json();
            console.log('获取到的仓库数量:', repos.length);
            return repos;
        } catch (error) {
            console.error('获取仓库列表失败:', error);
            throw error;
        }
    }

    cleanToken(token) {
        // 移除可能的空格和特殊字符
        return token.trim().replace(/[^\x20-\x7E]/g, '');
    }

    async findNoteRepository(repos, token) {
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
            if (await this.checkRepositoryHasNotesFolder(repo, token)) {
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
            this.showMessage('请先配置Access Token', 'warning');
            this.showView('settings');
            return;
        }

        // 如果没有仓库信息，先尝试自动检测
        if (!this.giteeRepo) {
            await this.detectRepository();
            if (!this.giteeRepo) {
                this.showMessage('请先配置仓库', 'warning');
                return;
            }
        }

        try {
            this.showMessage('正在同步...', 'info');
            
            console.log('=== 开始同步 ===');
            console.log('仓库路径:', this.giteeRepo);
            console.log('Token长度:', this.giteeToken ? this.giteeToken.length : 'null');
            
            // 递归获取所有JSON笔记文件
            console.log('开始递归查找所有JSON笔记文件...');
            const files = await this.fetchAllJsonFiles();
            console.log('获取到的JSON笔记文件总数:', files.length);
            console.log('文件详情:', files.map(f => ({name: f.name, type: f.type, path: f.path})));
            
            // 下载并解析笔记
            const newNotes = [];
            
            for (const file of files) {
                console.log(`处理笔记文件 (${newNotes.length + 1}/${files.length}):`, file.name, '路径:', file.path);
                
                try {
                    console.log('正在获取文件内容...');
                    const content = await this.fetchGiteeFileContent(file.path);
                    console.log('文件内容长度:', content.length);
                    
                    let note = null;
                    
                    if (file.name === 'data.json') {
                        // 处理JSON文件
                        note = this.parseNotesFromJson(content, file);
                    } else {
                        console.log('❌ 不支持的文件格式:', file.name);
                        continue;
                    }
                    
                    if (note) {
                        if (Array.isArray(note)) {
                            // JSON文件可能返回多个笔记
                            newNotes.push(...note);
                            console.log(`✅ 成功解析 ${note.length} 条笔记`);
                        } else {
                            newNotes.push(note);
                            console.log('✅ 成功解析笔记:', note.title);
                        }
                    } else {
                        console.log('❌ 解析笔记失败，返回null');
                    }
                } catch (error) {
                    console.error('❌ 处理文件失败:', file.name, error);
                }
            }
            
            console.log('=== 同步统计 ===');
            console.log('发现的JSON文件数:', files.length);
            console.log('成功解析笔记数:', newNotes.length);
            
            // 更新笔记列表
            this.notes = newNotes;
            this.filteredNotes = [...this.notes];
            this.sortNotes();
            this.saveNotesToLocal();
            this.renderNotes();
            
            console.log('最终笔记列表:', newNotes.map(n => n.title));
            
            this.showMessage(`同步成功，共${newNotes.length}条笔记`, 'success');
            
            // 同步完成后自动返回主界面显示笔记
            setTimeout(() => {
                this.showView('main');
            }, 1000);
        } catch (error) {
            console.error('❌ Gitee同步失败:', error);
            this.showMessage('同步失败: ' + error.message, 'error');
        }
    }

    async fetchGiteeFiles(repoPath = this.giteeRepo, token = this.giteeToken, path = '') {
        if (!repoPath || !token) {
            throw new Error('缺少仓库路径或Token');
        }
        
        // 确保Token是有效的ASCII字符串
        const cleanToken = this.cleanToken(token);
        
        const url = `https://gitee.com/api/v5/repos/${repoPath}/contents${path ? '/' + path : ''}`;
        console.log('获取文件列表:', url);
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${cleanToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('获取文件列表失败:', response.status, errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const files = await response.json();
        console.log('获取到的文件数量:', files.length);
        console.log('文件列表:', files.map(f => ({name: f.name, type: f.type, path: f.path})));
        
        return files;
    }

    async fetchAllJsonFiles(repoPath = this.giteeRepo, token = this.giteeToken, path = '') {
         console.log('递归查找JSON笔记文件，路径:', path);
         const allFiles = [];
         
         try {
             const files = await this.fetchGiteeFiles(repoPath, token, path);
             
             for (const file of files) {
                 if (file.type === 'dir') {
                     // 如果是目录，递归查找
                     console.log('发现子目录:', file.path);
                     const subFiles = await this.fetchAllJsonFiles(repoPath, token, file.path);
                     allFiles.push(...subFiles);
                 } else if (file.type === 'file' && file.name === 'data.json') {
                     // 如果是data.json文件，添加到结果中
                     console.log('发现JSON笔记文件:', file.path);
                     allFiles.push(file);
                 }
             }
         } catch (error) {
             console.error('递归查找文件失败:', error);
         }
         
         console.log('路径', path, '下的JSON笔记文件数:', allFiles.length);
         return allFiles;
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
        return this.decodeBase64UTF8(data.content); // 使用UTF-8安全的Base64解码
    }

    decodeBase64UTF8(base64) {
        // 将Base64字符串转换为UTF-8字符串
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return new TextDecoder('utf-8').decode(bytes);
    }

    parseNotesFromJson(content, file) {
        try {
            console.log('开始解析JSON格式的笔记数据...');
            const data = JSON.parse(content);
            console.log('JSON数据结构:', Object.keys(data));
            
            const notes = [];
            
            // 处理不同的JSON格式
            if (Array.isArray(data)) {
                // 格式1: 笔记数组
                console.log('发现笔记数组，数量:', data.length);
                for (const noteData of data) {
                    const note = this.createNoteFromJson(noteData, file);
                    if (note) notes.push(note);
                }
            } else if (data.notes && Array.isArray(data.notes)) {
                // 格式2: 包含notes字段的对象
                console.log('发现notes字段，数量:', data.notes.length);
                for (const noteData of data.notes) {
                    const note = this.createNoteFromJson(noteData, file);
                    if (note) notes.push(note);
                }
            } else if (typeof data === 'object') {
                // 格式3: 单个笔记对象
                console.log('发现单个笔记对象');
                const note = this.createNoteFromJson(data, file);
                if (note) notes.push(note);
            }
            
            console.log('从JSON解析出的笔记数量:', notes.length);
            return notes.length > 0 ? notes : null;
        } catch (error) {
            console.error('解析JSON笔记失败:', error);
            return null;
        }
    }

    createNoteFromJson(noteData, file) {
        try {
            // 提取笔记信息
            const title = noteData.title || noteData.name || '未命名笔记';
            const content = noteData.content || noteData.text || '';
            const description = noteData.description || content.substring(0, 100) + (content.length > 100 ? '...' : '');
            const tags = Array.isArray(noteData.tags) ? noteData.tags : [];
            const createdAt = noteData.createdAt || noteData.created_at || file.created_at || new Date().toISOString();
            const updatedAt = noteData.updatedAt || noteData.updated_at || file.updated_at || new Date().toISOString();
            
            return {
                id: noteData.id || file.sha + '-' + Date.now(),
                title: title,
                description: description || '无描述',
                content: content,
                tags: tags,
                createdAt: createdAt,
                updatedAt: updatedAt,
                source: 'gitee',
                filePath: file.path
            };
        } catch (error) {
            console.error('创建笔记对象失败:', error);
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
        this.renderSearchResults(); // 同时更新搜索结果
    }

    sortNotes() {
        this.filteredNotes.sort((a, b) => {
            return new Date(b.createdAt) - new Date(a.createdAt);
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
                    <p>请前往设置页面配置并同步笔记</p>
                `;
            }
            return;
        }
        
        container.style.display = 'grid';
        emptyState.style.display = 'none';
        
        container.innerHTML = this.filteredNotes.map(note => `
            <div class="note-item" data-note-id="${note.id}">
                <div class="note-content-main">
                    <p class="note-content">${this.escapeHtml(note.description)}</p>
                    <div class="note-meta">
                        <span class="note-date">${this.formatDate(note.createdAt)}</span>
                        ${note.tags.length > 0 ? `
                            <div class="note-tags">
                                ${note.tags.map(tag => `<span class="tag">${this.escapeHtml(tag)}</span>`).join('')}
                            </div>
                        ` : ''}
                    </div>
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

    renderSearchResults() {
        const container = document.getElementById('searchResults');
        const searchInput = document.getElementById('searchInput');
        const searchTerm = searchInput.value.trim();
        
        if (!searchTerm) {
            container.innerHTML = '';
            return;
        }
        
        const filteredNotes = this.notes.filter(note => 
            note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            note.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            note.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
            note.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
        );
        
        if (filteredNotes.length === 0) {
            container.innerHTML = `
                <div class="search-empty">
                    <div class="empty-icon">🔍</div>
                    <h3>未找到匹配的笔记</h3>
                    <p>尝试调整搜索关键词</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = filteredNotes.map(note => `
            <div class="search-result-item" data-note-id="${note.id}">
                <div class="result-header">
                    <h4 class="result-title">${this.escapeHtml(note.title)}</h4>
                    <span class="result-date">${this.formatDate(note.updatedAt)}</span>
                </div>
                <p class="result-description">${this.escapeHtml(note.description)}</p>
                ${note.tags.length > 0 ? `
                    <div class="result-tags">
                        ${note.tags.map(tag => `<span class="tag">${this.escapeHtml(tag)}</span>`).join('')}
                    </div>
                ` : ''}
            </div>
        `).join('');
        
        // 绑定点击事件
        container.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const noteId = item.dataset.noteId;
                this.showNoteDetail(noteId);
                this.hideSearchView();
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
        // 将文本内容转换为HTML格式（支持Markdown语法）
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
            document.getElementById('giteeToken').value = this.giteeToken;
        }
        if (this.giteeRepo) {
            document.getElementById('giteeRepo').value = this.giteeRepo;
        }
    }

    async saveSettings() {
        const tokenInput = document.getElementById('giteeToken');
        const repo = document.getElementById('giteeRepo').value;
        
        // 更新Token设置
        if (tokenInput.value) {
            this.giteeToken = tokenInput.value;
            localStorage.setItem('a-note-gitee-token', tokenInput.value);
            
            // 如果有Token但没有仓库，自动检测仓库
            if (!repo) {
                try {
                    this.showMessage('正在自动检测仓库...', 'info');
                    await this.detectRepository();
                } catch (error) {
                    console.error('自动检测仓库失败:', error);
                    this.showMessage('自动检测仓库失败，请手动输入仓库名称', 'warning');
                }
            }
        }
        
        this.giteeRepo = repo || this.giteeRepo;
        if (this.giteeRepo) {
            localStorage.setItem('a-note-gitee-repo', this.giteeRepo);
        }
        
        this.showMessage('设置已保存，正在自动同步笔记...', 'success');
        
        // 自动同步笔记
        if (this.giteeToken && this.giteeRepo) {
            try {
                await this.syncWithGitee();
            } catch (error) {
                console.error('自动同步失败:', error);
                this.showMessage('自动同步失败，请手动点击同步按钮重试', 'warning');
            }
        }
    }

    removeConfig() {
        if (confirm('确定要移除配置吗？这将清除所有本地笔记和同步配置。')) {
            // 清除Gitee配置
            localStorage.removeItem('a-note-gitee-token');
            localStorage.removeItem('a-note-gitee-repo');
            
            // 清除本地笔记
            localStorage.removeItem('a-note-notes');
            
            // 重置应用状态
            this.giteeToken = null;
            this.giteeRepo = null;
            this.notes = [];
            this.filteredNotes = [];
            
            // 更新设置界面
            document.getElementById('giteeToken').value = '';
            document.getElementById('giteeRepo').value = '';
            
            // 更新主界面
            this.renderNotes();
            
            this.showMessage('配置已移除，所有笔记已清除', 'success');
        }
    }

    saveNotesToLocal() {
        localStorage.setItem('a-note-notes', JSON.stringify(this.notes));
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