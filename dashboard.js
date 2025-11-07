/**
 * Dashboard 页面逻辑
 * 处理阅读库的文章列表和内容展示
 */

// 全局状态
let allArticles = [];
let currentArticle = null;
let filteredArticles = [];
let allTags = new Set();

// DOM 元素
const elements = {
  // 列表面板
  articlesList: document.getElementById('articlesList'),
  emptyState: document.getElementById('emptyState'),
  searchInput: document.getElementById('searchInput'),
  tagFilter: document.getElementById('tagFilter'),
  settingsBtn: document.getElementById('settingsBtn'),
  themeToggleBtn: document.getElementById('themeToggleBtn'),
  
  // 内容面板
  welcomeView: document.getElementById('welcomeView'),
  articleView: document.getElementById('articleView'),
  
  // 文章详情
  articleTitle: document.getElementById('articleTitle'),
  articleSource: document.getElementById('articleSource'),
  articleDate: document.getElementById('articleDate'),
  articleSummary: document.getElementById('articleSummary'),
  articleKeyPoints: document.getElementById('articleKeyPoints'),
  articleBody: document.getElementById('articleBody'),
  articleTagsList: document.getElementById('articleTagsList'),
  
  // 元数据
  metaSource: document.getElementById('metaSource'),
  metaDate: document.getElementById('metaDate'),
  metaUrl: document.getElementById('metaUrl'),
  metaLength: document.getElementById('metaLength'),
  
  // 操作按钮
  openOriginalBtn: document.getElementById('openOriginalBtn'),
  exportMarkdownBtn: document.getElementById('exportMarkdownBtn'),
  deleteArticleBtn: document.getElementById('deleteArticleBtn'),
  addTagBtn: document.getElementById('addTagBtn'),
  
  // 模态框
  tagModal: document.getElementById('tagModal'),
  newTagInput: document.getElementById('newTagInput'),
  confirmTagBtn: document.getElementById('confirmTagBtn'),
  cancelTagBtn: document.getElementById('cancelTagBtn')
};

/**
 * 加载所有文章
 */
async function loadArticles() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getArticles' });
    
    if (response.success) {
      allArticles = response.articles || [];
      filteredArticles = [...allArticles];
      
      // 提取所有标签
      extractAllTags();
      
      // 渲染列表
      renderArticleList();
      
      // 更新标签筛选器
      updateTagFilter();
      
      // 如果有文章，显示第一篇
      if (allArticles.length > 0) {
        selectArticle(allArticles[0]);
      }
    }
  } catch (error) {
    console.error('加载文章失败:', error);
  }
}

/**
 * 提取所有标签
 */
function extractAllTags() {
  allTags.clear();
  allArticles.forEach(article => {
    if (article.tags && Array.isArray(article.tags)) {
      article.tags.forEach(tag => allTags.add(tag));
    }
  });
}

/**
 * 更新标签筛选器
 */
function updateTagFilter() {
  const currentValue = elements.tagFilter.value;
  
  // 清空并重新填充
  elements.tagFilter.innerHTML = '<option value="">所有标签</option>';
  
  Array.from(allTags).sort().forEach(tag => {
    const option = document.createElement('option');
    option.value = tag;
    option.textContent = tag;
    elements.tagFilter.appendChild(option);
  });
  
  // 恢复之前的选择
  if (currentValue && allTags.has(currentValue)) {
    elements.tagFilter.value = currentValue;
  }
}

/**
 * 渲染文章列表
 */
function renderArticleList() {
  // 清空列表
  elements.articlesList.innerHTML = '';
  
  // 检查是否有文章
  if (filteredArticles.length === 0) {
    elements.emptyState.classList.remove('hidden');
    elements.articlesList.classList.add('hidden');
    return;
  }
  
  elements.emptyState.classList.add('hidden');
  elements.articlesList.classList.remove('hidden');
  
  // 渲染每篇文章
  filteredArticles.forEach(article => {
    const item = createArticleItem(article);
    elements.articlesList.appendChild(item);
  });
}

/**
 * 创建文章列表项
 */
