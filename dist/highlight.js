/******/ (() => { // webpackBootstrap
/*!******************************!*\
  !*** ./scripts/highlight.js ***!
  \******************************/
/**
 * 划词高亮和笔记功能
 * 处理文本选择、高亮标记和笔记添加
 */

class HighlightManager {
  constructor() {
    this.currentArticleId = null;
    this.highlights = [];
    this.toolbar = null;
    this.notePopup = null;
    this.currentSelection = null;
  }

  /**
   * 初始化高亮功能
   */
  init(articleId, articleBody, highlights = []) {
    this.currentArticleId = articleId;
    this.highlights = highlights;
    this.articleBody = articleBody;
    
    // 移除旧的事件监听器
    if (this.mouseupHandler) {
      document.removeEventListener('mouseup', this.mouseupHandler);
    }
    if (this.clickHandler) {
      document.removeEventListener('click', this.clickHandler);
    }
    
    // 添加文本选择事件监听器
    this.mouseupHandler = this.handleTextSelection.bind(this);
    document.addEventListener('mouseup', this.mouseupHandler);
    
    // 添加点击事件监听器（处理点击高亮查看笔记）
    this.clickHandler = this.handleHighlightClick.bind(this);
    document.addEventListener('click', this.clickHandler);
    
    // 恢复已有的高亮
    this.restoreHighlights();
  }

  /**
   * 处理文本选择
   */
  handleTextSelection(e) {
    // 如果点击的是工具栏或弹窗，不处理
    if (this.toolbar && this.toolbar.contains(e.target)) {
      return;
    }
    if (this.notePopup && this.notePopup.contains(e.target)) {
      return;
    }
    
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    // 如果没有选中文本或文本不在文章正文中，隐藏工具栏
    if (!selectedText || !this.articleBody.contains(selection.anchorNode)) {
      this.hideToolbar();
      return;
    }
    
    // 如果选中了文本，显示工具栏
    if (selectedText.length > 0) {
      this.currentSelection = {
        text: selectedText,
        range: selection.getRangeAt(0).cloneRange()
      };
      this.showToolbar(e);
    }
  }

  /**
   * 显示高亮工具栏
   */
  showToolbar(e) {
    // 移除旧的工具栏
    this.hideToolbar();
    
    // 创建工具栏
    this.toolbar = document.createElement('div');
    this.toolbar.className = 'highlight-toolbar';
    
    // 颜色按钮
    const colors = [
      { class: 'color-yellow', emoji: '🟨', color: 'yellow' },
      { class: 'color-green', emoji: '🟩', color: 'green' },
      { class: 'color-blue', emoji: '🟦', color: 'blue' },
      { class: 'color-pink', emoji: '🟪', color: 'pink' }
    ];
    
    colors.forEach(({ class: className, emoji, color }) => {
      const btn = document.createElement('button');
      btn.className = className;
      btn.textContent = emoji;
      btn.title = `高亮为${color}`;
      btn.onclick = () => this.createHighlight(color);
      this.toolbar.appendChild(btn);
    });
    
    // 添加笔记按钮
    const noteBtn = document.createElement('button');
    noteBtn.className = 'btn-note';
    noteBtn.textContent = '📝';
    noteBtn.title = '添加笔记';
    noteBtn.onclick = () => this.showNotePopup();
    this.toolbar.appendChild(noteBtn);
    
    // 取消按钮
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn-cancel';
    cancelBtn.textContent = '✕';
    cancelBtn.title = '取消';
    cancelBtn.onclick = () => this.hideToolbar();
    this.toolbar.appendChild(cancelBtn);
    
    // 定位工具栏
    document.body.appendChild(this.toolbar);
    const rect = this.currentSelection.range.getBoundingClientRect();
    this.toolbar.style.left = `${rect.left + (rect.width / 2) - (this.toolbar.offsetWidth / 2)}px`;
    this.toolbar.style.top = `${rect.top - this.toolbar.offsetHeight - 10 + window.scrollY}px`;
  }

  /**
   * 隐藏工具栏
   */
  hideToolbar() {
    if (this.toolbar) {
      this.toolbar.remove();
      this.toolbar = null;
    }
    window.getSelection().removeAllRanges();
  }

  /**
   * 创建高亮
   */
  createHighlight(color, note = '') {
    if (!this.currentSelection) return;
    
    const highlight = {
      id: Date.now().toString(),
      text: this.currentSelection.text,
      color: color,
      note: note,
      timestamp: new Date().toISOString()
    };
    
    this.highlights.push(highlight);
    this.hideToolbar();
    this.restoreHighlights();
    this.saveHighlights();
  }

  /**
   * 恢复所有高亮
   */
  restoreHighlights() {
    // 清除现有高亮标记
    const existingHighlights = this.articleBody.querySelectorAll('.highlight');
    existingHighlights.forEach(el => {
      const parent = el.parentNode;
      while (el.firstChild) {
        parent.insertBefore(el.firstChild, el);
      }
      parent.removeChild(el);
    });
    
    // 重新应用所有高亮
    this.highlights.forEach(highlight => {
      this.applyHighlight(highlight);
    });
  }

  /**
   * 应用单个高亮
   */
  applyHighlight(highlight) {
    const walker = document.createTreeWalker(
      this.articleBody,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    
    let node;
    while (node = walker.nextNode()) {
      const text = node.textContent;
      const index = text.indexOf(highlight.text);
      
      if (index !== -1) {
        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + highlight.text.length);
        
        const span = document.createElement('span');
        span.className = `highlight highlight-${highlight.color}`;
        if (highlight.note) {
          span.classList.add('has-note');
        }
        span.dataset.highlightId = highlight.id;
        
        try {
          range.surroundContents(span);
          break; // 只高亮第一次出现
        } catch (e) {
          console.warn('无法应用高亮:', e);
        }
      }
    }
  }

  /**
   * 显示笔记弹窗
   */
  showNotePopup(existingNote = '', highlightId = null) {
    this.hideNotePopup();
    
    this.notePopup = document.createElement('div');
    this.notePopup.className = 'note-popup';
    
    const textarea = document.createElement('textarea');
    textarea.placeholder = '输入笔记...';
    textarea.value = existingNote;
    
    const actions = document.createElement('div');
    actions.className = 'note-popup-actions';
    
    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn-save';
    saveBtn.textContent = '保存';
    saveBtn.onclick = () => {
      const note = textarea.value.trim();
      if (highlightId) {
        // 更新现有笔记
        const highlight = this.highlights.find(h => h.id === highlightId);
        if (highlight) {
          highlight.note = note;
          this.restoreHighlights();
          this.saveHighlights();
        }
      } else if (this.currentSelection) {
        // 创建新高亮带笔记
        this.createHighlight('yellow', note);
      }
      this.hideNotePopup();
    };
    
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn-cancel';
    cancelBtn.textContent = '取消';
    cancelBtn.onclick = () => this.hideNotePopup();
    
    actions.appendChild(saveBtn);
    actions.appendChild(cancelBtn);
    this.notePopup.appendChild(textarea);
    this.notePopup.appendChild(actions);
    
    // 定位弹窗
    document.body.appendChild(this.notePopup);
    if (this.toolbar) {
      const rect = this.toolbar.getBoundingClientRect();
      this.notePopup.style.left = `${rect.left}px`;
      this.notePopup.style.top = `${rect.bottom + 10}px`;
    } else {
      this.notePopup.style.left = '50%';
      this.notePopup.style.top = '50%';
      this.notePopup.style.transform = 'translate(-50%, -50%)';
    }
    
    textarea.focus();
  }

  /**
   * 隐藏笔记弹窗
   */
  hideNotePopup() {
    if (this.notePopup) {
      this.notePopup.remove();
      this.notePopup = null;
    }
  }

  /**
   * 处理点击高亮文本
   */
  handleHighlightClick(e) {
    const highlightEl = e.target.closest('.highlight');
    if (!highlightEl) return;
    
    const highlightId = highlightEl.dataset.highlightId;
    const highlight = this.highlights.find(h => h.id === highlightId);
    
    if (!highlight) return;
    
    // 显示笔记或高亮信息
    this.showHighlightInfo(highlight, e);
  }

  /**
   * 显示高亮信息
   */
  showHighlightInfo(highlight, e) {
    // 移除现有的信息显示
    const existing = document.querySelector('.note-display');
    if (existing) existing.remove();
    
    const display = document.createElement('div');
    display.className = 'note-display';
    
    // 头部
    const header = document.createElement('div');
    header.className = 'note-display-header';
    const title = document.createElement('strong');
    title.textContent = highlight.note ? '📝 笔记' : '✨ 高亮';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'note-display-close';
    closeBtn.textContent = '✕';
    closeBtn.onclick = () => display.remove();
    header.appendChild(title);
    header.appendChild(closeBtn);
    
    // 内容
    if (highlight.note) {
      const content = document.createElement('div');
      content.className = 'note-display-content';
      content.textContent = highlight.note;
      display.appendChild(header);
      display.appendChild(content);
    } else {
      display.appendChild(header);
    }
    
    // 操作按钮
    const actions = document.createElement('div');
    actions.className = 'note-display-actions';
    
    const editBtn = document.createElement('button');
    editBtn.textContent = highlight.note ? '✏️ 编辑笔记' : '📝 添加笔记';
    editBtn.onclick = () => {
      display.remove();
      this.showNotePopup(highlight.note, highlight.id);
    };
    
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '🗑️ 删除';
    deleteBtn.onclick = () => {
      this.deleteHighlight(highlight.id);
      display.remove();
    };
    
    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);
    display.appendChild(actions);
    
    // 定位
    document.body.appendChild(display);
    const rect = e.target.getBoundingClientRect();
    display.style.left = `${rect.left}px`;
    display.style.top = `${rect.bottom + 10 + window.scrollY}px`;
  }

  /**
   * 删除高亮
   */
  deleteHighlight(highlightId) {
    this.highlights = this.highlights.filter(h => h.id !== highlightId);
    this.restoreHighlights();
    this.saveHighlights();
  }

  /**
   * 保存高亮到存储
   */
  async saveHighlights() {
    if (!this.currentArticleId) return;
    
    try {
      // 获取所有文章
      const result = await chrome.storage.local.get(['articles']);
      const articles = result.articles || [];
      
      // 找到当前文章并更新高亮
      const article = articles.find(a => a.id === this.currentArticleId);
      if (article) {
        article.highlights = this.highlights;
        await chrome.storage.local.set({ articles });
      }
    } catch (error) {
      console.error('保存高亮失败:', error);
    }
  }

  /**
   * 清理
   */
  destroy() {
    this.hideToolbar();
    this.hideNotePopup();
    if (this.mouseupHandler) {
      document.removeEventListener('mouseup', this.mouseupHandler);
    }
    if (this.clickHandler) {
      document.removeEventListener('click', this.clickHandler);
    }
  }
}

// 导出单例
if (typeof window !== 'undefined') {
  window.HighlightManager = HighlightManager;
  window.highlightManager = new HighlightManager();
}


/******/ })()
;
//# sourceMappingURL=highlight.js.map