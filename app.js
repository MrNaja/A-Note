class MobileNoteApp {
    constructor() {
        this.notes = [];
        this.filteredNotes = [];
        this.currentNote = null;
        this.currentView = 'main';
        this.giteeToken = null;
        this.giteeRepo = null;
        this.mainViewScrollPosition = 0; // 记录主界面的滚动位置
        this.viewHistory = []; // 记录视图历史
        
        this.initializeApp();
    }

    initializeApp() {
        this.bindEvents();
        this.loadSettings();
        this.loadNotes();
        this.showView('main');
        
        // 初始化浏览器历史记录
        this.initializeHistory();
        
        // 加载最后同步时间
        this.loadLastSyncTime();
    }



    bindEvents() {
        // 视图切换
        const addNoteBtn = document.getElementById('addNoteBtn');
        if (addNoteBtn) {
            console.log('新增按钮找到，绑定事件');
            addNoteBtn.addEventListener('click', () => {
                console.log('新增按钮被点击');
                this.createNewNote();
            });
        } else {
            console.error('新增按钮未找到');
        }
        
        document.getElementById('settingsBtn').addEventListener('click', () => this.showView('settings'));
        document.getElementById('backBtn').addEventListener('click', () => this.showView('main'));
        document.getElementById('backFromDetailBtn').addEventListener('click', () => this.handleBackFromDetail());
        
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
        
        // 同步笔记
        document.getElementById('syncNotesBtn').addEventListener('click', () => this.syncWithGitee());
        
        // 上传笔记
        document.getElementById('uploadNotesBtn').addEventListener('click', () => this.uploadNotesToGitee());
        
        // 字体大小按钮事件
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('font-size-btn')) {
                const fontSize = e.target.dataset.size;
                this.fontSize = fontSize;
                localStorage.setItem('a-note-font-size', fontSize);
                this.updateFontSizeButtons(fontSize);
                this.applyFontSize();
                this.showMessage(`字体大小已设置为${fontSize}`, 'success');
            }
        });
        
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

    showView(viewName, fromHistory = false) {
        // 保存当前主界面的滚动位置
        if (this.currentView === 'main') {
            this.mainViewScrollPosition = window.scrollY;
        }
        
        // 隐藏所有视图
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });
        
        // 显示目标视图
        document.getElementById(viewName + 'View').classList.add('active');
        
        // 滚动行为控制
        if (viewName === 'detail' || viewName === 'settings') {
            // 进入详情页面或设置页面时滚动到顶部
            window.scrollTo(0, 0);
        } else if (viewName === 'main') {
            // 返回主界面时恢复之前的滚动位置
            setTimeout(() => {
                window.scrollTo(0, this.mainViewScrollPosition);
            }, 10);
        }
        
        this.currentView = viewName;
        
        // 特殊处理
        if (viewName === 'main') {
            this.renderNotes();
        } else if (viewName === 'detail') {
            // 延迟渲染详情页面，确保currentNote已设置
            setTimeout(() => {
                if (this.currentNote) {
                    this.renderNoteDetail();
                }
            }, 10);
        }
        
        // 管理浏览器历史记录（如果不是从历史记录触发的）
        if (!fromHistory) {
            if (viewName === 'main') {
                // 返回主界面时，如果历史记录栈中有其他视图，则添加历史记录
                if (this.viewHistory.length > 0 && this.viewHistory[this.viewHistory.length - 1] !== 'main') {
                    this.pushToHistory(viewName);
                }
            } else {
                // 切换到其他视图时添加历史记录
                this.pushToHistory(viewName);
            }
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
                // 过滤掉内容为空的笔记（与createNewNote保持一致）
                this.filteredNotes = this.notes.filter(note => 
                    note.content !== undefined
                );
                this.sortNotes();
                this.renderNotes();
                // 更新设置页面的本地笔记数
                this.updateSettingsInfo();
            } else {
                // 如果没有笔记数据，也更新设置页面
                this.notes = [];
                this.filteredNotes = [];
                this.updateSettingsInfo();
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
            // 过滤掉内容为空的笔记
            this.filteredNotes = this.notes.filter(note => 
                note.content && note.content.trim() !== ''
            );
            this.sortNotes();
            this.saveNotesToLocal();
            this.renderNotes();
            
            console.log('最终笔记列表:', newNotes.map(n => n.title));
            
            this.showMessage(`同步成功，共${this.filteredNotes.length}条笔记`, 'success');
            
            // 更新最后同步时间
            this.updateLastSyncTime();
            
            // 同步完成后自动返回主界面显示笔记
            setTimeout(() => {
                this.showView('main');
            }, 1000);
        } catch (error) {
            console.error('❌ Gitee同步失败:', error);
            this.showMessage('同步失败: ' + error.message, 'error');
        }
    }

    async uploadNotesToGitee() {
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
            console.log('=== 开始上传笔记 ===');
            console.log('仓库路径:', this.giteeRepo);
            console.log('本地笔记数:', this.notes.length);

            // 显示上传进度
            this.showMessage('正在上传笔记到Gitee...', 'info');

            // 创建笔记目录（如果不存在）
            await this.createNotesDirectory();

            // 准备要上传的笔记数据
            const notesData = this.notes.filter(note => note.content && note.content.trim() !== '');
            console.log('要上传的有效笔记数:', notesData.length);

            if (notesData.length === 0) {
                this.showMessage('没有可上传的笔记', 'warning');
                return;
            }

            // 创建上传数据
            const uploadData = {
                notes: notesData,
                timestamp: new Date().toISOString(),
                version: '1.3.0',
                count: notesData.length
            };

            // 上传到Gitee
            await this.uploadFileToGitee('notes/data.json', JSON.stringify(uploadData, null, 2));

            console.log('✅ 上传成功');
            this.showMessage(`上传成功，共${notesData.length}条笔记`, 'success');

            // 更新最后同步时间
            this.updateLastSyncTime();

        } catch (error) {
            console.error('❌ 上传失败:', error);
            this.showMessage('上传失败: ' + error.message, 'error');
        }
    }

    async createNotesDirectory() {
        try {
            // 检查notes目录是否存在
            const files = await this.fetchGiteeFiles();
            const notesDirExists = files.some(file => file.type === 'dir' && file.name === 'notes');
            
            if (!notesDirExists) {
                // 创建notes目录
                await this.createDirectoryInGitee('notes');
                console.log('✅ 创建notes目录成功');
            }
        } catch (error) {
            console.error('检查/创建notes目录失败:', error);
            // 如果目录已存在或其他错误，继续上传
        }
    }

    async createDirectoryInGitee(dirName) {
        const url = `https://gitee.com/api/v5/repos/${this.giteeRepo}/contents/${dirName}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.giteeToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content: '', // 空内容表示创建目录
                message: `创建笔记目录: ${dirName}`
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`创建目录失败: HTTP ${response.status}: ${errorText}`);
        }
    }

    async uploadFileToGitee(filePath, content) {
        const url = `https://gitee.com/api/v5/repos/${this.giteeRepo}/contents/${filePath}`;
        
        // 将内容转换为Base64
        const base64Content = btoa(unescape(encodeURIComponent(content)));
        
        // 先尝试获取文件信息，检查是否已存在
        let sha = null;
        try {
            const fileInfoResponse = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.giteeToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (fileInfoResponse.ok) {
                const fileInfo = await fileInfoResponse.json();
                sha = fileInfo.sha;
                console.log('文件已存在，获取SHA:', sha);
            }
        } catch (error) {
            console.log('文件不存在，将创建新文件');
        }
        
        // 构建请求体
        const requestBody = {
            content: base64Content,
            message: `上传笔记数据: ${new Date().toLocaleString()}`,
            branch: 'master'
        };
        
        // 如果文件已存在，添加SHA值
        if (sha) {
            requestBody.sha = sha;
        }
        
        const response = await fetch(url, {
            method: sha ? 'PUT' : 'POST',
            headers: {
                'Authorization': `Bearer ${this.giteeToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`上传文件失败: HTTP ${response.status}: ${errorText}`);
        }

        console.log('✅ 文件上传成功:', filePath);
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
            // 过滤掉内容为空的笔记
            this.filteredNotes = this.notes.filter(note => 
                note.content && note.content.trim() !== ''
            );
        } else {
            const term = searchTerm.toLowerCase();
            this.filteredNotes = this.notes.filter(note => 
                (note.title.toLowerCase().includes(term) ||
                note.description.toLowerCase().includes(term) ||
                note.content.toLowerCase().includes(term) ||
                note.tags.some(tag => tag.toLowerCase().includes(term))) &&
                note.content && note.content.trim() !== ''
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
                    <p class="note-content">${this.escapeHtml(note.description || note.content.substring(0, 100) + (note.content.length > 100 ? '...' : ''))}</p>
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
    
    createNewNote() {
        console.log('createNewNote方法被调用');
        
        // 创建新的空白笔记
        const newNote = {
            id: Date.now().toString(),
            title: '新笔记',
            description: '',
            content: '',
            tags: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        console.log('创建新笔记:', newNote);
        
        // 添加到笔记列表开头
        this.notes.unshift(newNote);
        this.currentNote = newNote;
        
        console.log('当前笔记数:', this.notes.length);
        
        // 更新过滤后的笔记列表（包含空内容的笔记）
        this.filteredNotes = this.notes.filter(note => 
            note.content !== undefined
        );
        this.sortNotes();
        
        // 更新本地存储
        this.saveNotesToLocal();
        
        // 显示详情页并直接进入编辑模式
        console.log('准备显示详情页');
        this.showView('detail');
        
        // 延迟进入编辑模式，确保DOM已渲染
        setTimeout(() => {
            console.log('进入编辑模式');
            this.toggleEditMode();
        }, 100);
    }

    renderNoteDetail() {
        if (!this.currentNote) return;
        
        const container = document.getElementById('noteDetailContent');
        container.innerHTML = `
            <div class="note-content">
                ${this.markdownToHtml(this.currentNote.content)}
            </div>
        `;
        
        // 添加按钮事件监听器
        this.attachDetailButtonEvents();
    }

    attachDetailButtonEvents() {
        // 删除按钮事件
        const deleteBtn = document.getElementById('deleteNoteBtn');
        if (deleteBtn) {
            deleteBtn.onclick = () => this.deleteCurrentNote();
        }
        
        // 编辑按钮事件
        const editBtn = document.getElementById('editNoteBtn');
        if (editBtn) {
            editBtn.onclick = () => this.toggleEditMode();
        }
    }

    deleteCurrentNote() {
        if (!this.currentNote) return;
        
        // 确认删除
        if (!confirm('确定要删除这条笔记吗？此操作不可撤销。')) {
            return;
        }
        
        try {
            // 从笔记列表中移除当前笔记
            const noteIndex = this.notes.findIndex(note => note.id === this.currentNote.id);
            if (noteIndex !== -1) {
                this.notes.splice(noteIndex, 1);
                
                // 同时从过滤后的笔记列表中移除
                const filteredIndex = this.filteredNotes.findIndex(note => note.id === this.currentNote.id);
                if (filteredIndex !== -1) {
                    this.filteredNotes.splice(filteredIndex, 1);
                }
                
                // 更新本地存储
                this.saveNotesToLocal();
                
                // 显示成功消息
                this.showMessage('笔记已删除', 'success');
                
                // 返回主界面并重新渲染笔记列表
                // 注意：showView('main')会自动调用renderNotes()，所以不需要重复调用
                this.showView('main');
            }
        } catch (error) {
            console.error('删除笔记失败:', error);
            this.showMessage('删除失败，请重试', 'error');
        }
    }

    toggleEditMode() {
        if (!this.currentNote) return;
        
        const container = document.getElementById('noteDetailContent');
        const editBtn = document.getElementById('editNoteBtn');
        
        if (container.classList.contains('edit-mode')) {
            // 退出编辑模式，保存修改
            const contentEl = container.querySelector('.note-content');
            if (contentEl) {
                // 获取编辑后的HTML内容，并转换为纯文本格式
                const editedHtml = contentEl.innerHTML.trim();
                const newContent = this.htmlToMarkdown(editedHtml);
                
                if (newContent !== this.currentNote.content) {
                    // 更新笔记内容
                    this.currentNote.content = newContent;
                    this.currentNote.updatedAt = new Date().toISOString();
                    
                    // 保存到本地存储
                    this.saveNotesToLocal();
                    
                    // 重新渲染详情页
                    this.renderNoteDetail();
                    
                    this.showMessage('笔记已保存', 'success');
                }
            }
            
            // 切换按钮文本
            editBtn.textContent = '编辑';
            container.classList.remove('edit-mode');
            
            // 移除编辑模式样式
            contentEl?.removeAttribute('contenteditable');
            contentEl?.classList.remove('editable');
        } else {
            // 进入编辑模式
            const contentEl = container.querySelector('.note-content');
            if (contentEl) {
                // 设置内容可编辑
                contentEl.setAttribute('contenteditable', 'true');
                contentEl.classList.add('editable');
                
                // 切换按钮文本
                editBtn.textContent = '完成';
                container.classList.add('edit-mode');
                
                // 自动聚焦到内容区域，但不移动光标位置
                contentEl.focus();
                
                // 将光标移动到开头，避免自动滚动到底部
                const range = document.createRange();
                const selection = window.getSelection();
                range.selectNodeContents(contentEl);
                range.collapse(true); // true表示移动到开头
                selection.removeAllRanges();
                selection.addRange(range);
            }
        }
    }



    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    markdownToHtml(markdown) {
        // 将文本内容转换为HTML格式（支持Markdown语法）
        
        // 首先处理代码块（需要先处理，避免被其他规则影响）
        let html = markdown.replace(/```(\w*)\n([\s\S]*?)\n```/g, (match, language, code) => {
            // 清理代码内容，移除多余的空行
            code = code.replace(/^\n+|\n+$/g, '');
            
            // 转义HTML特殊字符
            code = this.escapeHtml(code);
            
            // 添加语言标签
            const langClass = language ? ` class="language-${language}"` : '';
            
            return `<pre><code${langClass}>${code}</code></pre>`;
        });
        
        // 然后处理其他Markdown语法
        html = html
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
            
        return html;
    }

    htmlToMarkdown(html) {
        // 增强的HTML到Markdown转换，更好地保留换行
        return html
            // 处理换行标签
            .replace(/<br\s*\/?>/g, '\n')
            // 处理代码块
            .replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/g, '```\n$1\n```')
            // 处理行内代码
            .replace(/<code>([^<]+)<\/code>/g, '`$1`')
            // 处理粗体
            .replace(/<strong>([^<]+)<\/strong>/g, '**$1**')
            // 处理斜体
            .replace(/<em>([^<]+)<\/em>/g, '*$1*')
            // 处理标题
            .replace(/<h3>([^<]+)<\/h3>/g, '### $1\n\n')
            .replace(/<h2>([^<]+)<\/h2>/g, '## $1\n\n')
            .replace(/<h1>([^<]+)<\/h1>/g, '# $1\n\n')
            // 增强段落处理：保留两个换行以维持段落间距
            .replace(/<p>([\s\S]*?)<\/p>/g, '$1\n\n')
            // 处理div等块级元素，添加额外的换行
            .replace(/<div[^>]*>([\s\S]*?)<\/div>/g, '$1\n\n')
            // 移除其他HTML标签
            .replace(/<[^>]+>/g, '')
            // 转换空格
            .replace(/&nbsp;/g, ' ')
            // 清理多余的换行
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    loadSettings() {
        this.giteeToken = localStorage.getItem('a-note-gitee-token');
        this.giteeRepo = localStorage.getItem('a-note-gitee-repo');
        
        // 加载字体大小设置
        const savedFontSize = localStorage.getItem('a-note-font-size') || '14px';
        this.fontSize = savedFontSize;
        
        // 更新设置界面
        if (this.giteeToken) {
            document.getElementById('giteeToken').value = this.giteeToken;
        }
        
        if (this.giteeRepo) {
            document.getElementById('giteeRepo').value = this.giteeRepo;
        }
        
        // 更新字体大小按钮状态
        this.updateFontSizeButtons(savedFontSize);
        
        // 应用字体大小
        this.applyFontSize();
    }

    applyFontSize() {
        // 设置CSS变量到:root
        document.documentElement.style.setProperty('--note-font-size', this.fontSize);
        
        // 重新渲染笔记列表以适配新的高度
        if (this.currentView === 'main') {
            this.renderNotes();
        }
    }

    updateFontSizeButtons(fontSize) {
        const buttons = document.querySelectorAll('.font-size-btn');
        buttons.forEach(button => {
            button.classList.remove('active');
            if (button.dataset.size === fontSize) {
                button.classList.add('active');
            }
        });
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

    handleBackFromDetail() {
        const container = document.getElementById('noteDetailContent');
        
        // 检查是否处于编辑模式
        if (container.classList.contains('edit-mode')) {
            // 处于编辑模式，先保存内容再返回
            this.saveAndExitEditMode();
        } else {
            // 不在编辑模式，直接返回主界面
            this.showView('main');
        }
    }

    saveAndExitEditMode() {
        if (!this.currentNote) return;
        
        const container = document.getElementById('noteDetailContent');
        const contentEl = container.querySelector('.note-content');
        const editBtn = document.getElementById('editNoteBtn');
        
        if (contentEl) {
            // 获取编辑后的HTML内容，并转换为纯文本格式
            const editedHtml = contentEl.innerHTML.trim();
            const newContent = this.htmlToMarkdown(editedHtml);
            
            if (newContent !== this.currentNote.content) {
                // 更新笔记内容
                this.currentNote.content = newContent;
                this.currentNote.updatedAt = new Date().toISOString();
                
                // 保存到本地存储
                this.saveNotesToLocal();
                
                this.showMessage('笔记已保存', 'success');
            }
        }
        
        // 退出编辑模式
        editBtn.textContent = '编辑';
        container.classList.remove('edit-mode');
        contentEl?.removeAttribute('contenteditable');
        contentEl?.classList.remove('editable');
        
        // 返回主界面
        this.showView('main');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 更新设置页面信息
    updateSettingsInfo() {
        const notesCountEl = document.getElementById('settingsNotesCount');
        if (notesCountEl) {
            notesCountEl.textContent = this.notes.length;
        }
    }

    // 加载最后同步时间
    loadLastSyncTime() {
        const lastSyncEl = document.getElementById('settingsLastSync');
        if (lastSyncEl) {
            const lastSync = localStorage.getItem('a-note-last-sync');
            if (lastSync) {
                lastSyncEl.textContent = lastSync;
            } else {
                lastSyncEl.textContent = '从未同步';
            }
        }
    }

    // 更新最后同步时间
    updateLastSyncTime() {
        const now = new Date();
        const formattedTime = now.toLocaleString('zh-CN');
        localStorage.setItem('a-note-last-sync', formattedTime);
        
        const lastSyncEl = document.getElementById('settingsLastSync');
        if (lastSyncEl) {
            lastSyncEl.textContent = formattedTime;
        }
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    window.app = new MobileNoteApp();
});

// 添加历史记录管理的方法
MobileNoteApp.prototype.initializeHistory = function() {
    // 监听浏览器历史记录变化
    window.addEventListener('popstate', (event) => {
        if (event.state && event.state.view) {
            this.showView(event.state.view, true);
        } else {
            this.showView('main', true);
        }
    });
};

MobileNoteApp.prototype.pushToHistory = function(viewName) {
    const state = { view: viewName };
    const title = viewName === 'main' ? 'A-Note' : `A-Note - ${viewName}`;
    const url = viewName === 'main' ? window.location.pathname : `#${viewName}`;
    
    window.history.pushState(state, title, url);
    this.viewHistory.push(viewName);
};

MobileNoteApp.prototype.goBack = function() {
    if (this.viewHistory.length > 1) {
        this.viewHistory.pop(); // 移除当前视图
        const previousView = this.viewHistory[this.viewHistory.length - 1];
        this.showView(previousView, true);
    } else {
        this.showView('main', true);
    }
};

// 添加消息样式
const messageStyles = `
.message {
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%) translateY(-100px) scale(0.8);
    background: linear-gradient(135deg, #4f46e5, #7c3aed);
    color: white;
    padding: 8px 8px;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(79, 70, 229, 0.25);
    z-index: 1000;
    transition: all 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    max-width: 320px;
    text-align: center;
    font-weight: 600;
    font-size: 15px;
    opacity: 0;
    border: 1px solid rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
}

.message.show {
    transform: translateX(-50%) translateY(0) scale(1);
    opacity: 1;
}

.message-success {
    background: linear-gradient(135deg, #10b981, #059669);
    box-shadow: 0 8px 32px rgba(16, 185, 129, 0.25);
}

.message-warning {
    background: linear-gradient(135deg, #f59e0b, #d97706);
    box-shadow: 0 8px 32px rgba(245, 158, 11, 0.25);
}

.message-error {
    background: linear-gradient(135deg, #ef4444, #dc2626);
    box-shadow: 0 8px 32px rgba(239, 68, 68, 0.25);
}
`;

// 注入消息样式
const styleSheet = document.createElement('style');
styleSheet.textContent = messageStyles;
document.head.appendChild(styleSheet);