function createArticleItem(article) {
  const div = document.createElement('div');
  div.className = 'article-item';
  div.dataset.id = article.id;
  
  // 检测内容类型
  const isVideo = article.type && article.type.startsWith('video-');
  if (isVideo) {
    div.classList.add('video-item');
  }
  
  const date = new Date(article.dateAdded);
  const dateStr = formatDate(date);
  
  // 视频类型添加图标和时长
  const typeIcon = isVideo ? '🎥 ' : '';
  const durationStr = isVideo && article.videoMetadata?.duration 
    ? ` • ${formatDuration(article.videoMetadata.duration)}` 
    : '';
  
  div.innerHTML = `
    <div class="article-item-title">${typeIcon}${escapeHtml(article.title)}</div>
    <div class="article-item-meta">
      <span class="article-item-source">${escapeHtml(article.source)}</span>
      <span>•</span>
      <span>${dateStr}</span>
      ${durationStr ? `<span>${durationStr}</span>` : ''}
    </div>
  `;
  
  // 点击事件
  div.addEventListener('click', () => {
    selectArticle(article);
  });
  
  // 如果是当前文章，添加 active 类
  if (currentArticle && currentArticle.id === article.id) {
    div.classList.add('active');
  }
  
  return div;
}

/**
 * 选择文章
 */
function selectArticle(article) {
  currentArticle = article;
  
  // 更新列表项的 active 状态
  document.querySelectorAll('.article-item').forEach(item => {
    item.classList.remove('active');
    if (item.dataset.id === article.id) {
      item.classList.add('active');
    }
  });
  
  // 显示文章详情
  showArticleDetails(article);
}

/**
 * 显示文章详情
 */
function showArticleDetails(article) {
  // 切换视图
  elements.welcomeView.classList.add('hidden');
  elements.articleView.classList.remove('hidden');
  
  // 基本信息
  elements.articleTitle.textContent = article.title;
  elements.articleSource.textContent = article.source;
  
  const date = new Date(article.dateAdded);
  elements.articleDate.textContent = formatDate(date);
  
  // AI 分析
  elements.articleSummary.textContent = article.summary || '暂无摘要';
  
  // 核心观点
  elements.articleKeyPoints.innerHTML = '';
  if (article.keyPoints && article.keyPoints.length > 0) {
    article.keyPoints.forEach(point => {
      const li = document.createElement('li');
      li.textContent = point;
      elements.articleKeyPoints.appendChild(li);
    });
  } else {
    const li = document.createElement('li');
    li.textContent = '暂无核心观点';
    elements.articleKeyPoints.appendChild(li);
  }
  
  // 原文内容（区分视频和文章）
  const isVideo = article.type && article.type.startsWith('video-');
  
  if (isVideo) {
    // 视频内容特殊处理
    const videoMeta = article.videoMetadata || {};
    const hasSubtitles = videoMeta.subtitles?.available;
    const subtitleText = hasSubtitles ? videoMeta.subtitles.fullText : '';
    
    elements.articleBody.innerHTML = `
      <div class="video-content-box">
        <div class="video-header">
          <h3>🎥 视频信息</h3>
        </div>
        
        <div class="video-metadata">
          ${videoMeta.duration ? `<div class="meta-item"><strong>时长:</strong> ${formatDuration(videoMeta.duration)}</div>` : ''}
          ${videoMeta.author ? `<div class="meta-item"><strong>UP主:</strong> ${escapeHtml(videoMeta.author)}</div>` : ''}
          ${videoMeta.pubdate ? `<div class="meta-item"><strong>发布:</strong> ${new Date(videoMeta.pubdate).toLocaleDateString('zh-CN')}</div>` : ''}
          ${videoMeta.stats?.view ? `<div class="meta-item"><strong>播放:</strong> ${videoMeta.stats.view.toLocaleString()}</div>` : ''}
          ${videoMeta.stats?.like ? `<div class="meta-item"><strong>点赞:</strong> ${videoMeta.stats.like.toLocaleString()}</div>` : ''}
        </div>
        
        ${article.contentSources ? `
          <div class="content-sources">
            <strong>📊 内容来源：</strong>
            <span class="source-tags">
              ${article.contentSources.map(src => {
                const icons = { '字幕': '📝', '热门评论': '💬', '简介': '📄', '标签': '🏷️', '统计': '📊' };
                return `<span class="source-tag">${icons[src] || '📌'} ${src}</span>`;
              }).join('')}
            </span>
          </div>
        ` : ''}
        
        ${hasSubtitles ? `
          <div class="video-subtitles">
            <h4>📝 视频字幕 ${videoMeta.subtitles?.method === 'dom' ? '(从页面提取)' : ''}</h4>
            <div class="subtitle-text">${escapeHtml(subtitleText)}</div>
          </div>
        ` : videoMeta.comments?.available ? `
          <div class="video-comments">
            <h4>💬 热门评论 (${videoMeta.comments.count} 条，最高 ${videoMeta.comments.topLikes} 赞)</h4>
            <div class="comments-sample">
              <p style="color: #666; font-size: 13px; margin-bottom: 10px;">
                ℹ️ 由于视频没有字幕，已提取热门评论作为内容补充
              </p>
              <div class="subtitle-text">${escapeHtml(videoMeta.comments.sample)}</div>
            </div>
          </div>
        ` : `
          <div class="no-subtitles">
            <p>⚠️ 此视频没有字幕</p>
            <p style="color: #999; font-size: 14px;">${videoMeta.subtitles?.message || '已综合简介、标签等信息生成摘要'}</p>
          </div>
        `}
        
        ${article.excerpt ? `
          <div class="video-description">
            <h4>📄 视频简介</h4>
            <p>${escapeHtml(article.excerpt)}</p>
          </div>
        ` : ''}
        
        <div class="video-actions">
          <a href="${article.url}" target="_blank" class="video-link-btn">
            🔗 观看视频
          </a>
        </div>
      </div>
    `;
  } else if (article.htmlContent) {
    elements.articleBody.innerHTML = sanitizeHtml(article.htmlContent);
  } else if (article.content) {
    elements.articleBody.textContent = article.content;
  } else if (article.hasOriginalContent === false) {
    // 用户选择不保存原文
    elements.articleBody.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: #666;">
        <div style="font-size: 48px; margin-bottom: 16px;">📝</div>
        <p style="font-size: 16px; margin-bottom: 8px;">此文章未保存原文内容</p>
        <p style="font-size: 14px; color: #999;">仅保存了 AI 生成的摘要和关键观点</p>
        <a href="${article.url}" target="_blank" style="display: inline-block; margin-top: 16px; padding: 8px 16px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 6px;">访问原文链接</a>
      </div>
    `;
  } else {
    elements.articleBody.textContent = '内容不可用';
  }
  
  // 初始化高亮和笔记功能
  if (window.highlightManager) {
    window.highlightManager.init(
      article.id,
      elements.articleBody,
      article.highlights || []
    );
  }
  
  // 标签
  renderArticleTags(article.tags || []);
  
  // 元数据
  elements.metaSource.textContent = article.source;
  elements.metaDate.textContent = new Date(article.dateAdded).toLocaleString('zh-CN');
  elements.metaUrl.href = article.url;
  elements.metaUrl.textContent = article.url;
  elements.metaLength.textContent = `${article.content ? article.content.length : 0} 字`;
  
  // 滚动到顶部
  elements.articleView.parentElement.scrollTop = 0;
}

/**
 * 渲染文章标签
 */
function renderArticleTags(tags) {
  elements.articleTagsList.innerHTML = '';
  
  tags.forEach(tag => {
    const span = document.createElement('span');
    span.className = 'tag';
    span.innerHTML = `
      ${escapeHtml(tag)}
      <span class="tag-remove" data-tag="${escapeHtml(tag)}">×</span>
    `;
    elements.articleTagsList.appendChild(span);
  });
}

/**
 * 搜索文章
 */
function searchArticles(query) {
  query = query.toLowerCase().trim();
  
  if (!query) {
    filteredArticles = [...allArticles];
  } else {
    filteredArticles = allArticles.filter(article => {
      const titleMatch = article.title.toLowerCase().includes(query);
      const contentMatch = article.content && article.content.toLowerCase().includes(query);
      const summaryMatch = article.summary && article.summary.toLowerCase().includes(query);
      
      return titleMatch || contentMatch || summaryMatch;
    });
  }
  
  applyTagFilter();
}

/**
 * 应用标签筛选
 */
function applyTagFilter() {
  const selectedTag = elements.tagFilter.value;
  
  if (selectedTag) {
    filteredArticles = filteredArticles.filter(article => {
      return article.tags && article.tags.includes(selectedTag);
    });
  }
  
  renderArticleList();
}

/**
 * 添加标签
 */
async function addTag(tag) {
  tag = tag.trim();
  
  if (!tag || !currentArticle) {
    return;
  }
  
  const tags = currentArticle.tags || [];
  
  if (tags.includes(tag)) {
    showWarning('标签已存在');
    return;
  }
  
  tags.push(tag);
  
  try {
    await chrome.runtime.sendMessage({
      action: 'updateArticleTags',
      articleId: currentArticle.id,
      tags: tags
    });
    
    currentArticle.tags = tags;
    renderArticleTags(tags);
    
    // 更新全局标签集合
    allTags.add(tag);
    updateTagFilter();
    
    // 关闭模态框
    closeTagModal();
    showSuccess(`标签"${tag}"已添加`);
  } catch (error) {
    console.error('添加标签失败:', error);
    showError('添加标签失败: ' + error.message);
  }
}

/**
 * 删除标签
 */
async function removeTag(tag) {
  if (!currentArticle) {
    return;
  }
  
  const tags = (currentArticle.tags || []).filter(t => t !== tag);
  
  try {
    await chrome.runtime.sendMessage({
      action: 'updateArticleTags',
      articleId: currentArticle.id,
      tags: tags
    });
    
    currentArticle.tags = tags;
    renderArticleTags(tags);
    
    // 重新加载文章以更新标签集合
    await loadArticles();
  } catch (error) {
    console.error('删除标签失败:', error);
    alert('删除标签失败');
  }
}

/**
 * 删除文章
 */
async function deleteArticle() {
  if (!currentArticle) {
    return;
  }
  
  if (!confirm('确定要删除这篇文章吗？')) {
    return;
  }
  
  const hideLoading = showLoading('正在删除文章...');
  
  try {
    await chrome.runtime.sendMessage({
      action: 'deleteArticle',
      articleId: currentArticle.id
    });
    
    hideLoading();
    showSuccess('文章已删除');
    
    // 重新加载文章列表
    await loadArticles();
  } catch (error) {
    hideLoading();
    console.error('删除文章失败:', error);
    showError('删除文章失败: ' + error.message);
  }
}

/**
 * 打开标签模态框
 */
function openTagModal() {
  elements.tagModal.classList.remove('hidden');
  elements.newTagInput.value = '';
  elements.newTagInput.focus();
}

/**
 * 关闭标签模态框
 */
function closeTagModal() {
  elements.tagModal.classList.add('hidden');
  elements.newTagInput.value = '';
}

/**
 * 格式化日期
 */
function formatDate(date) {
  const now = new Date();
  const diff = now - date;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 60) {
    return `${minutes} 分钟前`;
  } else if (hours < 24) {
    return `${hours} 小时前`;
  } else if (days < 7) {
    return `${days} 天前`;
  } else {
    return date.toLocaleDateString('zh-CN');
  }
}

/**
 * 转义 HTML
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 简单的 HTML 清理（移除危险标签）
 */
function sanitizeHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  
  // 移除危险标签
  const dangerousTags = ['script', 'iframe', 'object', 'embed', 'link'];
  dangerousTags.forEach(tag => {
    const elements = div.querySelectorAll(tag);
    elements.forEach(el => el.remove());
  });
  
  return div.innerHTML;
}

/**
 * 导出文章为 Markdown 格式
 */
function exportToMarkdown(article) {
  try {
    // 构建 Markdown 内容
    let markdown = '';
    
    // 标题
    markdown += `# ${article.title}\n\n`;
    
    // 元数据
    markdown += `**来源**: ${article.source}  \n`;
    markdown += `**原文链接**: ${article.url}  \n`;
    markdown += `**保存时间**: ${new Date(article.dateAdded).toLocaleString('zh-CN')}  \n`;
    
    // 标签
    if (article.tags && article.tags.length > 0) {
      markdown += `**标签**: ${article.tags.join(', ')}  \n`;
    }
    
    markdown += `\n---\n\n`;
    
    // AI 摘要
    markdown += `## 📝 AI 摘要\n\n`;
    markdown += `${article.summary || '暂无摘要'}\n\n`;
    
    // 核心观点
    markdown += `## 💡 核心观点\n\n`;
    if (article.keyPoints && article.keyPoints.length > 0) {
      article.keyPoints.forEach((point, index) => {
        markdown += `${index + 1}. ${point}\n`;
      });
    } else {
      markdown += '暂无核心观点\n';
    }
    
    markdown += `\n---\n\n`;
    
    // 原文内容
    markdown += `## 📄 原文内容\n\n`;
    markdown += `${article.content || '内容不可用'}\n\n`;
    
    markdown += `\n---\n\n`;
    markdown += `*本文由 Digest AI 导出*\n`;
    
    // 创建下载链接
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    // 生成文件名（清理标题中的非法字符）
    const fileName = `${article.title.replace(/[<>:"/\\|?*]/g, '_')}.md`;
    link.href = url;
    link.download = fileName;
    
    // 触发下载
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // 释放 URL
    URL.revokeObjectURL(url);
    
    showSuccess('文章已导出为 Markdown');
  } catch (error) {
    console.error('导出失败:', error);
    showError('导出失败: ' + error.message);
  }
}

// 事件监听器

// 搜索
elements.searchInput.addEventListener('input', (e) => {
  searchArticles(e.target.value);
});

// 标签筛选
elements.tagFilter.addEventListener('change', () => {
  searchArticles(elements.searchInput.value);
});

// 设置按钮
elements.settingsBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: 'settings.html' });
});

// 主题切换按钮
elements.themeToggleBtn.addEventListener('click', async () => {
  try {
    // 获取当前主题
    const result = await chrome.storage.local.get(['theme']);
    const currentTheme = result.theme || 'light';
    
    // 切换到下一个主题
    let newTheme;
    if (currentTheme === 'light') {
      newTheme = 'dark';
      elements.themeToggleBtn.textContent = '☀️';
      elements.themeToggleBtn.title = '切换到浅色主题';
    } else {
      newTheme = 'light';
      elements.themeToggleBtn.textContent = '🌙';
      elements.themeToggleBtn.title = '切换到深色主题';
    }
    
    // 保存并应用新主题
    await chrome.storage.local.set({ theme: newTheme });
    await applyTheme(newTheme);
    
    // 显示成功提示
    showSuccess('主题已切换');
  } catch (error) {
    console.error('切换主题失败:', error);
    showError('切换主题失败');
  }
});

// 打开原文
elements.openOriginalBtn.addEventListener('click', () => {
  if (currentArticle) {
    chrome.tabs.create({ url: currentArticle.url });
  }
});

// 导出为 Markdown
elements.exportMarkdownBtn.addEventListener('click', () => {
  if (currentArticle) {
    exportToMarkdown(currentArticle);
  }
});

// 删除文章
elements.deleteArticleBtn.addEventListener('click', deleteArticle);

// 添加标签
elements.addTagBtn.addEventListener('click', openTagModal);
elements.confirmTagBtn.addEventListener('click', () => {
  const tag = elements.newTagInput.value;
  addTag(tag);
});
elements.cancelTagBtn.addEventListener('click', closeTagModal);

// 标签输入 - Enter 键
elements.newTagInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    const tag = e.target.value;
    addTag(tag);
  }
});

// 删除标签
elements.articleTagsList.addEventListener('click', (e) => {
  if (e.target.classList.contains('tag-remove')) {
    const tag = e.target.dataset.tag;
    removeTag(tag);
  }
});

// 模态框背景点击关闭
elements.tagModal.addEventListener('click', (e) => {
  if (e.target === elements.tagModal) {
    closeTagModal();
  }
});

/**
 * 格式化时长（秒转为 HH:MM:SS 或 MM:SS）
 */
function formatDuration(seconds) {
  if (!seconds || seconds === 0) return '';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// 初始化
(async function init() {
  await loadArticles();
  
  // 初始化主题按钮图标
  const result = await chrome.storage.local.get(['theme']);
  const currentTheme = result.theme || 'light';
  if (currentTheme === 'dark') {
    elements.themeToggleBtn.textContent = '☀️';
    elements.themeToggleBtn.title = '切换到浅色主题';
  } else {
    elements.themeToggleBtn.textContent = '🌙';
    elements.themeToggleBtn.title = '切换到深色主题';
  }
})();

